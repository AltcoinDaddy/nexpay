import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowDownUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS, NOXPAY_ABI, ERC20_ABI, ZERO_ADDRESS } from '../config/contracts';
import { useContractConfig } from '../hooks/useContractConfig';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import toast from 'react-hot-toast';

export function ShieldTokens() {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'idle' | 'approving' | 'shielding' | 'done'>('idle');
  const contractConfig = useContractConfig();
  const publicClient = usePublicClient();
  const { decimals, symbol, hasTokenConfig } = useTokenMetadata();
  const hasContractConfig =
    CONTRACTS.NOXPAY !== ZERO_ADDRESS && CONTRACTS.UNDERLYING_TOKEN !== ZERO_ADDRESS;

  const { writeContractAsync: writeContractAsync, isPending } = useWriteContract();

  const handleShield = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!address || !publicClient || !hasContractConfig || !hasTokenConfig) {
      toast.error('Configure the token and contract addresses before shielding.');
      return;
    }

    try {
      const parsedAmount = parseUnits(amount, decimals);
      setStep('approving');

      // Step 1: Approve ERC-20 spending
      const approveHash = await writeContractAsync({
        address: CONTRACTS.UNDERLYING_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.NOXPAY as `0x${string}`, parsedAmount],
        ...contractConfig,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      toast.success('Approval confirmed. Shielding tokens...');
      setStep('shielding');

      // Step 2: Shield (wrap into confidential token)
      const shieldHash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'shieldTokens',
        args: [parsedAmount],
        ...contractConfig,
      });
      await publicClient.waitForTransactionReceipt({ hash: shieldHash });

      setStep('done');
      toast.success(`Successfully shielded ${amount} ${symbol}.`);
    } catch (err: unknown) {
      console.error('Shield error:', err);
      toast.error('Shielding failed. Check your wallet or console for details.');
      setStep('idle');
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
          <Shield className="w-5 h-5 text-nox-gold" />
          <span className="text-xs font-semibold text-nox-gold bg-nox-gold/10 border border-nox-gold/20 px-3 py-1 rounded-full">
            SHIELDING
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Token Onboarding
        </h2>
      </div>

      <div className="glass-card p-6 sm:p-8 max-w-2xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nox-gold/20 to-nox-deepgold/10 flex items-center justify-center flex-shrink-0">
            <ArrowDownUp className="w-6 h-6 text-nox-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Wrap ERC-20 → Confidential Token
            </h3>
            <p className="text-sm text-nox-lightgray">
              Convert your standard tokens into their confidential ERC-7984 version.
              Your balance becomes encrypted and private.
            </p>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nox-lightgray mb-2">
              Amount to Shield
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="nox-input pr-24 text-lg font-mono"
                min="0"
                step="0.01"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-nox-lightgray text-sm font-medium">
                {symbol}
              </span>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 flex-wrap">
            {['100', '500', '1000', '5000'].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-nox-lightgray border border-nox-border hover:border-nox-gold hover:text-nox-gold transition-all cursor-pointer"
              >
                {Number(val).toLocaleString()}
              </button>
            ))}
          </div>

          {/* Status */}
          {step !== 'idle' && (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-nox-dark/50 border border-nox-border/50">
              <StepIndicator
                active={step === 'approving'}
                completed={step === 'shielding' || step === 'done'}
                loading={isPending && step === 'approving'}
                label="Approve ERC-20 spending"
              />
              <StepIndicator
                active={step === 'shielding'}
                completed={step === 'done'}
                loading={isPending && step === 'shielding'}
                label="Shield tokens into confidential wrapper"
              />
              <StepIndicator
                active={false}
                completed={step === 'done'}
                loading={false}
                label="Balance now encrypted on-chain"
              />
            </div>
          )}

          {/* Shield Button */}
          <button
            onClick={handleShield}
            disabled={!amount || step === 'approving' || step === 'shielding' || !address || !hasContractConfig}
            className="btn-gold w-full flex items-center justify-center gap-2 text-base py-3.5"
          >
            {step === 'approving' || step === 'shielding' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {step === 'approving' ? 'Approving...' : 'Shielding...'}
              </>
            ) : step === 'done' ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Tokens Shielded!
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Shield Tokens
              </>
            )}
          </button>

          {!address && (
            <p className="text-center text-sm text-nox-lightgray">
              Connect your wallet to shield tokens
            </p>
          )}
          {address && !hasContractConfig && (
            <p className="text-center text-sm text-nox-lightgray">
              Add valid token and contract addresses to enable shielding.
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
        <CheckCircle2 className="w-5 h-5 text-nox-success flex-shrink-0" />
      ) : loading ? (
        <Loader2 className="w-5 h-5 text-nox-gold animate-spin flex-shrink-0" />
      ) : active ? (
        <AlertCircle className="w-5 h-5 text-nox-gold flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border border-nox-border flex-shrink-0" />
      )}
      <span className={`text-sm ${completed ? 'text-nox-success' : active || loading ? 'text-white' : 'text-nox-lightgray'}`}>
        {label}
      </span>
    </div>
  );
}
