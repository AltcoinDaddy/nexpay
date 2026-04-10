import { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, KeyRound, Loader2, Shield, UserPlus } from 'lucide-react';
import { isAddress } from 'viem';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import {
  CONFIDENTIAL_TOKEN_ABI,
  CONTRACTS,
  NOX_COMPUTE_ABI,
  ZERO_ADDRESS,
  ZERO_HANDLE,
} from '../config/contracts';
import { useContractConfig } from '../hooks/useContractConfig';
import toast from 'react-hot-toast';

function shortenValue(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function extractRawErrorMessage(error: unknown) {
  const err = error as {
    shortMessage?: string;
    details?: string;
    message?: string;
    cause?: { shortMessage?: string; details?: string; message?: string };
  };

  return (
    err?.shortMessage ||
    err?.details ||
    err?.cause?.shortMessage ||
    err?.cause?.details ||
    err?.message ||
    err?.cause?.message ||
    ''
  );
}

function cleanErrorMessage(message: string) {
  return message
    .replace(/^execution reverted:?\s*/i, '')
    .replace(/^reverted with reason string\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function getGrantErrorMessage(error: unknown) {
  const rawMessage = extractRawErrorMessage(error);
  const lower = rawMessage.toLowerCase();
  const cleaned = cleanErrorMessage(rawMessage);

  if (!rawMessage) {
    return 'Grant failed. Check the wallet prompt and try again.';
  }
  if (lower.includes('user rejected')) {
    return 'Granting viewer access was cancelled in your wallet.';
  }
  if (lower.includes('unsupported chain') || lower.includes('chain mismatch')) {
    return 'Grant failed because the wallet is not on Arbitrum Sepolia.';
  }
  if (lower.includes('not a valid') || lower.includes('invalid address')) {
    return 'Grant failed because the viewer address is invalid.';
  }

  return cleaned.length > 0 && cleaned.length <= 220
    ? `Grant failed: ${cleaned}`
    : 'Grant failed. Open the browser console for the full contract or wallet error.';
}

export function SelectiveDisclosure() {
  const { address } = useAccount();
  const [viewerAddress, setViewerAddress] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const contractConfig = useContractConfig();
  const publicClient = usePublicClient();
  const hasConfidentialTokenConfig = CONTRACTS.CONFIDENTIAL_TOKEN !== ZERO_ADDRESS;
  const hasNoxComputeConfig = CONTRACTS.NOX_COMPUTE !== ZERO_ADDRESS;
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: balanceHandle } = useReadContract({
    address: CONTRACTS.CONFIDENTIAL_TOKEN as `0x${string}`,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasConfidentialTokenConfig) },
  });

  const hasValidBalanceHandle = Boolean(balanceHandle && balanceHandle !== ZERO_HANDLE);

  const handleGrantAccess = async () => {
    if (!viewerAddress) {
      toast.error('Enter a viewer wallet address');
      return;
    }
    if (!isAddress(viewerAddress)) {
      toast.error('Enter a valid viewer wallet address');
      return;
    }
    if (!address || !publicClient || !hasConfidentialTokenConfig || !hasNoxComputeConfig) {
      toast.error('Connect your wallet and configure the contracts first');
      return;
    }
    if (!hasValidBalanceHandle || !balanceHandle) {
      toast.error('This wallet does not have a confidential balance handle to share yet');
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.NOX_COMPUTE as `0x${string}`,
        abi: NOX_COMPUTE_ABI,
        functionName: 'addViewer',
        args: [balanceHandle, viewerAddress as `0x${string}`],
        ...contractConfig,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      toast.success('Viewer access granted for the current handle');
      setViewerAddress('');
    } catch (error) {
      console.error('Grant access error:', error);
      toast.error(getGrantErrorMessage(error));
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 mb-4 group cursor-pointer w-full text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nox-cyan/20 to-nox-cyan/5 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-nox-cyan" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-nox-cyan transition-colors">
            Selective Disclosure
          </h2>
          <p className="text-xs text-nox-lightgray">
            Grant direct Nox viewer access to your current confidential balance handle
          </p>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="text-nox-lightgray"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div className="glass-card p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-nox-cyan" />
              <h3 className="text-base font-semibold text-white">
                Grant View Access
              </h3>
            </div>

            <p className="text-sm text-nox-lightgray mb-4">
              This follows the official Nox demo flow. The app reads your current confidential
              balance handle and grants the selected viewer direct access on NoxCompute.
            </p>

            <div className="grid gap-3 mb-4 sm:grid-cols-2">
              <div className="rounded-xl border border-nox-border/40 bg-nox-dark/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-nox-lightgray mb-1">
                  Current Handle
                </p>
                <p className="font-mono text-sm text-white break-all">
                  {hasValidBalanceHandle && balanceHandle
                    ? shortenValue(balanceHandle)
                    : 'No confidential balance yet'}
                </p>
              </div>
              <div className="rounded-xl border border-nox-border/40 bg-nox-dark/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-nox-lightgray mb-1">
                  NoxCompute
                </p>
                <p className="font-mono text-sm text-white break-all">
                  {hasNoxComputeConfig ? shortenValue(CONTRACTS.NOX_COMPUTE) : 'Not configured'}
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-nox-cyan/10 bg-nox-cyan/5 p-3">
              <p className="text-xs text-nox-cyan flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Viewer access is tied to the current handle only. If shielding, claiming, or other
                balance updates create a new handle, grant access again for that new handle.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-nox-lightgray mb-1.5">
                  Viewer Address
                </label>
                <input
                  type="text"
                  value={viewerAddress}
                  onChange={(e) => setViewerAddress(e.target.value)}
                  placeholder="0x..."
                  className="nox-input font-mono text-sm"
                />
              </div>

              <button
                onClick={handleGrantAccess}
                disabled={isPending || !address || !hasValidBalanceHandle || !hasNoxComputeConfig}
                className="btn-cyan w-full flex items-center justify-center gap-2 py-3"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Granting...</>
                ) : (
                  <><Shield className="w-4 h-4" /> Grant Viewer Access</>
                )}
              </button>
            </div>
          </div>

          <div className="glass-card p-6 max-w-2xl">
            <h3 className="text-base font-semibold text-white mb-3">
              How It Works
            </h3>
            <div className="space-y-3 text-sm text-nox-lightgray">
              <p>
                The wallet reads your latest encrypted balance handle directly from the confidential token.
              </p>
              <p>
                When you approve the transaction, the app calls <span className="font-mono text-white">NoxCompute.addViewer(handle, viewer)</span>.
              </p>
              <p>
                This screen no longer keeps a separate in-app grant list, so what you grant here matches the official Nox viewer model more closely.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
