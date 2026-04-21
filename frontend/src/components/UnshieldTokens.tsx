import { useState } from 'react';
import { motion } from 'framer-motion';
import { Unlock, ArrowUpRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAccount, usePublicClient, useWriteContract, useWalletClient } from 'wagmi';
import { decodeEventLog, parseUnits, type Hex } from 'viem';
import { CONTRACTS, CONFIDENTIAL_TOKEN_ABI, ZERO_ADDRESS } from '../config/contracts';
import { useContractConfig } from '../hooks/useContractConfig';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import toast from 'react-hot-toast';
import { createViemHandleClient } from '@iexec-nox/handle';

type UnshieldStep = 'idle' | 'encrypting' | 'unwrapping' | 'finalizing' | 'done' | 'finalizeError';

type TopicLog = {
  data: Hex;
  topics: readonly [Hex, ...Hex[]];
};

type UnwrapRequestedLog = {
  eventName: 'UnwrapRequested';
  args: {
    amount: Hex;
  };
};

function hasTopics(log: { data: Hex }): log is TopicLog {
  const topics = (log as { topics?: unknown }).topics;
  return Array.isArray(topics) && topics.length > 0;
}

function isUnwrapRequestedLog(decoded: unknown): decoded is UnwrapRequestedLog {
  const event = decoded as {
    eventName?: unknown;
    args?: {
      amount?: unknown;
    };
  };

  return (
    event.eventName === 'UnwrapRequested' &&
    typeof event.args?.amount === 'string' &&
    event.args.amount.startsWith('0x')
  );
}

function getUnshieldErrorMessage(error: unknown) {
  const err = error as {
    shortMessage?: string;
    details?: string;
    message?: string;
    cause?: { shortMessage?: string; details?: string; message?: string };
  };
  const rawMessage =
    err?.shortMessage ||
    err?.details ||
    err?.cause?.shortMessage ||
    err?.cause?.details ||
    err?.message ||
    err?.cause?.message ||
    '';
  const lower = rawMessage.toLowerCase();

  if (!rawMessage) {
    return 'Unshielding failed. Check your wallet prompt and try again.';
  }
  if (lower.includes('user rejected')) {
    return 'Unshielding was cancelled in your wallet.';
  }
  if (lower.includes('timeout')) {
    return 'The gateway took too long to return a decryption proof. Please retry finalization.';
  }
  if (lower.includes('object not found') || lower.includes('storage error')) {
    return 'The unwrap handle is not available from the Nox gateway yet. Wait a bit and retry finalization.';
  }

  return rawMessage.replace(/^error:\s*/i, '').trim();
}

export function UnshieldTokens() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<UnshieldStep>('idle');
  const [finalizeHandle, setFinalizeHandle] = useState<Hex | null>(null);
  const contractConfig = useContractConfig();
  const publicClient = usePublicClient();
  const { decimals, symbol, hasTokenConfig } = useTokenMetadata();
  const hasContractConfig = CONTRACTS.CONFIDENTIAL_TOKEN !== ZERO_ADDRESS;

  const { writeContractAsync, isPending } = useWriteContract();

  const finalizeUnwrap = async (
    handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
    unwrapHandle: Hex
  ) => {
    setStep('finalizing');

    let decryptionProof: Hex | undefined;
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await Promise.race([
          handleClient.publicDecrypt(unwrapHandle),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('publicDecrypt timeout')), 15_000);
          }),
        ]);
        decryptionProof = result.decryptionProof as Hex;
        break;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }

    if (!decryptionProof) {
      throw new Error('Missing decryption proof');
    }

    const finalizeHash = await writeContractAsync({
      address: CONTRACTS.CONFIDENTIAL_TOKEN as `0x${string}`,
      abi: CONFIDENTIAL_TOKEN_ABI,
      functionName: 'finalizeUnwrap',
      args: [unwrapHandle, decryptionProof],
      ...contractConfig,
    });

    await publicClient!.waitForTransactionReceipt({ hash: finalizeHash });
    setFinalizeHandle(null);
    setStep('done');
  };

  const handleUnshield = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!address || !publicClient || !hasContractConfig || !hasTokenConfig || !walletClient) {
      toast.error('Connect your wallet and configure the contract addresses before unshielding.');
      return;
    }

    let nextFinalizeHandle: Hex | null = null;

    try {
      setStep('encrypting');
      const parsedAmount = parseUnits(amount, decimals);
      
      const handleClient = await createViemHandleClient(walletClient as any);
      
      const { handle, handleProof } = await handleClient.encryptInput(
        parsedAmount,
        'uint256',
        CONTRACTS.CONFIDENTIAL_TOKEN as `0x${string}`
      );

      setStep('unwrapping');

      const unwrapHash = await writeContractAsync({
        address: CONTRACTS.CONFIDENTIAL_TOKEN as `0x${string}`,
        abi: CONFIDENTIAL_TOKEN_ABI,
        functionName: 'unwrap',
        args: [
          address,
          address,
          handle as `0x${string}`,
          handleProof as `0x${string}`
        ],
        ...contractConfig,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: unwrapHash });

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== CONTRACTS.CONFIDENTIAL_TOKEN.toLowerCase()) {
          continue;
        }
        if (!hasTopics(log)) {
          continue;
        }

        try {
          const decoded = decodeEventLog({
            abi: CONFIDENTIAL_TOKEN_ABI,
            data: log.data,
            topics: log.topics,
          });

          if (isUnwrapRequestedLog(decoded)) {
            nextFinalizeHandle = decoded.args.amount;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!nextFinalizeHandle) {
        throw new Error('Could not find the UnwrapRequested event for finalization');
      }

      setFinalizeHandle(nextFinalizeHandle);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await finalizeUnwrap(handleClient, nextFinalizeHandle);

      setAmount('');
      toast.success(`Unshielded ${amount} ${symbol} back to the underlying token.`);
    } catch (err: unknown) {
      console.error('Unwrap error:', err);
      const message = getUnshieldErrorMessage(err);
      if (nextFinalizeHandle) {
        setStep('finalizeError');
        toast.error(`Unwrap submitted, but finalization failed. ${message}`);
      } else {
        setStep('idle');
        toast.error(message);
      }
    }
  };

  const handleRetryFinalize = async () => {
    if (!walletClient || !finalizeHandle || !publicClient) {
      return;
    }

    try {
      const handleClient = await createViemHandleClient(walletClient as any);
      await finalizeUnwrap(handleClient, finalizeHandle);
      toast.success('Unwrap finalization completed.');
    } catch (error) {
      console.error('Finalize unwrap error:', error);
      toast.error(getUnshieldErrorMessage(error));
      setStep('finalizeError');
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="flex items-center gap-3 mb-6 mt-6">
        <div className="flex items-center gap-2">
          <Unlock className="w-5 h-5 text-nox-cyan" />
          <span className="text-xs font-semibold text-nox-cyan bg-nox-cyan/10 border border-nox-cyan/20 px-3 py-1 rounded-full">
            UNSHIELDING
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Token Offboarding
        </h2>
      </div>

      <div className="glass-card p-6 sm:p-8 max-w-2xl border-nox-cyan/20">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nox-cyan/20 to-nox-cyan/5 flex items-center justify-center flex-shrink-0 border border-nox-cyan/30">
            <ArrowUpRight className="w-6 h-6 text-nox-cyan" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Unwrap Confidential Token → ERC-20
            </h3>
            <p className="text-sm text-nox-lightgray">
              Convert your confidential ERC-7984 balance back to standard tokens.
              This follows the full unwrap flow: encrypted request, on-chain unwrap, then gateway-backed finalization.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nox-lightgray mb-2">
              Amount to Unshield
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="nox-input pr-24 text-lg font-mono focus:border-nox-cyan/50 focus:ring-nox-cyan/20"
                min="0"
                step="0.01"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-nox-lightgray text-sm font-medium">
                {symbol}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['100', '500', '1000', '5000'].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-nox-lightgray border border-nox-border hover:border-nox-cyan hover:text-nox-cyan transition-all cursor-pointer"
              >
                {Number(val).toLocaleString()}
              </button>
            ))}
          </div>

          {step !== 'idle' && (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-nox-dark/50 border border-nox-cyan/20">
              <StepIndicator
                active={step === 'encrypting'}
                completed={step === 'unwrapping' || step === 'done'}
                loading={step === 'encrypting'}
                label="Encrypt unwrap request amount (via TEE)"
              />
              <StepIndicator
                active={step === 'unwrapping'}
                completed={step === 'finalizing' || step === 'done' || step === 'finalizeError'}
                loading={isPending && step === 'unwrapping'}
                label="Submit unwrap transaction on-chain"
              />
              <StepIndicator
                active={step === 'finalizing'}
                completed={step === 'done'}
                loading={step === 'finalizing'}
                label={step === 'finalizeError'
                  ? 'Finalization needs to be retried.'
                  : 'Finalize unwrap with a public decryption proof'}
              />
            </div>
          )}

          <button
            onClick={handleUnshield}
            disabled={!amount || step === 'encrypting' || step === 'unwrapping' || step === 'finalizing' || !address || !hasContractConfig}
            className="btn-cyan w-full flex items-center justify-center gap-2 text-base py-3.5"
          >
            {step === 'encrypting' || step === 'unwrapping' || step === 'finalizing' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {step === 'encrypting'
                  ? 'Encrypting Request...'
                  : step === 'unwrapping'
                    ? 'Submitting Unwrap...'
                    : 'Finalizing Unwrap...'}
              </>
            ) : step === 'done' ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Unwrap Completed!
              </>
            ) : (
              <>
                <Unlock className="w-5 h-5" />
                Unshield Tokens
              </>
            )}
          </button>

          {step === 'finalizeError' && finalizeHandle && (
            <button
              onClick={handleRetryFinalize}
              disabled={!walletClient}
              className="w-full rounded-xl border border-nox-cyan/30 bg-nox-cyan/10 py-3 text-sm font-semibold text-nox-cyan transition-all hover:bg-nox-cyan/15 cursor-pointer"
            >
              Retry Finalization
            </button>
          )}

          {!address && (
            <p className="text-center text-sm text-nox-lightgray">
              Connect your wallet to unshield tokens
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function StepIndicator({ active, completed, loading, label }: {
  active: boolean; completed: boolean; loading: boolean; label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {completed ? (
        <CheckCircle2 className="w-5 h-5 text-nox-cyan flex-shrink-0" />
      ) : loading ? (
        <Loader2 className="w-5 h-5 text-nox-cyan animate-spin flex-shrink-0" />
      ) : active ? (
        <AlertCircle className="w-5 h-5 text-nox-cyan flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border border-nox-border flex-shrink-0" />
      )}
      <span className={`text-sm ${completed ? 'text-nox-cyan' : active || loading ? 'text-white' : 'text-nox-lightgray'}`}>
        {label}
      </span>
    </div>
  );
}
