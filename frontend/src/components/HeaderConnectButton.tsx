import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

export function HeaderConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!ready) {
          return <div className="h-10 w-28 rounded-xl bg-white/5" aria-hidden="true" />;
        }

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className="btn-gold px-3 sm:px-5 py-2.5 text-sm sm:text-base whitespace-nowrap inline-flex items-center justify-center gap-2"
              aria-label="Connect wallet"
              type="button"
            >
              <Wallet className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="rounded-xl border border-nox-danger/40 bg-nox-danger/10 px-3 sm:px-4 py-2.5 text-sm font-semibold text-nox-danger whitespace-nowrap"
              type="button"
            >
              Wrong network
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              onClick={openChainModal}
              className="hidden sm:inline-flex items-center rounded-xl border border-nox-border bg-white/5 px-3 py-2.5 text-sm font-medium text-white"
              type="button"
            >
              {chain.name}
            </button>
            <button
              onClick={openAccountModal}
              className="btn-gold px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap inline-flex items-center justify-center gap-2"
              aria-label="Open wallet account"
              type="button"
            >
              <Wallet className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">{account.displayName}</span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
