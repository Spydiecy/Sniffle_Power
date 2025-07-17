'use client';

import { useAccount } from 'wagmi';
import { FaWallet } from 'react-icons/fa';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';

interface AccessControlProps {
  children: React.ReactNode;
}

export default function AccessControl({ children }: AccessControlProps) {
  const { address, isConnected } = useAccount();

  // TEMPORARY: Access control disabled - contract will be added later
  // For now, just require wallet connection
  
  // Show wallet connection requirement
  if (!isConnected) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/95 rounded-3xl shadow-2xl border border-sniffle-brown/10 p-8 md:p-12 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <Image 
              src="/trendpup-logo.png" 
              alt="Sniffle Logo" 
              width={150} 
              height={150}
              priority
              className="rounded-full"
            />
          </div>
          
          <h1 className="text-3xl font-bold text-sniffle-dark mb-2">Sniffle AI</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Connect your wallet to access Sniffle's premium memecoin intelligence.
          </p>
          
          <div className="flex items-center justify-center mb-6">
            <FaWallet className="text-sniffle-orange text-2xl mr-3" />
            <span className="text-sniffle-dark font-semibold">Wallet Required</span>
          </div>
          
          <div className="flex justify-center mb-6">
            <ConnectButton />
          </div>
          
          <div className="mt-6 p-4 bg-sniffle-beige/30 rounded-xl">
            <p className="text-xs text-gray-500">
              Make sure you're connected to BNB Smart Chain Testnet for the best experience.
            </p>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-700">
              🚧 Access control temporarily disabled. Contract address will be added soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If wallet is connected, grant access (access control temporarily disabled)
  return <>{children}</>;
}
