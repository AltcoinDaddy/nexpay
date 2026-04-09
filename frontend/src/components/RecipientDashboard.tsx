import { motion } from 'framer-motion';
import {
  EyeOff, Lock, Unlock, Download, RefreshCw,
  Clock, Info
} from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, useReadContract, useReadContracts, useWalletClient, useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, NOXPAY_ABI, ZERO_ADDRESS } from '../config/contracts';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import { useContractConfig } from '../hooks/useContractConfig';
import { useState } from 'react';
import { createViemHandleClient } from '@iexec-nox/handle';
import toast from 'react-hot-toast';

type VestingScheduleResult = readonly [bigint, bigint, bigint, bigint, string, boolean];

function formatCurrencyAmount(value: bigint, decimals: number) {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortHandle(handle?: string) {
  if (!handle) return 'No encrypted balance yet';
  return `${handle.slice(0, 10)}...${handle.slice(-8)}`;
}

function isVestingScheduleResult(value: unknown): value is VestingScheduleResult {
  return Array.isArray(value) && value.length === 6;
}

function readBigIntResult(value: unknown) {
  return typeof value === 'bigint' ? value : 0n;
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

function getDecryptErrorMessage(error: unknown) {
  const rawMessage = extractRawErrorMessage(error);
  const lower = rawMessage.toLowerCase();
  const cleaned = cleanErrorMessage(rawMessage);

  if (!rawMessage) {
    return 'Decrypt failed. Check the wallet signature prompt and try again.';
  }
  if (lower.includes('user rejected')) {
    return 'Decrypt was cancelled in your wallet.';
  }
  if (lower.includes('handle chainid')) {
    return 'Decrypt failed because this balance handle was not created for Arbitrum Sepolia.';
  }
  if (
    lower.includes('object not found') ||
    lower.includes('storage error') ||
    lower.includes('unexpected gateway response 404')
  ) {
    return 'Decrypt is not ready yet because the Nox gateway has not indexed this balance handle. Wait a bit and try again.';
  }
  if (lower.includes('not allowed') || lower.includes('viewer') || lower.includes('acl')) {
    return 'Decrypt failed because this wallet does not currently have permission to view that handle.';
  }
  if (lower.includes('unsupported chain') || lower.includes('chain mismatch')) {
    return 'Decrypt failed because the wallet is not connected to the expected Arbitrum Sepolia chain.';
  }

  return cleaned.length > 0 && cleaned.length <= 220
    ? `Decrypt failed: ${cleaned}`
    : 'Decrypt failed. Open the browser console for the full SDK or RPC error.';
}

function getClaimErrorMessage(error: unknown) {
  const rawMessage = extractRawErrorMessage(error);
  const lower = rawMessage.toLowerCase();
  const cleaned = cleanErrorMessage(rawMessage);

  if (!rawMessage) {
    return 'Claim failed. Check the wallet prompt and try again.';
  }
  if (lower.includes('user rejected')) {
    return 'Claim was cancelled in your wallet.';
  }
  if (lower.includes('nothingtoclaim')) {
    return 'Claim failed because there is nothing vested to claim yet.';
  }
  if (lower.includes('vestingnotactive')) {
    return 'Claim failed because this vesting schedule is no longer active.';
  }

  return cleaned.length > 0 && cleaned.length <= 220
    ? `Claim failed: ${cleaned}`
    : 'Claim failed. Open the browser console to inspect the full revert reason.';
}

export function RecipientDashboard() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { decimals, symbol } = useTokenMetadata();
  const contractConfig = useContractConfig();
  const hasContractConfig = CONTRACTS.NOXPAY !== ZERO_ADDRESS;

  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const { writeContractAsync } = useWriteContract();

  const { data: balanceHandle } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    abi: NOXPAY_ABI,
    functionName: 'getConfidentialBalance',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContractConfig) },
  });

  const { data: paymentCountData } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    abi: NOXPAY_ABI,
    functionName: 'recipientPaymentCount',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContractConfig) },
  });

  const { data: vestingCountData } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    abi: NOXPAY_ABI,
    functionName: 'vestingScheduleCount',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContractConfig) },
  });

  const scheduleIndexes = Array.from(
    { length: Math.min(Number(vestingCountData ?? 0n), 5) },
    (_, index) => BigInt(index)
  );

  const { data: vestingScheduleData } = useReadContracts({
    contracts: address
      ? scheduleIndexes.map((scheduleId) => ({
          address: CONTRACTS.NOXPAY as `0x${string}`,
          abi: NOXPAY_ABI,
          functionName: 'vestingSchedules',
          args: [address, scheduleId],
        }))
      : [],
    query: { enabled: Boolean(address && scheduleIndexes.length > 0 && hasContractConfig) },
  });

  const { data: vestedAmountData } = useReadContracts({
    contracts: address
      ? scheduleIndexes.map((scheduleId) => ({
          address: CONTRACTS.NOXPAY as `0x${string}`,
          abi: NOXPAY_ABI,
          functionName: 'getVestedAmount',
          args: [address, scheduleId],
        }))
      : [],
    query: { enabled: Boolean(address && scheduleIndexes.length > 0 && hasContractConfig) },
  });

  const vestingSchedules = scheduleIndexes
    .map((scheduleId, index) => {
      const rawSchedule = vestingScheduleData?.[index]?.result;
      if (!isVestingScheduleResult(rawSchedule)) {
        return null;
      }

      const vestedAmount = readBigIntResult(vestedAmountData?.[index]?.result);
      const totalAmount = rawSchedule[0];
      const claimedAmount = rawSchedule[1];
      const claimableBigInt = vestedAmount - claimedAmount;
      const startTime = Number(rawSchedule[2]);
      const duration = Number(rawSchedule[3]);
      const isActive = rawSchedule[5];
      const progress = totalAmount === 0n ? 0 : Number((vestedAmount * 100n) / totalAmount);
      const endTime = startTime + duration;
      const daysLeft = Math.max(Math.ceil((endTime * 1000 - Date.now()) / (1000 * 60 * 60 * 24)), 0);

      return {
        id: Number(scheduleId),
        total: formatCurrencyAmount(totalAmount, decimals),
        claimed: formatCurrencyAmount(claimedAmount, decimals),
        vested: formatCurrencyAmount(vestedAmount, decimals),
        claimableBigInt,
        progress: Math.min(progress, 100),
        daysLeft,
        active: isActive,
      };
    })
    .filter((schedule): schedule is NonNullable<typeof schedule> => schedule !== null);

  const paymentCount = Number(paymentCountData ?? 0n).toLocaleString();
  const zeroHandle = `0x${'0'.repeat(64)}`;
  const hasEncryptedBalance = Boolean(balanceHandle && balanceHandle !== zeroHandle);

  const handleDecryptBalance = async () => {
    if (!walletClient || !balanceHandle) return;
    try {
      setIsDecrypting(true);
      const handleClient = await createViemHandleClient(walletClient as any);
      const { value } = await handleClient.decrypt(balanceHandle as `0x${string}`);
      setDecryptedBalance(formatCurrencyAmount(BigInt(value), decimals));
      toast.success('Balance decrypted locally via TEE!');
    } catch (e) {
      console.error('Decryption failed:', e);
      toast.error(getDecryptErrorMessage(e));
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleClaimVested = async (scheduleId: number, claimableBigInt: bigint) => {
    if (!walletClient || !publicClient) return;
    if (claimableBigInt <= 0n) {
      toast.error('No tokens available to claim right now');
      return;
    }
    
    try {
      setClaimingId(scheduleId);
      const handleClient = await createViemHandleClient(walletClient as any);
      
      const { handle, handleProof } = await handleClient.encryptInput(
        claimableBigInt,
        'uint256',
        CONTRACTS.NOXPAY
      );

      const hash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'claimVested',
        args: [
          BigInt(scheduleId),
          handle as `0x${string}`,
          handleProof as `0x${string}`
        ],
        ...contractConfig
      });
      await publicClient.waitForTransactionReceipt({ hash });
      
      toast.success('Successfully claimed vested tokens!');
    } catch (e) {
      console.error('Claiming failed:', e);
      toast.error(getClaimErrorMessage(e));
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <EyeOff className="w-5 h-5 text-nox-cyan" />
          <span className="privacy-badge">PRIVATE VIEW</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          My Private Rewards
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="glass-card p-6 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 0%, #00E5CC, transparent 60%)',
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-nox-lightgray">
                  Confidential Balance
                </span>
                <div className="privacy-badge">
                  <Lock className="w-3 h-3" />
                  Encrypted
                </div>
              </div>

              <div className="mb-2">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-nox-cyan mb-1 break-all">
                  {decryptedBalance !== null
                    ? `$${decryptedBalance} ${symbol}`
                    : hasEncryptedBalance 
                      ? shortHandle(balanceHandle) 
                      : '$0.00'}
                </p>
                <p className="text-sm text-nox-lightgray">
                  {decryptedBalance !== null
                    ? 'Actual balance decrypted locally.'
                    : hasEncryptedBalance
                      ? 'Encrypted balance handle loaded from the contract.'
                      : 'No encrypted balance handle found for this wallet yet.'}
                </p>
              </div>

              <button
                onClick={handleDecryptBalance}
                disabled={isDecrypting || !hasEncryptedBalance || !walletClient}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  hasEncryptedBalance && walletClient && !isDecrypting
                    ? 'bg-nox-cyan/20 text-nox-cyan border border-nox-cyan/40 hover:bg-nox-cyan/30 cursor-pointer'
                    : 'bg-nox-cyan/10 text-nox-cyan border border-nox-cyan/20 opacity-70 cursor-not-allowed'
                }`}
              >
                {isDecrypting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Decrypting via TEE...</>
                ) : (
                  <><Unlock className="w-4 h-4" /> Decrypt Balance</>
                )}
              </button>

              <div className="mt-4 pt-4 border-t border-nox-border/50 space-y-3">
                <div>
                  <p className="text-xs text-nox-lightgray">Connected Wallet</p>
                  <p className="text-sm font-mono text-white truncate">
                    {address || '0x...'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-nox-lightgray">Payments Recorded</p>
                  <p className="text-lg font-mono text-white">{paymentCount}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {vestingSchedules.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-card p-6 mt-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-nox-gold" />
                <span className="text-sm font-semibold text-white">Vesting Schedules</span>
              </div>

              <div className="space-y-5">
                {vestingSchedules.map((schedule) => (
                  <div key={schedule.id}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-nox-lightgray">Vested / Total</span>
                      <span className="font-mono">
                        <span className="text-nox-success">{symbol} {schedule.vested}</span>
                        <span className="text-nox-lightgray"> / </span>
                        <span className="text-white">{symbol} {schedule.total}</span>
                      </span>
                    </div>

                    <div className="h-3 rounded-full bg-nox-dark overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${schedule.progress}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-nox-gold to-nox-deepgold relative"
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg" />
                      </motion.div>
                    </div>

                    <div className="flex justify-between text-xs text-nox-lightgray mb-4">
                      <span>{schedule.progress}% vested</span>
                      <span>{schedule.daysLeft} days remaining</span>
                    </div>

                    <div className="mb-3 rounded-lg border border-nox-border/40 bg-nox-dark/30 p-3 text-xs text-nox-lightgray">
                      Claimed so far: {symbol} {schedule.claimed}
                      {!schedule.active && <span className="ml-2 text-nox-success">Completed</span>}
                    </div>

                    <button
                      onClick={() => handleClaimVested(schedule.id, schedule.claimableBigInt)}
                      disabled={claimingId !== null || !schedule.active || schedule.claimableBigInt <= 0n}
                      className={`btn-gold w-full flex items-center justify-center gap-2 py-2.5 text-sm transition-all ${
                        (!schedule.active || schedule.claimableBigInt <= 0n) ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      {claimingId === schedule.id ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Claiming...</>
                      ) : (
                        <><Download className="w-4 h-4" /> Claim Vested Tokens</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                Private Activity
              </h3>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-nox-lightgray"
                disabled
              >
                <RefreshCw className="w-4 h-4" />
                Live Indexing Pending
              </button>
            </div>

            <div className="p-4 rounded-xl bg-nox-cyan/5 border border-nox-cyan/10 mb-5">
              <p className="text-sm text-nox-cyan flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                This panel reads your encrypted balance handle, payment count, and vesting state directly from the contract.
                Decryption happens client-side through the Nox SDK when the handle is available through the gateway.
              </p>
            </div>

            <div className="rounded-xl border border-nox-border/30 bg-nox-dark/30 p-5">
              <p className="text-sm text-white mb-2">
                Current view
              </p>
              <p className="text-sm text-nox-lightgray leading-relaxed">
                Recipient counters and vesting schedules are loaded on-chain, while confidential values remain encrypted until
                you decrypt them from your wallet session.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
