import { motion } from 'framer-motion';
import { Landmark, User, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { HeaderConnectButton } from './HeaderConnectButton';

type ViewMode = 'landing' | 'treasury' | 'recipient';

interface HeaderProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isConnected: boolean;
}

export function Header({ activeView, onViewChange, isConnected }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b border-nox-border/50"
      style={{
        background: 'rgba(10, 15, 28, 0.85)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-16 sm:h-20 min-w-0">
          {/* Logo */}
          <button
            onClick={() => onViewChange('landing')}
            className="flex items-center gap-2 sm:gap-3 group cursor-pointer min-w-0"
          >
            <img 
              src="/noxpay-logo.svg" 
              alt="NoxPay" 
              className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 shadow-lg group-hover:shadow-nox-gold/20 transition-all group-hover:scale-105" 
            />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold gradient-text-gold leading-none">
                NoxPay
              </h1>
              <p className="text-[10px] text-nox-lightgray tracking-wider uppercase">
                Confidential Rewards
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          {isConnected && (
            <nav className="hidden md:flex items-center gap-1">
              <NavButton
                active={activeView === 'treasury'}
                onClick={() => onViewChange('treasury')}
                icon={<Landmark className="w-4 h-4" />}
                label="Treasury Mode"
              />
              <NavButton
                active={activeView === 'recipient'}
                onClick={() => onViewChange('recipient')}
                icon={<User className="w-4 h-4" />}
                label="My Private Rewards"
              />
            </nav>
          )}

          {/* Connect + Mobile Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={isConnected ? 'block' : 'hidden sm:block'}>
              <HeaderConnectButton />
            </div>
            {isConnected && (
              <button
                className="md:hidden p-2 text-nox-lightgray hover:text-white transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isConnected && mobileOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="md:hidden border-t border-nox-border/50 px-4 pb-4"
          style={{ background: 'rgba(10, 15, 28, 0.95)' }}
        >
          <div className="flex flex-col gap-2 pt-3">
            <MobileNavButton
              active={activeView === 'treasury'}
              onClick={() => { onViewChange('treasury'); setMobileOpen(false); }}
              icon={<Landmark className="w-4 h-4" />}
              label="Treasury Mode"
            />
            <MobileNavButton
              active={activeView === 'recipient'}
              onClick={() => { onViewChange('recipient'); setMobileOpen(false); }}
              icon={<User className="w-4 h-4" />}
              label="My Private Rewards"
            />
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

function NavButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
        active
          ? 'bg-nox-gold/10 text-nox-gold border border-nox-gold/30'
          : 'text-nox-lightgray hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all w-full cursor-pointer ${
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
