import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './components/Header';
import { LandingHero } from './components/LandingHero';
import { TreasuryDashboard } from './components/TreasuryDashboard';
import { RecipientDashboard } from './components/RecipientDashboard';
import { PublicStats } from './components/PublicStats';
import { ShieldTokens } from './components/ShieldTokens';
import { SelectiveDisclosure } from './components/SelectiveDisclosure';
import { Footer } from './components/Footer';

type ViewMode = 'landing' | 'treasury' | 'recipient';

function App() {
  const { isConnected } = useAccount();
  const [activeView, setActiveView] = useState<ViewMode>('landing');

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Background particles */}
      <div className="bg-particles" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col flex-1">
        <Header
          activeView={activeView}
          onViewChange={setActiveView}
          isConnected={isConnected}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {!isConnected || activeView === 'landing' ? (
            <LandingHero />
          ) : activeView === 'treasury' ? (
            <div className="space-y-8 pt-8">
              <PublicStats />
              <ShieldTokens />
              <TreasuryDashboard />
              <SelectiveDisclosure />
            </div>
          ) : (
            <div className="space-y-8 pt-8">
              <PublicStats />
              <RecipientDashboard />
              <SelectiveDisclosure />
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default App;
