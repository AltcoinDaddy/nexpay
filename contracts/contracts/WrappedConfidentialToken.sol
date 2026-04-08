// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {ERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";
import {Nox, euint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @title WrappedConfidentialToken
 * @notice Minimal ERC-20 to ERC-7984 wrapper backed by the official iExec Nox contracts.
 * @dev The underlying token can still be a test ERC-20 on Arbitrum Sepolia; what matters is that
 *      the confidentiality layer now comes from the real Nox wrapper instead of a mock handle counter.
 */
contract WrappedConfidentialToken is ERC20ToERC7984Wrapper {
    constructor(
        IERC20 underlyingToken,
        string memory name_,
        string memory symbol_,
        string memory contractURI_
    ) ERC7984(name_, symbol_, contractURI_) ERC20ToERC7984Wrapper(underlyingToken) {}

    /**
     * @dev Ensure each holder can decrypt their current confidential balance handle.
     * `allow(...)` enables onchain use, but browser decryption still requires viewer ACL.
     */
    function _update(
        address from,
        address to,
        euint256 amount
    ) internal virtual override returns (euint256 transferred) {
        transferred = super._update(from, to, amount);

        if (from != address(0) && Nox.isInitialized(_balances[from])) {
            Nox.addViewer(_balances[from], from);
        }
        if (to != address(0) && Nox.isInitialized(_balances[to])) {
            Nox.addViewer(_balances[to], to);
        }
    }
}
