import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark, Send, Users as UsersIcon, Plus, Trash2, Loader2,
  Clock, CalendarDays
} from 'lucide-react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { isAddress, parseUnits } from 'viem';
import {
  CONTRACTS,
  DEMO_CONFIDENTIAL_FLOWS_ENABLED,
  NOXPAY_ABI,
  ZERO_ADDRESS,
} from '../config/contracts';
import { useContractConfig } from '../hooks/useContractConfig';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import toast from 'react-hot-toast';

interface Recipient {
  id: string;
  address: string;
  amount: string;
}

export function TreasuryDashboard() {
  const { address } = useAccount();
  const [mode, setMode] = useState<'single' | 'batch' | 'vesting'>('single');

  // Single payment
  const [recipientAddr, setRecipientAddr] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  // Batch payment
  const [batchRecipients, setBatchRecipients] = useState<Recipient[]>([
    { id: '1', address: '', amount: '' },
  ]);

  // Vesting
  const [vestingAddr, setVestingAddr] = useState('');
  const [vestingAmount, setVestingAmount] = useState('');
  const [vestingDays, setVestingDays] = useState('30');
  const contractConfig = useContractConfig();
  const publicClient = usePublicClient();
  const { decimals, symbol } = useTokenMetadata();
  const hasContractConfig = CONTRACTS.NOXPAY !== ZERO_ADDRESS;

  const { writeContractAsync: writeContractAsync, isPending } = useWriteContract();

  const confidentialFlowsEnabled = DEMO_CONFIDENTIAL_FLOWS_ENABLED;

  const ensureConfidentialFlowsReady = () => {
    if (!confidentialFlowsEnabled) {
      toast.error('Live confidential transfers need a real Nox SDK payload. Enable demo mode only if you intentionally want placeholder handles.');
      return false;
    }
    if (!address || !publicClient || !hasContractConfig) {
      toast.error('Connect your wallet and configure the NoxPay contract first.');
      return false;
    }
    return true;
  };

  const handleSendSingle = async () => {
    if (!recipientAddr || !paymentAmount) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!isAddress(recipientAddr)) {
      toast.error('Enter a valid recipient address');
      return;
    }
    if (parseFloat(paymentAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!ensureConfidentialFlowsReady()) {
      return;
    }

    try {
      // In production, the encryptedAmount and inputProof come from the Nox JS SDK
      // handleClient.encryptInput() returns { handle, handleProof }
      const demoHandle = '0x' + '0'.repeat(64) as `0x${string}`;
      const demoProof = '0x' as `0x${string}`;

      const hash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'sendConfidentialReward',
        args: [
          recipientAddr as `0x${string}`,
          demoHandle,
          demoProof,
          parseUnits(paymentAmount, decimals),
        ],
        ...contractConfig,
      });
      await publicClient!.waitForTransactionReceipt({ hash });

      toast.success('Confidential reward transaction confirmed.');
      setRecipientAddr('');
      setPaymentAmount('');
    } catch (error) {
      console.error('Single reward error:', error);
      toast.error('Transaction failed');
    }
  };

  const handleSendBatch = async () => {
    const validRecipients = batchRecipients.filter(r => r.address && r.amount);
    if (validRecipients.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    if (validRecipients.some((recipient) => !isAddress(recipient.address))) {
      toast.error('Every recipient row needs a valid wallet address');
      return;
    }
    if (validRecipients.some((recipient) => parseFloat(recipient.amount) <= 0)) {
      toast.error('Every recipient row needs a valid amount');
      return;
    }
    if (!ensureConfidentialFlowsReady()) {
      return;
    }

    try {
      const addresses = validRecipients.map(r => r.address as `0x${string}`);
      const handles = validRecipients.map(() => ('0x' + '0'.repeat(64)) as `0x${string}`);
      const proofs = validRecipients.map(() => '0x' as `0x${string}`);
      const amounts = validRecipients.map(r => parseUnits(r.amount, decimals));

      const hash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'sendBatchRewards',
        args: [addresses, handles, proofs, amounts],
        ...contractConfig,
      });
      await publicClient!.waitForTransactionReceipt({ hash });

      toast.success(`Batch payment confirmed for ${validRecipients.length} recipients.`);
      setBatchRecipients([{ id: '1', address: '', amount: '' }]);
    } catch (error) {
      console.error('Batch reward error:', error);
      toast.error('Batch transaction failed');
    }
  };

  const handleCreateVesting = async () => {
    if (!vestingAddr || !vestingAmount || !vestingDays) {
      toast.error('Please fill in all vesting fields');
      return;
    }
    if (!isAddress(vestingAddr)) {
      toast.error('Enter a valid recipient address');
      return;
    }
    if (parseFloat(vestingAmount) <= 0 || parseInt(vestingDays, 10) <= 0) {
      toast.error('Enter a valid amount and duration');
      return;
    }
    if (!ensureConfidentialFlowsReady()) {
      return;
    }

    try {
      const demoHandle = '0x' + '0'.repeat(64) as `0x${string}`;
      const demoProof = '0x' as `0x${string}`;
      const durationSeconds = BigInt(parseInt(vestingDays) * 86400);

      const hash = await writeContractAsync({
        address: CONTRACTS.NOXPAY as `0x${string}`,
        abi: NOXPAY_ABI,
        functionName: 'createVestingSchedule',
        args: [
          vestingAddr as `0x${string}`,
          demoHandle,
          demoProof,
          parseUnits(vestingAmount, decimals),
          durationSeconds,
        ],
        ...contractConfig,
      });
      await publicClient!.waitForTransactionReceipt({ hash });

      toast.success('Vesting schedule transaction confirmed.');
      setVestingAddr('');
      setVestingAmount('');
      setVestingDays('30');
    } catch (error) {
      console.error('Vesting creation error:', error);
      toast.error('Vesting creation failed');
    }
  };

  const addBatchRecipient = () => {
    setBatchRecipients([
      ...batchRecipients,
      { id: Date.now().toString(), address: '', amount: '' },
    ]);
  };

  const removeBatchRecipient = (id: string) => {
    if (batchRecipients.length > 1) {
      setBatchRecipients(batchRecipients.filter(r => r.id !== id));
    }
  };

  const updateBatchRecipient = (id: string, field: 'address' | 'amount', value: string) => {
    setBatchRecipients(
      batchRecipients.map(r => r.id === id ? { ...r, [field]: value } : r)
    );
  };

  const batchTotal = batchRecipients
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    .toFixed(2);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nox-gold/20 to-nox-deepgold/10 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-nox-gold" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Treasury Dashboard
          </h2>
          <p className="text-xs text-nox-lightgray">
            Send confidential rewards and create vesting schedules
          </p>
        </div>
      </div>

      {!confidentialFlowsEnabled && (
        <div className="mb-6 rounded-xl border border-nox-warning/20 bg-nox-warning/5 p-4">
          <p className="text-sm text-nox-lightgray">
            Treasury transfers and vesting need real encrypted inputs from the Nox SDK.
            This repo now blocks fake success states by default. Set
            <code className="mx-1">VITE_ENABLE_DEMO_CONFIDENTIAL_FLOWS=true</code>
            only if you intentionally want placeholder handles for demos.
          </p>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <TabButton
          active={mode === 'single'}
          onClick={() => setMode('single')}
          icon={<Send className="w-4 h-4" />}
          label="Single Payment"
        />
        <TabButton
          active={mode === 'batch'}
          onClick={() => setMode('batch')}
          icon={<UsersIcon className="w-4 h-4" />}
          label="Batch Payment"
        />
        <TabButton
          active={mode === 'vesting'}
          onClick={() => setMode('vesting')}
          icon={<Clock className="w-4 h-4" />}
          label="Vesting"
        />
      </div>

      <AnimatePresence mode="wait">
        {/* Single Payment */}
        {mode === 'single' && (
          <motion.div
            key="single"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="glass-card p-6 sm:p-8 max-w-2xl"
          >
            <h3 className="text-lg font-semibold text-white mb-1">
              Send Confidential Reward
            </h3>
            <p className="text-sm text-nox-lightgray mb-6">
              The amount will be encrypted — only the recipient can view it
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nox-lightgray mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipientAddr}
                  onChange={(e) => setRecipientAddr(e.target.value)}
                  placeholder="0x..."
                  className="nox-input font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nox-lightgray mb-2">
                  Amount (encrypted on-chain)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="nox-input pr-20 font-mono"
                    min="0"
                    step="0.01"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-nox-lightgray text-sm">
                    {symbol}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-nox-cyan/5 border border-nox-cyan/10">
                <p className="text-xs text-nox-cyan flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-nox-cyan inline-block pulse-cyan" />
                  Amount will be encrypted via Nox TEE before on-chain submission
                </p>
              </div>

              <button
                onClick={handleSendSingle}
                disabled={isPending || !address || !hasContractConfig || !confidentialFlowsEnabled}
                className="btn-gold w-full flex items-center justify-center gap-2 py-3.5"
              >
                {isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-5 h-5" /> Send Confidential Reward</>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Batch Payment */}
        {mode === 'batch' && (
          <motion.div
            key="batch"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="glass-card p-6 sm:p-8 max-w-3xl"
          >
            <h3 className="text-lg font-semibold text-white mb-1">
              Batch Confidential Payments
            </h3>
            <p className="text-sm text-nox-lightgray mb-6">
              Send encrypted rewards to multiple recipients in one transaction
            </p>

            <div className="space-y-3 mb-4">
              {batchRecipients.map((recipient, idx) => (
                <motion.div
                  key={recipient.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex gap-3 items-end"
                >
                  <div className="flex-1 min-w-0">
                    {idx === 0 && (
                      <label className="block text-xs font-medium text-nox-lightgray mb-1.5">
                        Address
                      </label>
                    )}
                    <input
                      type="text"
                      value={recipient.address}
                      onChange={(e) => updateBatchRecipient(recipient.id, 'address', e.target.value)}
                      placeholder="0x..."
                      className="nox-input font-mono text-sm py-2.5"
                    />
                  </div>
                  <div className="w-32 sm:w-40">
                    {idx === 0 && (
                      <label className="block text-xs font-medium text-nox-lightgray mb-1.5">
                        Amount
                      </label>
                    )}
                    <input
                      type="number"
                      value={recipient.amount}
                      onChange={(e) => updateBatchRecipient(recipient.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="nox-input font-mono text-sm py-2.5"
                      min="0"
                    />
                  </div>
                  <button
                    onClick={() => removeBatchRecipient(recipient.id)}
                    className="p-2.5 text-nox-lightgray hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>

            <button
              onClick={addBatchRecipient}
              className="flex items-center gap-2 text-sm text-nox-gold hover:text-nox-deepgold transition-colors mb-6 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Recipient
            </button>

            <div className="flex items-center justify-between p-3 rounded-xl bg-nox-dark/50 border border-nox-border/50 mb-4">
              <span className="text-sm text-nox-lightgray">
                Total ({batchRecipients.filter(r => r.amount).length} recipients)
              </span>
              <span className="font-mono font-bold text-nox-gold">
                ${batchTotal} {symbol}
              </span>
            </div>

            <button
              onClick={handleSendBatch}
              disabled={isPending || !address || !hasContractConfig || !confidentialFlowsEnabled}
              className="btn-gold w-full flex items-center justify-center gap-2 py-3.5"
            >
              {isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <><UsersIcon className="w-5 h-5" /> Send Batch Rewards</>
              )}
            </button>
          </motion.div>
        )}

        {/* Vesting */}
        {mode === 'vesting' && (
          <motion.div
            key="vesting"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="glass-card p-6 sm:p-8 max-w-2xl"
          >
            <h3 className="text-lg font-semibold text-white mb-1">
              Create Vesting Schedule
            </h3>
            <p className="text-sm text-nox-lightgray mb-6">
              Set up linear vesting with confidential balances
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nox-lightgray mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={vestingAddr}
                  onChange={(e) => setVestingAddr(e.target.value)}
                  placeholder="0x..."
                  className="nox-input font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nox-lightgray mb-2">
                    Total Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={vestingAmount}
                      onChange={(e) => setVestingAmount(e.target.value)}
                      placeholder="0.00"
                      className="nox-input pr-16 font-mono"
                      min="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nox-lightgray text-xs">
                      {symbol}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-nox-lightgray mb-2">
                    Vesting Duration
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={vestingDays}
                      onChange={(e) => setVestingDays(e.target.value)}
                      className="nox-input pr-14 font-mono"
                      min="1"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nox-lightgray text-xs">
                      Days
                    </span>
                  </div>
                </div>
              </div>

              {/* Vesting preview */}
              {vestingAmount && vestingDays && (
                <div className="p-4 rounded-xl bg-nox-dark/50 border border-nox-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-nox-gold" />
                    <span className="text-sm font-medium text-white">Vesting Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-nox-lightgray">Daily Release</span>
                      <p className="font-mono text-nox-gold">
                        ${(parseFloat(vestingAmount) / parseInt(vestingDays)).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-nox-lightgray">Total Duration</span>
                      <p className="font-mono text-white">{vestingDays} days</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 rounded-full bg-nox-dark overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '33%' }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full rounded-full bg-gradient-to-r from-nox-gold to-nox-deepgold"
                    />
                  </div>
                  <p className="text-xs text-nox-lightgray mt-1">~33% vested preview</p>
                </div>
              )}

              <button
                onClick={handleCreateVesting}
                disabled={isPending || !address || !hasContractConfig || !confidentialFlowsEnabled}
                className="btn-gold w-full flex items-center justify-center gap-2 py-3.5"
              >
                {isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Creating...</>
                ) : (
                  <><Clock className="w-5 h-5" /> Create Vesting Schedule</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
        active
          ? 'bg-nox-gold/10 text-nox-gold border border-nox-gold/30'
          : 'text-nox-lightgray hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
