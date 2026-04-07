import { motion } from 'framer-motion';
import { BarChart3, Users, Coins, TrendingUp, Eye } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, NOXPAY_ABI, ZERO_ADDRESS } from '../config/contracts';
import { formatUnits } from 'viem';
import { useTokenMetadata } from '../hooks/useTokenMetadata';

export function PublicStats() {
  const { address } = useAccount();
  const { decimals } = useTokenMetadata();
  const hasContractConfig = CONTRACTS.NOXPAY !== ZERO_ADDRESS;

  // Read public stats from contract (falls back to demo data if not deployed)
  const { data: statsData } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    abi: NOXPAY_ABI,
    functionName: 'getPublicStats',
    query: { enabled: hasContractConfig },
  });

  const { data: treasuryAddress } = useReadContract({
    address: CONTRACTS.NOXPAY as `0x${string}`,
    abi: NOXPAY_ABI,
    functionName: 'treasury',
    query: { enabled: hasContractConfig },
  });

  // Demo values when contract isn't deployed
  const totalDistributed = statsData
    ? Number(formatUnits(statsData[0] as bigint, decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '142,500.00';
  const paymentCount = statsData
    ? Number(statsData[1]).toLocaleString()
    : '47';
  const uniqueRecipients = statsData
    ? Number(statsData[2]).toLocaleString()
    : '12';

  const isTreasury = Boolean(
    address && treasuryAddress && address.toLowerCase() === treasuryAddress.toLowerCase()
  );
  const roleLabel = !address ? 'Viewer' : isTreasury ? 'Treasury' : 'Recipient';
  const roleSubtext = !address
    ? 'Connect to personalize'
    : isTreasury
      ? 'Admin access'
      : 'View your rewards';

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-nox-warning" />
          <span className="public-badge">PUBLIC DATA</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Aggregate Statistics
        </h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Coins className="w-5 h-5" />}
          label="Total Distributed"
          value={`$${totalDistributed}`}
          subtext="Visible to everyone"
          accentColor="warning"
          delay={0}
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Total Payments"
          value={paymentCount}
          subtext="All-time count"
          accentColor="warning"
          delay={0.05}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Unique Recipients"
          value={uniqueRecipients}
          subtext="Active wallets"
          accentColor="warning"
          delay={0.1}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Your Role"
          value={roleLabel}
          subtext={roleSubtext}
          accentColor="gold"
          delay={0.15}
        />
      </div>
    </motion.section>
  );
}

function StatCard({ icon, label, value, subtext, accentColor, delay }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  accentColor: 'gold' | 'cyan' | 'warning';
  delay: number;
}) {
  const iconColors = {
    gold: 'text-nox-gold',
    cyan: 'text-nox-cyan',
    warning: 'text-nox-warning',
  };

  const glowClass = accentColor === 'cyan' ? 'stat-glow-cyan' : 'stat-glow-gold';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`glass-card p-5 ${glowClass} hover:scale-[1.02] transition-transform`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={iconColors[accentColor]}>{icon}</div>
        <span className="text-xs font-medium text-nox-lightgray uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-white font-mono mb-1">{value}</p>
      <p className="text-xs text-nox-lightgray">{subtext}</p>
    </motion.div>
  );
}
