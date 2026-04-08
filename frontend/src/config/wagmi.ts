import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { arbitrumSepolia } from 'wagmi/chains';

/**
 * Wagmi + RainbowKit configuration for NoxPay
 * Network: Arbitrum Sepolia (testnet)
 */
const arbitrumSepoliaRpcUrl =
  import.meta.env.VITE_ARB_SEPOLIA_RPC_URL ||
  arbitrumSepolia.rpcUrls.default.http[0];

export const config = getDefaultConfig({
  appName: 'NoxPay',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'noxpay-dev-placeholder',
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(arbitrumSepoliaRpcUrl),
  },
  ssr: false,
});
