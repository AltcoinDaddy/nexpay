// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                         NOXPAY                                ║
 * ║   Confidential Payroll & Rewards — Powered by iExec Nox       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * @title NoxPay - Confidential Payroll & Rewards Platform
 * @author NoxPay Team
 * @notice This contract manages confidential reward distributions using
 *         iExec Nox's ERC-7984 Confidential Tokens. All individual
 *         amounts and balances remain fully encrypted on-chain, while
 *         only aggregate statistics are publicly visible.
 *
 * @dev Integrates with:
 *   - iExec Nox Protocol (TEE-based confidential computation)
 *   - ERC-7984 Confidential Token standard
 *   - ERC-20 to ERC-7984 Wrapper for token shielding
 *
 * Key features:
 *   1. Token Shielding (wrap ERC-20 → Confidential Token)
 *   2. Confidential batch payments/rewards
 *   3. Selective disclosure for compliance/auditing
 *   4. Optional linear vesting schedules
 *   5. Public aggregate tracking (total distributed)
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Interface for the iExec Nox Confidential Token (ERC-7984 wrapper).
 *      In production, this would be imported from iexec-nox/nox-confidential-contracts.
 *      The interface represents the core functions of the ERC20ToERC7984Wrapper.
 */
interface IConfidentialToken {
    /// @notice Wraps ERC-20 tokens into confidential ERC-7984 tokens
    /// @param to The recipient of the confidential tokens
    /// @param amount The plaintext amount to wrap (visible during wrapping)
    /// @return handle The encrypted handle representing the wrapped amount
    function wrap(address to, uint256 amount) external returns (bytes32 handle);

    /// @notice Initiates unwrapping of confidential tokens back to ERC-20
    /// @param from The address to burn confidential tokens from
    /// @param to The address to receive ERC-20 tokens
    /// @param encryptedAmount The encrypted amount handle
    /// @param inputProof The proof for the encrypted input
    /// @return requestId The unwrap request ID for finalization
    function unwrap(
        address from,
        address to,
        bytes32 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bytes32 requestId);

    /// @notice Performs a confidential transfer between addresses
    /// @param from Sender address
    /// @param to Recipient address
    /// @param encryptedAmount The encrypted amount handle
    /// @param inputProof The proof for the encrypted input
    /// @return success Whether the transfer succeeded (encrypted boolean)
    function confidentialTransfer(
        address from,
        address to,
        bytes32 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bytes32 success);

    /// @notice Returns the encrypted balance handle for an address
    /// @param account The address to query
    /// @return handle The encrypted balance handle
    function confidentialBalanceOf(address account) external view returns (bytes32 handle);

    /// @notice Grants view access to a specific address for a handle
    /// @param handle The encrypted handle to grant access to
    /// @param viewer The address being granted view access
    function addViewer(bytes32 handle, address viewer) external;

    /// @notice Removes view access for a specific address when supported
    /// @param handle The encrypted handle to revoke access from
    /// @param viewer The address whose access is being revoked
    function removeViewer(bytes32 handle, address viewer) external;

    /// @notice Returns the underlying ERC-20 token address
    function underlying() external view returns (address);
}

/**
 * @title NoxPay
 * @notice Main contract for confidential payroll and rewards distribution
 */
contract NoxPay is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice The confidential token (ERC-7984 wrapper) used for payments
    IConfidentialToken public confidentialToken;

    /// @notice The underlying ERC-20 token
    IERC20 public underlyingToken;

    /// @notice Treasury admin — can send payments and manage settings
    address public treasury;

    /// @notice Total rewards distributed (public aggregate — visible to everyone)
    uint256 public totalRewardsDistributed;

    /// @notice Total number of payments made
    uint256 public totalPaymentCount;

    /// @notice Total unique recipients
    uint256 public uniqueRecipientCount;

    /// @notice Whether an address has ever received a payment
    mapping(address => bool) public isRecipient;

    /// @notice Number of payments received by each address
    mapping(address => uint256) public recipientPaymentCount;

    // ═══════════════════════════════════════════════════════════
    //                      VESTING
    // ═══════════════════════════════════════════════════════════

    /// @notice Vesting schedule for a recipient
    struct VestingSchedule {
        uint256 totalAmount;       // Total amount vesting (public for aggregate tracking)
        uint256 claimedAmount;     // Amount already claimed
        uint256 startTime;         // Vesting start timestamp
        uint256 duration;          // Vesting duration in seconds
        bytes32 encryptedTotal;    // Encrypted handle for the total amount
        bool active;               // Whether the schedule is active
    }

    /// @notice Vesting schedules: recipient => schedule ID => VestingSchedule
    mapping(address => mapping(uint256 => VestingSchedule)) public vestingSchedules;

    /// @notice Number of vesting schedules per recipient
    mapping(address => uint256) public vestingScheduleCount;

    // ═══════════════════════════════════════════════════════════
    //                   SELECTIVE DISCLOSURE
    // ═══════════════════════════════════════════════════════════

    /// @notice Temporary view access grants
    struct ViewAccess {
        address viewer;            // Address granted view access
        uint256 expiresAt;         // Timestamp when access expires
        bool active;               // Whether access is currently active
        bytes32 balanceHandle;     // Handle shared with the viewer
    }

    /// @notice View access grants: granter => grant ID => ViewAccess
    mapping(address => mapping(uint256 => ViewAccess)) public viewAccessGrants;

    /// @notice Number of view access grants per address
    mapping(address => uint256) public viewAccessGrantCount;

    // ═══════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════

    /// @notice Emitted when tokens are shielded (wrapped into confidential tokens)
    event TokensShielded(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when a confidential reward/payment is sent
    /// @dev Only the aggregate amount is public; individual amounts are encrypted
    event RewardSent(
        address indexed from,
        address indexed to,
        uint256 publicAggregate,
        uint256 timestamp
    );

    /// @notice Emitted when a batch payment is executed
    event BatchPaymentExecuted(
        address indexed treasury,
        uint256 recipientCount,
        uint256 totalPublicAmount,
        uint256 timestamp
    );

    /// @notice Emitted when a vesting schedule is created
    event VestingScheduleCreated(
        address indexed recipient,
        uint256 scheduleId,
        uint256 totalAmount,
        uint256 duration,
        uint256 startTime
    );

    /// @notice Emitted when vested tokens are claimed
    event VestingClaimed(
        address indexed recipient,
        uint256 scheduleId,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when view access is granted
    event ViewAccessGranted(
        address indexed granter,
        address indexed viewer,
        uint256 grantId,
        uint256 expiresAt
    );

    /// @notice Emitted when view access is revoked
    event ViewAccessRevoked(
        address indexed granter,
        uint256 grantId
    );

    /// @notice Emitted when the treasury address is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ═══════════════════════════════════════════════════════════
    //                       ERRORS
    // ═══════════════════════════════════════════════════════════

    error OnlyTreasury();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidDuration();
    error GrantNotActive();
    error VestingNotActive();
    error NothingToClaim();
    error AccessExpired();
    error ArrayLengthMismatch();

    // ═══════════════════════════════════════════════════════════
    //                      MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyTreasury() {
        if (msg.sender != treasury) revert OnlyTreasury();
        _;
    }

    // ═══════════════════════════════════════════════════════════
    //                     CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Initializes NoxPay with a confidential token and treasury
     * @param _confidentialToken Address of the ERC-7984 confidential token wrapper
     * @param _treasury Address of the treasury admin
     */
    constructor(
        address _confidentialToken,
        address _underlyingToken,
        address _treasury
    ) Ownable(msg.sender) {
        if (_confidentialToken == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();

        confidentialToken = IConfidentialToken(_confidentialToken);
        underlyingToken = IERC20(_underlyingToken);
        treasury = _treasury;
    }

    // ═══════════════════════════════════════════════════════════
    //                  TOKEN SHIELDING
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Shield (wrap) ERC-20 tokens into confidential ERC-7984 tokens
     * @dev User must approve this contract to spend their ERC-20 tokens first.
     *      After wrapping, the balance becomes encrypted and private.
     * @param amount The amount of ERC-20 tokens to shield
     * @return handle The encrypted handle for the shielded balance
     */
    function shieldTokens(uint256 amount) external nonReentrant returns (bytes32 handle) {
        if (amount == 0) revert InvalidAmount();

        // Transfer ERC-20 from user to this contract
        underlyingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Approve the confidential token wrapper to spend our tokens
        underlyingToken.approve(address(confidentialToken), amount);

        // Wrap into confidential tokens, minting to the user
        handle = confidentialToken.wrap(msg.sender, amount);

        emit TokensShielded(msg.sender, amount, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════
    //              CONFIDENTIAL PAYMENTS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Send a confidential reward/payment to a recipient
     * @dev The amount is encrypted — only the recipient can view it.
     *      The public aggregate is updated for transparency.
     * @param to Recipient address
     * @param encryptedAmount The encrypted amount handle (from JS SDK)
     * @param inputProof The proof for the encrypted input
     * @param publicAmount The public aggregate amount (for tracking purposes only)
     */
    function sendConfidentialReward(
        address to,
        bytes32 encryptedAmount,
        bytes calldata inputProof,
        uint256 publicAmount
    ) external onlyTreasury nonReentrant {
        if (to == address(0)) revert InvalidAddress();

        // Perform confidential transfer from treasury to recipient
        confidentialToken.confidentialTransfer(
            msg.sender,
            to,
            encryptedAmount,
            inputProof
        );

        // Update public aggregates
        totalRewardsDistributed += publicAmount;
        totalPaymentCount += 1;

        if (!isRecipient[to]) {
            isRecipient[to] = true;
            uniqueRecipientCount += 1;
        }
        recipientPaymentCount[to] += 1;

        emit RewardSent(msg.sender, to, totalRewardsDistributed, block.timestamp);
    }

    /**
     * @notice Send batch confidential rewards to multiple recipients
     * @param recipients Array of recipient addresses
     * @param encryptedAmounts Array of encrypted amount handles
     * @param inputProofs Array of proofs for encrypted inputs
     * @param publicAmounts Array of public amounts for aggregate tracking
     */
    function sendBatchRewards(
        address[] calldata recipients,
        bytes32[] calldata encryptedAmounts,
        bytes[] calldata inputProofs,
        uint256[] calldata publicAmounts
    ) external onlyTreasury nonReentrant {
        uint256 length = recipients.length;
        if (
            length != encryptedAmounts.length ||
            length != inputProofs.length ||
            length != publicAmounts.length
        ) revert ArrayLengthMismatch();

        uint256 totalPublicAmount = 0;

        for (uint256 i = 0; i < length; i++) {
            if (recipients[i] == address(0)) revert InvalidAddress();

            // Perform confidential transfer
            confidentialToken.confidentialTransfer(
                msg.sender,
                recipients[i],
                encryptedAmounts[i],
                inputProofs[i]
            );

            totalPublicAmount += publicAmounts[i];

            if (!isRecipient[recipients[i]]) {
                isRecipient[recipients[i]] = true;
                uniqueRecipientCount += 1;
            }
            recipientPaymentCount[recipients[i]] += 1;
        }

        totalRewardsDistributed += totalPublicAmount;
        totalPaymentCount += length;

        emit BatchPaymentExecuted(
            msg.sender,
            length,
            totalPublicAmount,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════
    //                      VESTING
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Create a linear vesting schedule for a recipient
     * @param recipient The vesting recipient
     * @param encryptedAmount Encrypted handle for the total vesting amount
     * @param inputProof Proof for the encrypted input
     * @param publicAmount Public amount for aggregate tracking
     * @param duration Vesting duration in seconds
     */
    function createVestingSchedule(
        address recipient,
        bytes32 encryptedAmount,
        bytes calldata inputProof,
        uint256 publicAmount,
        uint256 duration
    ) external onlyTreasury nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        if (publicAmount == 0) revert InvalidAmount();
        if (duration == 0) revert InvalidDuration();

        // Transfer confidential tokens to this contract for vesting
        confidentialToken.confidentialTransfer(
            msg.sender,
            address(this),
            encryptedAmount,
            inputProof
        );

        uint256 scheduleId = vestingScheduleCount[recipient];
        vestingSchedules[recipient][scheduleId] = VestingSchedule({
            totalAmount: publicAmount,
            claimedAmount: 0,
            startTime: block.timestamp,
            duration: duration,
            encryptedTotal: encryptedAmount,
            active: true
        });

        vestingScheduleCount[recipient] += 1;
        totalRewardsDistributed += publicAmount;

        if (!isRecipient[recipient]) {
            isRecipient[recipient] = true;
            uniqueRecipientCount += 1;
        }

        emit VestingScheduleCreated(
            recipient,
            scheduleId,
            publicAmount,
            duration,
            block.timestamp
        );
    }

    /**
     * @notice Calculate the vested amount for a schedule (public tracking)
     * @param recipient The vesting recipient
     * @param scheduleId The vesting schedule ID
     * @return vestedAmount The publicly tracked vested amount
     */
    function getVestedAmount(
        address recipient,
        uint256 scheduleId
    ) public view returns (uint256 vestedAmount) {
        VestingSchedule storage schedule = vestingSchedules[recipient][scheduleId];
        if (!schedule.active) return 0;

        uint256 elapsed = block.timestamp - schedule.startTime;
        if (elapsed >= schedule.duration) {
            return schedule.totalAmount;
        }
        return (schedule.totalAmount * elapsed) / schedule.duration;
    }

    /**
     * @notice Claim vested tokens
     * @param scheduleId The vesting schedule ID to claim from
     * @param encryptedAmount Encrypted amount to claim
     * @param inputProof Proof for the encrypted input
     */
    function claimVested(
        uint256 scheduleId,
        bytes32 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[msg.sender][scheduleId];
        if (!schedule.active) revert VestingNotActive();

        uint256 vested = getVestedAmount(msg.sender, scheduleId);
        uint256 claimable = vested - schedule.claimedAmount;
        if (claimable == 0) revert NothingToClaim();

        schedule.claimedAmount = vested;

        // Transfer confidential tokens to the recipient
        confidentialToken.confidentialTransfer(
            address(this),
            msg.sender,
            encryptedAmount,
            inputProof
        );

        // If fully vested and claimed, deactivate
        if (schedule.claimedAmount >= schedule.totalAmount) {
            schedule.active = false;
        }

        emit VestingClaimed(msg.sender, scheduleId, claimable, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════
    //               SELECTIVE DISCLOSURE
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Grant temporary view access to a specific address
     * @dev This allows an auditor or compliance officer to view
     *      the granter's encrypted balances/transactions
     * @param viewer Address to grant view access to
     * @param duration Duration of access in seconds
     * @param balanceHandle The encrypted balance handle to share
     */
    function grantViewAccess(
        address viewer,
        uint256 duration,
        bytes32 balanceHandle
    ) external {
        if (viewer == address(0)) revert InvalidAddress();
        if (duration == 0) revert InvalidDuration();

        uint256 grantId = viewAccessGrantCount[msg.sender];
        uint256 expiresAt = block.timestamp + duration;

        viewAccessGrants[msg.sender][grantId] = ViewAccess({
            viewer: viewer,
            expiresAt: expiresAt,
            active: true,
            balanceHandle: balanceHandle
        });

        viewAccessGrantCount[msg.sender] += 1;

        // Grant on-chain ACL access via the confidential token
        confidentialToken.addViewer(balanceHandle, viewer);

        emit ViewAccessGranted(msg.sender, viewer, grantId, expiresAt);
    }

    /**
     * @notice Revoke a previously granted view access
     * @param grantId The ID of the grant to revoke
     */
    function revokeViewAccess(uint256 grantId) external {
        ViewAccess storage grant = viewAccessGrants[msg.sender][grantId];
        if (!grant.active) revert GrantNotActive();
        grant.active = false;

        if (grant.balanceHandle != bytes32(0) && grant.viewer != address(0)) {
            (bool success, ) = address(confidentialToken).call(
                abi.encodeWithSelector(
                    IConfidentialToken.removeViewer.selector,
                    grant.balanceHandle,
                    grant.viewer
                )
            );
            success;
        }

        emit ViewAccessRevoked(msg.sender, grantId);
    }

    /**
     * @notice Check if a viewer currently has valid access
     * @param granter The address that granted access
     * @param grantId The grant ID to check
     * @return hasAccess Whether the viewer currently has valid access
     */
    function hasValidAccess(
        address granter,
        uint256 grantId
    ) external view returns (bool hasAccess) {
        ViewAccess storage grant = viewAccessGrants[granter][grantId];
        return grant.active && block.timestamp <= grant.expiresAt;
    }

    // ═══════════════════════════════════════════════════════════
    //                   ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Update the treasury address
     * @param newTreasury New treasury admin address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    // ═══════════════════════════════════════════════════════════
    //                   VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Get public aggregate statistics
     * @return _totalDistributed Total rewards distributed
     * @return _paymentCount Total number of payments made
     * @return _uniqueRecipients Total unique recipients
     */
    function getPublicStats() external view returns (
        uint256 _totalDistributed,
        uint256 _paymentCount,
        uint256 _uniqueRecipients
    ) {
        return (totalRewardsDistributed, totalPaymentCount, uniqueRecipientCount);
    }

    /**
     * @notice Get the encrypted balance handle for a user
     * @dev The actual balance can only be decrypted client-side by the owner
     * @param user Address to query
     * @return handle The encrypted balance handle
     */
    function getConfidentialBalance(address user) external view returns (bytes32 handle) {
        return confidentialToken.confidentialBalanceOf(user);
    }
}
