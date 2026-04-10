/**
 * Contract addresses and ABIs for NoxPay
 * Update these after deployment to Arbitrum Sepolia
 */

// ─── Contract Addresses ────────────────────────────────────
export const CONTRACTS = {
  // NoxPay main contract (deploy and update)
  NOXPAY: import.meta.env.VITE_NOXPAY_ADDRESS || '0x0000000000000000000000000000000000000000',

  // iExec Nox Confidential Token Wrapper (from cdefi.iex.ec)
  CONFIDENTIAL_TOKEN: import.meta.env.VITE_CONFIDENTIAL_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',

  // Underlying ERC-20 token (e.g., USDC on Arbitrum Sepolia)
  UNDERLYING_TOKEN: import.meta.env.VITE_UNDERLYING_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',

  // NoxCompute proxy used by the official Sepolia SDK flow
  NOX_COMPUTE: import.meta.env.VITE_NOX_COMPUTE_ADDRESS || '0xd464B198f06756a1d00be223634b85E0a731c229',
} as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const ZERO_HANDLE = (`0x${'0'.repeat(64)}`) as const;

export const DEMO_CONFIDENTIAL_FLOWS_ENABLED =
  import.meta.env.VITE_ENABLE_DEMO_CONFIDENTIAL_FLOWS === 'true';

// ─── NoxPay ABI (simplified for frontend interaction) ──────
export const NOXPAY_ABI = [
  // View functions
  {
    name: 'getPublicStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_totalDistributed', type: 'uint256' },
      { name: '_paymentCount', type: 'uint256' },
      { name: '_uniqueRecipients', type: 'uint256' },
    ],
  },
  {
    name: 'treasury',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'isRecipient',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'recipientPaymentCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getConfidentialBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'handle', type: 'bytes32' }],
  },
  {
    name: 'vestingScheduleCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'vestingSchedules',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint256' },
    ],
    outputs: [
      { name: 'totalAmount', type: 'uint256' },
      { name: 'claimedAmount', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'encryptedTotal', type: 'bytes32' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'getVestedAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'scheduleId', type: 'uint256' },
    ],
    outputs: [{ name: 'vestedAmount', type: 'uint256' }],
  },
  {
    name: 'hasValidAccess',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'granter', type: 'address' },
      { name: 'grantId', type: 'uint256' },
    ],
    outputs: [{ name: 'hasAccess', type: 'bool' }],
  },
  {
    name: 'viewAccessGrantCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'viewAccessGrants',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint256' },
    ],
    outputs: [
      { name: 'viewer', type: 'address' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'balanceHandle', type: 'bytes32' },
    ],
  },
  // Write functions
  {
    name: 'shieldTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'handle', type: 'bytes32' }],
  },
  {
    name: 'sendConfidentialReward',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
      { name: 'publicAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'sendBatchRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'encryptedAmounts', type: 'bytes32[]' },
      { name: 'inputProofs', type: 'bytes[]' },
      { name: 'publicAmounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'createVestingSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
      { name: 'publicAmount', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'claimVested',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'scheduleId', type: 'uint256' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'grantViewAccess',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'viewer', type: 'address' },
      { name: 'duration', type: 'uint256' },
      { name: 'balanceHandle', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'revokeViewAccess',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'grantId', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    name: 'TokensShielded',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'RewardSent',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'publicAggregate', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BatchPaymentExecuted',
    type: 'event',
    inputs: [
      { name: 'treasury', type: 'address', indexed: true },
      { name: 'recipientCount', type: 'uint256', indexed: false },
      { name: 'totalPublicAmount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─── Confidential Token ABI (for unwrap) ────────────────────
export const CONFIDENTIAL_TOKEN_ABI = [
  {
    name: 'confidentialBalanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'unwrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [{ name: 'requestId', type: 'bytes32' }],
  },
  {
    name: 'finalizeUnwrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'unwrapAmount', type: 'bytes32' },
      { name: 'decryptionProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'UnwrapRequested',
    type: 'event',
    inputs: [
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'amount', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'UnwrapFinalized',
    type: 'event',
    inputs: [
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'encryptedAmount', type: 'bytes32', indexed: false },
      { name: 'cleartextAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const NOX_COMPUTE_ABI = [
  {
    name: 'addViewer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'handle', type: 'bytes32' },
      { name: 'viewer', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'isViewer',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'handle', type: 'bytes32' },
      { name: 'viewer', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ─── ERC-20 ABI (for approve) ──────────────────────────────
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;
