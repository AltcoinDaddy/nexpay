import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, UserPlus, Trash2, Loader2, Shield, Clock, Info } from 'lucide-react';
import { isAddress } from 'viem';
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { CONTRACTS, NOXPAY_ABI, ZERO_ADDRESS } from '../config/contracts';
import { useContractConfig } from '../hooks/useContractConfig';
import toast from 'react-hot-toast';

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function SelectiveDisclosure() {
  const { address } = useAccount();
  const [viewerAddress, setViewerAddress] = useState('');
  const [accessDuration, setAccessDuration] = useState('24');
  const [isOpen, setIsOpen] = useState(false);
  const contractConfig = useContractConfig();
  const publicClient = usePublicClient();
  const hasContractConfig = CONTRACTS.NOXPAY !== ZERO_ADDRESS;

  const { writeContractAsync: writeContractAsync, isPending } = useWriteContract();

  const { data: balanceHandle } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    abi: NOXPAY_ABI,
    functionName: 'getConfidentialBalance',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContractConfig) },
  });

  const { data: grantCountData } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    abi: NOXPAY_ABI,
    functionName: 'viewAccessGrantCount',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContractConfig) },
  });

  const grantIndexes = Array.from(
    { length: Math.min(Number(grantCountData ?? 0n), 10) },
    (_, index) => BigInt(index)
  );

  const { data: grantsData } = useReadContracts({
    contracts: address
      ? grantIndexes.map((grantId) => ({
          address: CONTRACTS.NOXPAY as `0x${string}`,
          abi: NOXPAY_ABI,
          functionName: 'viewAccessGrants',
          args: [address, grantId],
        }))
      : [],
    query: { enabled: Boolean(address && grantIndexes.length > 0 && hasContractConfig) },
  });

  const activeGrants = grantIndexes
    .map((grantId, index) => {
      const rawGrant = grantsData?.[index]?.result;
      if (!rawGrant) {
        return null;
      }

      const viewer = rawGrant[0] as string;
      const expiresAt = Number(rawGrant[1]);
      const active = Boolean(rawGrant[2]);

      return {
        id: Number(grantId),
        viewer,
        expiresAt,
        active,
      };
    })
    .filter((grant): grant is NonNullable<typeof grant> => grant !== null && grant.active)
    .sort((left, right) => right.expiresAt - left.expiresAt);
  const zeroHandle = `0x${'0'.repeat(64)}`;
  const hasValidBalanceHandle = Boolean(balanceHandle && balanceHandle !== zeroHandle);

  const handleGrantAccess = async () => {
    if (!viewerAddress) {
      toast.error('Enter an auditor wallet address');
      return;
    }
    if (!isAddress(viewerAddress)) {
      toast.error('Enter a valid auditor wallet address');
      return;
    }
    if (!address || !publicClient || !hasContractConfig) {
      toast.error('Connect your wallet and configure the contract first');
      return;
    }
    if (!hasValidBalanceHandle || !balanceHandle) {
      toast.error('This wallet does not have a confidential balance handle to share yet');
      return;
    }

    try {
      const durationSeconds = BigInt(parseInt(accessDuration, 10) * 3600);

      const hash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'grantViewAccess',
        args: [
          viewerAddress as `0x${string}`,
          durationSeconds,
          balanceHandle,
        ],
        ...contractConfig,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      toast.success('View access granted');
      setViewerAddress('');
    } catch (error) {
      console.error('Grant access error:', error);
      toast.error('Failed to grant access');
    }
  };

  const handleRevokeAccess = async (grantId: number) => {
    if (!publicClient || !hasContractConfig) {
      toast.error('Configure the contract before revoking access');
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'revokeViewAccess',
        args: [BigInt(grantId)],
        ...contractConfig,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      toast.success('Access revoked');
    } catch (error) {
      console.error('Revoke access error:', error);
      toast.error('Failed to revoke access');
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
            Grant temporary view access for compliance & auditing
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
              This uses the connected wallet&apos;s current confidential balance handle from NoxPay instead of a placeholder.
            </p>

            <div className="mb-4 rounded-xl border border-nox-cyan/10 bg-nox-cyan/5 p-3">
              <p className="text-xs text-nox-cyan flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Revocation is tracked in NoxPay and also attempts a token-side ACL revoke when the underlying token supports it.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-nox-lightgray mb-1.5">
                  Viewer Address (auditor wallet)
                </label>
                <input
                  type="text"
                  value={viewerAddress}
                  onChange={(e) => setViewerAddress(e.target.value)}
                  placeholder="0x..."
                  className="nox-input font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nox-lightgray mb-1.5">
                  Access Duration
                </label>
                <div className="flex gap-2">
                  {['1', '6', '24', '72', '168'].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => setAccessDuration(hours)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        accessDuration === hours
                          ? 'bg-nox-cyan/10 text-nox-cyan border border-nox-cyan/30'
                          : 'text-nox-lightgray border border-nox-border hover:border-nox-cyan/30'
                      }`}
                    >
                      {parseInt(hours, 10) < 24
                        ? `${hours}h`
                        : `${parseInt(hours, 10) / 24}d`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGrantAccess}
                disabled={isPending || !address || !hasContractConfig}
                className="btn-cyan w-full flex items-center justify-center gap-2 py-3"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Granting...</>
                ) : (
                  <><Shield className="w-4 h-4" /> Grant Temporary Access</>
                )}
              </button>
            </div>
          </div>

          <div className="glass-card p-6 max-w-2xl">
            <h3 className="text-base font-semibold text-white mb-4">
              Active Access Grants
            </h3>

            {activeGrants.length === 0 ? (
              <p className="text-sm text-nox-lightgray">
                No active grants found for this wallet.
              </p>
            ) : (
              <div className="space-y-3">
                {activeGrants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-nox-dark/40 border border-nox-border/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-nox-cyan/10 flex items-center justify-center flex-shrink-0">
                        <KeyRound className="w-4 h-4 text-nox-cyan" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            Auditor
                          </span>
                          <span className="text-[10px] font-mono text-nox-lightgray">
                            {shortenAddress(grant.viewer)}
                          </span>
                        </div>
                        <span className="text-xs text-nox-lightgray flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires: {new Date(grant.expiresAt * 1000).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeAccess(grant.id)}
                      disabled={isPending}
                      className="p-2 text-nox-lightgray hover:text-red-400 transition-colors cursor-pointer"
                      title="Revoke Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
