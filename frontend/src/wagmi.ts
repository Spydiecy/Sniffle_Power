import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bscTestnet } from 'wagmi/chains';

// Custom BSC Testnet configuration with your preferred RPC
const customBscTestnet = {
  ...bscTestnet,
  rpcUrls: {
    default: {
      http: ['https://api.zan.top/bsc-testnet'],
    },
    public: {
      http: ['https://api.zan.top/bsc-testnet'],
    },
  },
};

export const config = getDefaultConfig({
  appName: 'Sniffle',
  projectId: 'YOUR_PROJECT_ID', // Replace with your WalletConnect project ID  
  chains: [customBscTestnet],
  ssr: true,
});

// Ensure we export the chain for use in contracts
export { customBscTestnet as bscTestnet };
