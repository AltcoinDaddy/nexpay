import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Shield, Lock, Eye, EyeOff, ArrowRight,
  Users, BarChart3, KeyRound
} from 'lucide-react';

export function LandingHero() {
  return (
    <div className="pt-8 sm:pt-16 pb-16">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto mb-20 sm:mb-32">

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight mb-6"
        >
          <span className="gradient-text-gold">Send Rewards</span>
          <br />
          <span className="text-white">On-Chain with </span>
          <span className="gradient-text-cyan">Hidden Amounts</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg sm:text-xl text-nox-lightgray max-w-2xl mx-auto mb-10 leading-relaxed px-4"
        >
          A confidential payroll and rewards platform for DAOs, protocols, and Web3 teams.
          Individual amounts and balances remain <span className="text-nox-cyan font-semibold">fully encrypted</span> using
          ERC-7984 Confidential Tokens.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <div className="pulse-gold rounded-xl">
            <ConnectButton label="Connect Wallet to Start" />
          </div>
          <a
            href="https://docs.iex.ec/nox-protocol/getting-started/welcome"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline flex items-center gap-2 text-sm"
          >
            Learn About Nox
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Token Shielding"
            description="Wrap any ERC-20 into its confidential ERC-7984 version. Your balance becomes encrypted instantly."
            accentColor="gold"
            delay={0.5}
          />
          <FeatureCard
            icon={<Lock className="w-6 h-6" />}
            title="Private Transfers"
            description="Send rewards with encrypted amounts. Only the recipient can decrypt and view their payment."
            accentColor="cyan"
            delay={0.6}
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Batch Payments"
            description="Treasury can distribute to multiple recipients in a single transaction — all amounts hidden."
            accentColor="gold"
            delay={0.7}
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6" />}
            title="Public Aggregates"
            description="Everyone sees total rewards distributed. Nobody sees individual amounts. Best of both worlds."
            accentColor="warning"
            delay={0.8}
          />
          <FeatureCard
            icon={<KeyRound className="w-6 h-6" />}
            title="Selective Disclosure"
            description="Grant temporary view access to auditors or compliance officers. You control who sees what."
            accentColor="cyan"
            delay={0.9}
          />
          <FeatureCard
            icon={<EyeOff className="w-6 h-6" />}
            title="Linear Vesting"
            description="Set vesting schedules for rewards. Recipients claim over time — balance remains confidential."
            accentColor="gold"
            delay={1.0}
          />
        </motion.div>
      </section>

      {/* Privacy Contrast Demo */}
      <section className="max-w-4xl mx-auto mt-20 sm:mt-32">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl font-bold text-center mb-4"
        >
          <span className="text-white">Public vs </span>
          <span className="gradient-text-cyan">Private</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-nox-lightgray text-center mb-10 max-w-lg mx-auto"
        >
          See the privacy contrast — what everyone sees vs what only you see
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Public View */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-nox-warning" />
              <span className="public-badge">PUBLIC VIEW</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-4">
              What Everyone Sees
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-nox-border/50">
                <span className="text-nox-lightgray text-sm">Total Distributed</span>
                <span className="text-nox-warning font-mono font-bold">$142,500.00</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-nox-border/50">
                <span className="text-nox-lightgray text-sm">Total Payments</span>
                <span className="text-nox-warning font-mono font-bold">47</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-nox-border/50">
                <span className="text-nox-lightgray text-sm">Recipients</span>
                <span className="text-nox-warning font-mono font-bold">12</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-nox-lightgray text-sm">Your Balance</span>
                <span className="text-nox-warning/50 font-mono text-sm">🔒 Hidden</span>
              </div>
            </div>
          </motion.div>

          {/* Private View */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-card p-6 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-5"
              style={{
                background: 'radial-gradient(circle at 50% 0%, #00E5CC, transparent 60%)',
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <EyeOff className="w-5 h-5 text-nox-cyan" />
                <span className="privacy-badge">PRIVATE VIEW</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-4">
                What Only You See
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-nox-border/50">
                  <span className="text-nox-lightgray text-sm">Your Balance</span>
                  <span className="text-nox-cyan font-mono font-bold">$8,750.00</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nox-border/50">
                  <span className="text-nox-lightgray text-sm">Last Payment</span>
                  <span className="text-nox-cyan font-mono font-bold">$2,500.00</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nox-border/50">
                  <span className="text-nox-lightgray text-sm">Vesting</span>
                  <span className="text-nox-success font-mono font-bold">$1,200 / $5,000</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-nox-lightgray text-sm">Decrypted Via</span>
                  <span className="text-nox-cyan text-sm font-medium">Nox TEE + JS SDK</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto mt-20 sm:mt-32">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl font-bold text-center mb-12"
        >
          <span className="gradient-text-gold">How It Works</span>
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <StepCard
            step={1}
            title="Shield Tokens"
            description="Wrap your ERC-20 tokens into confidential ERC-7984 tokens. Your balance is now encrypted."
            delay={0}
          />
          <StepCard
            step={2}
            title="Send Privately"
            description="Treasury sends encrypted rewards. Amounts are never exposed on-chain."
            delay={0.1}
          />
          <StepCard
            step={3}
            title="Decrypt Locally"
            description="Recipients decrypt their balance client-side using the Nox JS SDK. Only they can see it."
            delay={0.2}
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description, accentColor, delay }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: 'gold' | 'cyan' | 'warning';
  delay: number;
}) {
  const colors = {
    gold: { bg: 'rgba(242, 184, 75, 0.08)', border: 'rgba(242, 184, 75, 0.15)', icon: '#F2B84B' },
    cyan: { bg: 'rgba(0, 229, 204, 0.08)', border: 'rgba(0, 229, 204, 0.15)', icon: '#00E5CC' },
    warning: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.15)', icon: '#F59E0B' },
  };
  const c = colors[accentColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="glass-card p-6 group hover:scale-[1.02] transition-transform"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}
      >
        <div style={{ color: c.icon }}>{icon}</div>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-nox-lightgray leading-relaxed">{description}</p>
    </motion.div>
  );
}

function StepCard({ step, title, description, delay }: {
  step: number; title: string; description: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-nox-gold to-nox-deepgold flex items-center justify-center mx-auto mb-4 text-nox-dark font-bold text-xl shadow-lg shadow-nox-gold/20">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-nox-lightgray leading-relaxed">{description}</p>
    </motion.div>
  );
}
