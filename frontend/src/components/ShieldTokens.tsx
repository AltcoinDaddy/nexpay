import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowDownUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { formatUnits, isAddress, parseUnits } from 'viem';
import { arbitrumSepolia } from 'wagmi/chains';
import { CONTRACTS, NOXPAY_ABI, ERC20_ABI, ZERO_ADDRESS } from '../config/contracts';
import { useContractConfig } from '../hooks/useContractConfig';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import toast from 'react-hot-toast';

export function ShieldTokens() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState('');
  const [faucetRecipient, setFaucetRecipient] = useState('');
  const [faucetAmount, setFaucetAmount] = useState('1000');
  const [step, setStep] = useState<'idle' | 'approving' | 'shielding' | 'done'>('idle');
  const [isFunding, setIsFunding] = useState(false);
  const contractConfig = useContractConfig();
  const publicClient = usePublicClient();
  const { decimals, symbol, hasTokenConfig } = useTokenMetadata();
  const hasContractConfig =
    CONTRACTS.NOXPAY !== ZERO_ADDRESS && CONTRACTS.UNDERLYING_TOKEN !== ZERO_ADDRESS;
  const missingConfigEntries = [
    CONTRACTS.NOXPAY === ZERO_ADDRESS ? 'VITE_NOXPAY_ADDRESS' : null,
    CONTRACTS.UNDERLYING_TOKEN === ZERO_ADDRESS ? 'VITE_UNDERLYING_TOKEN_ADDRESS' : null,
    CONTRACTS.CONFIDENTIAL_TOKEN === ZERO_ADDRESS ? 'VITE_CONFIDENTIAL_TOKEN_ADDRESS' : null,
  ].filter(Boolean) as string[];
  const hasCorrectChain = chainId === arbitrumSepolia.id;

  const { writeContractAsync, isPending } = useWriteContract();
  const {
    data: balanceData,
    error: balanceError,
    isLoading: isBalanceLoading,
  } = useReadContract({
    address: CONTRACTS.UNDERLYING_TOKEN as `0x${string}`,
    chainId: arbitrumSepolia.id,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasTokenConfig) },
  });
  const {
    data: allowanceData,
    error: allowanceError,
    isLoading: isAllowanceLoading,
  } = useReadContract({
    address: CONTRACTS.UNDERLYING_TOKEN as `0x${string}`,
    chainId: arbitrumSepolia.id,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.NOXPAY as `0x${string}`] : undefined,
    query: { enabled: Boolean(address && hasContractConfig && hasTokenConfig) },
  });
  const {
    data: treasuryData,
    error: treasuryError,
  } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    chainId: arbitrumSepolia.id,
    abi: NOXPAY_ABI,
    functionName: 'treasury',
    query: { enabled: hasContractConfig },
  });

  const underlyingBalance = balanceData ?? 0n;
  const allowance = allowanceData ?? 0n;
  const treasury = treasuryData;
  const isTreasury = Boolean(
    address &&
    treasury &&
    address.toLowerCase() === treasury.toLowerCase()
  );
  const parsedAmount = safeParseAmount(amount, decimals);
  const hasEnoughBalance = parsedAmount !== null && parsedAmount <= underlyingBalance;
  const needsApproval = parsedAmount !== null && allowance < parsedAmount;
  const balanceLabel = formatDisplayAmount(underlyingBalance, decimals);
  const allowanceLabel = formatDisplayAmount(allowance, decimals);
  const readError = balanceError || allowanceError || treasuryError;

  useEffect(() => {
    if (address) {
      setFaucetRecipient((currentRecipient) => currentRecipient || address);
    }
  }, [address]);

  const handleShield = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!hasCorrectChain) {
      toast.error('Switch your wallet to Arbitrum Sepolia first.');
      return;
    }
    if (!address || !publicClient || !hasContractConfig || !hasTokenConfig) {
      toast.error('Configure the token and contract addresses before shielding.');
      return;
    }

    try {
      const amountToShield = safeParseAmount(amount, decimals);
      if (amountToShield === null || amountToShield <= 0n) {
        toast.error(`Enter a valid ${symbol} amount with at most ${decimals} decimals.`);
        return;
      }
      if (underlyingBalance === 0n) {
        toast.error(`This wallet has no ${symbol} available to shield yet.`);
        return;
      }
      if (amountToShield > underlyingBalance) {
        toast.error(`Insufficient ${symbol} balance. Available: ${balanceLabel} ${symbol}.`);
        return;
      }

      if (allowance < amountToShield) {
        setStep('approving');
        const approveHash = await writeContractAsync({
          address: CONTRACTS.UNDERLYING_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.NOXPAY as `0x${string}`, amountToShield],
          ...contractConfig,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        toast.success('Approval confirmed. Shielding tokens...');
      }

      setStep('shielding');
      const shieldHash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'shieldTokens',
        args: [amountToShield],
        ...contractConfig,
      });
      await publicClient.waitForTransactionReceipt({ hash: shieldHash });

      setStep('done');
      setAmount('');
      toast.success(`Successfully shielded ${formatDisplayAmount(amountToShield, decimals)} ${symbol}.`);
    } catch (err: unknown) {
      console.error('Shield error:', err);
      toast.error(getShieldErrorMessage(err, symbol));
      setStep('idle');
    }
  };

  const handleMintDemoFunds = async () => {
    if (!address || !publicClient || !hasTokenConfig || !hasContractConfig) {
      toast.error('Connect your wallet and configure the demo contracts first.');
      return;
    }
    if (!hasCorrectChain) {
      toast.error('Switch your wallet to Arbitrum Sepolia first.');
      return;
    }
    if (!isTreasury) {
      toast.error('Only the treasury wallet can mint demo funds in this setup.');
      return;
    }
    if (!faucetRecipient || !isAddress(faucetRecipient)) {
      toast.error('Enter a valid recipient address for demo funding.');
      return;
    }

    const mintAmount = safeParseAmount(faucetAmount, decimals);
    if (mintAmount === null || mintAmount <= 0n) {
      toast.error(`Enter a valid demo funding amount in ${symbol}.`);
      return;
    }

    try {
      setIsFunding(true);
      const hash = await writeContractAsync({
        address: CONTRACTS.UNDERLYING_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [faucetRecipient as `0x${string}`, mintAmount],
        ...contractConfig,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`Minted ${formatDisplayAmount(mintAmount, decimals)} ${symbol} to ${shortAddress(faucetRecipient)}.`);
    } catch (err) {
      console.error('Demo funding error:', err);
      toast.error(getMintErrorMessage(err, symbol));
    } finally {
      setIsFunding(false);
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

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoStat
              label={`Wallet ${symbol} Balance`}
              value={isBalanceLoading ? 'Loading...' : `${balanceLabel} ${symbol}`}
            />
            <InfoStat
              label="Approved For Shielding"
              value={isAllowanceLoading ? 'Loading...' : `${allowanceLabel} ${symbol}`}
            />
          </div>

          {hasContractConfig && (
            <div className="rounded-xl border border-nox-cyan/20 bg-nox-cyan/5 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Demo Funding</p>
                  <p className="text-xs text-nox-lightgray mt-1">
                    The live Sepolia demo uses mock {symbol}. The treasury wallet can mint test funds here before shielding.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-nox-cyan bg-nox-cyan/10 border border-nox-cyan/20 px-2.5 py-1 rounded-full whitespace-nowrap">
                  {isTreasury ? 'TREASURY CONNECTED' : 'TREASURY ONLY'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-3">
                <input
                  type="text"
                  value={faucetRecipient}
                  onChange={(e) => setFaucetRecipient(e.target.value)}
                  placeholder="Recipient address"
                  className="nox-input font-mono text-sm"
                />
                <div className="relative">
                  <input
                    type="number"
                    value={faucetAmount}
                    onChange={(e) => setFaucetAmount(e.target.value)}
                    placeholder="1000"
                    className="nox-input pr-20 font-mono text-sm"
                    min="0"
                    step="0.01"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-nox-lightgray text-xs font-medium">
                    {symbol}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {['100', '500', '1000', '5000'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFaucetAmount(val)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-nox-lightgray border border-nox-border hover:border-nox-cyan hover:text-nox-cyan transition-all cursor-pointer"
                  >
                    Mint {Number(val).toLocaleString()}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleMintDemoFunds}
                disabled={!isTreasury || !hasCorrectChain || isFunding}
                className="btn-cyan w-full flex items-center justify-center gap-2 text-sm py-3"
              >
                {isFunding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Minting Demo Funds...
                  </>
                ) : (
                  <>Mint Demo {symbol}</>
                )}
              </button>

              {!isTreasury && treasury && (
                <p className="text-xs text-nox-lightgray">
                  Connect the treasury wallet {shortAddress(treasury)} to mint demo funds from the UI.
                </p>
              )}
            </div>
          )}

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
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-nox-lightgray">
                NoxPay first pulls your underlying token, then wraps it into the confidential token.
              </span>
              <button
                type="button"
                onClick={() => setAmount(formatUnits(underlyingBalance, decimals))}
                disabled={underlyingBalance === 0n}
                className="text-nox-gold hover:text-nox-deepgold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
              >
                Max
              </button>
            </div>
          </div>

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

          {step !== 'idle' && (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-nox-dark/50 border border-nox-border/50">
              <StepIndicator
                active={step === 'approving'}
                completed={step === 'shielding' || step === 'done'}
                loading={isPending && step === 'approving'}
                label={needsApproval ? 'Approve ERC-20 spending' : 'Existing approval is sufficient'}
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

          <button
            onClick={handleShield}
            disabled={
              !amount ||
              step === 'approving' ||
              step === 'shielding' ||
              !address ||
              !hasContractConfig ||
              !hasTokenConfig ||
              !hasCorrectChain ||
              parsedAmount === null ||
              parsedAmount <= 0n ||
              !hasEnoughBalance
            }
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
                {needsApproval ? 'Approve + Shield Tokens' : 'Shield Tokens'}
              </>
            )}
          </button>

          {!address && (
            <p className="text-center text-sm text-nox-lightgray">
              Connect your wallet to shield tokens
            </p>
          )}
          {address && !hasCorrectChain && (
            <p className="text-center text-sm text-nox-lightgray">
              Switch to Arbitrum Sepolia to shield tokens on this deployment.
            </p>
          )}
          {address && !hasContractConfig && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-left">
              <p className="text-sm font-medium text-amber-200">
                This deployment is missing shield contract configuration.
              </p>
              <p className="mt-2 text-sm text-nox-lightgray">
                Wallet balance reads are disabled until the frontend is deployed with the Sepolia contract env vars.
              </p>
              <div className="mt-3 space-y-1 text-xs font-mono text-nox-lightgray break-all">
                <p>NoxPay: {CONTRACTS.NOXPAY}</p>
                <p>Underlying token: {CONTRACTS.UNDERLYING_TOKEN}</p>
                <p>Confidential token: {CONTRACTS.CONFIDENTIAL_TOKEN}</p>
              </div>
              {missingConfigEntries.length > 0 && (
                <p className="mt-3 text-xs text-amber-200">
                  Missing env vars: {missingConfigEntries.join(', ')}
                </p>
              )}
            </div>
          )}
          {address && hasCorrectChain && hasContractConfig && hasTokenConfig && underlyingBalance === 0n && (
            <p className="text-center text-sm text-nox-lightgray">
              This wallet currently has no {symbol} to shield. On the live Sepolia demo, shielding will revert until the wallet receives some underlying tokens first.
            </p>
          )}
          {address && hasCorrectChain && parsedAmount !== null && parsedAmount > underlyingBalance && (
            <p className="text-center text-sm text-nox-lightgray">
              The entered amount is larger than your available {symbol} balance.
            </p>
          )}
          {address && readError && (
            <p className="text-center text-sm text-nox-lightgray">
              The Sepolia balance/allowance lookup failed, so the fallback `0.00` may be misleading. Refresh and make sure the deployment addresses are reachable on Arbitrum Sepolia.
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-nox-border/60 bg-nox-dark/40 px-4 py-3">
      <p className="text-xs text-nox-lightgray mb-1">{label}</p>
      <p className="text-sm font-mono text-white">{value}</p>
    </div>
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

function safeParseAmount(value: string, decimals: number) {
  if (!value) return null;
  try {
    return parseUnits(value, decimals);
  } catch {
    return null;
  }
}

function formatDisplayAmount(value: bigint, decimals: number) {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
    .replace(/^user rejected the request\.?\s*/i, 'User rejected the request. ')
    .replace(/^Error:\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function getShieldErrorMessage(error: unknown, symbol: string) {
  const rawMessage = extractRawErrorMessage(error);
  const lower = rawMessage.toLowerCase();
  const cleaned = cleanErrorMessage(rawMessage);

  if (!rawMessage) {
    return 'Shielding failed. Check your wallet and try again.';
  }
  if (lower.includes('user rejected')) {
    return 'Shielding was cancelled in your wallet.';
  }
  if (lower.includes('insufficient') && lower.includes('fund')) {
    return 'Your wallet does not have enough ETH on Arbitrum Sepolia to pay gas.';
  }
  if (
    lower.includes('rpc endpoint returned too many errors') ||
    lower.includes('consider using a different rpc endpoint')
  ) {
    return 'Shielding failed because the current Arbitrum Sepolia RPC is overloaded. Retry, or switch your wallet/app to a healthier RPC endpoint.';
  }
  if (lower.includes('max fee per gas less than block base fee')) {
    return 'Shielding failed because the wallet used a stale gas estimate. Retry and approve the transaction with a higher max fee.';
  }
  if (lower.includes('erc20insufficientallowance') || lower.includes('allowance')) {
    return `Shielding failed because the ${symbol} allowance for NoxPay is too low. Re-approve and try again.`;
  }
  if (lower.includes('erc20insufficientbalance') || lower.includes('transfer amount exceeds balance')) {
    return `Your wallet does not have enough ${symbol} to shield that amount.`;
  }
  if (lower.includes('transfer amount exceeds balance') || lower.includes('transferfrom failed')) {
    return `Your wallet does not have enough ${symbol} to shield that amount.`;
  }
  if (lower.includes('invalidamount')) {
    return `Shielding failed because the ${symbol} amount was invalid.`;
  }
  if (lower.includes('unsupported chain')) {
    return 'Shielding failed because this action is not supported on the current chain. Switch to Arbitrum Sepolia.';
  }
  if (lower.includes('chain mismatch') || lower.includes('chain disconnected')) {
    return 'Switch your wallet to Arbitrum Sepolia and try again.';
  }

  return cleaned.length > 0 && cleaned.length <= 220
    ? `Shielding failed: ${cleaned}`
    : 'Shielding failed. Open the wallet prompt or browser console to inspect the full revert reason.';
}

function getMintErrorMessage(error: unknown, symbol: string) {
  const rawMessage = extractRawErrorMessage(error);
  const lower = rawMessage.toLowerCase();
  const cleaned = cleanErrorMessage(rawMessage);

  if (!rawMessage) {
    return `Minting demo ${symbol} failed.`;
  }
  if (lower.includes('user rejected')) {
    return 'Minting was cancelled in your wallet.';
  }
  if (lower.includes('onlyowner') || lower.includes('ownable')) {
    return 'The connected wallet is not allowed to mint demo funds.';
  }
  if (lower.includes('insufficient') && lower.includes('fund')) {
    return 'The treasury wallet does not have enough ETH on Arbitrum Sepolia to pay gas.';
  }

  return cleaned.length > 0 && cleaned.length <= 220
    ? `Minting demo ${symbol} failed: ${cleaned}`
    : `Minting demo ${symbol} failed. Open the wallet prompt or browser console to inspect the full revert reason.`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
