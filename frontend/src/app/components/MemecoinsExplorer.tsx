'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaChartLine, FaRegStar, FaStar, FaInfoCircle, FaSpinner, FaSync } from 'react-icons/fa';
import Image from 'next/image';
import { fetchTokenData, invalidateTokenCache, FormattedMemecoin } from '../services/TokenData';

export default function MemecoinsExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('trending');
  const [memecoins, setMemecoins] = useState<FormattedMemecoin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadHelixData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setIsLoading(!forceRefresh); // Don't show main loading if it's just a refresh
      if (forceRefresh) {
        setIsRefreshing(true);
      }
      
      console.log('Loading token data, force refresh:', forceRefresh);
      
      const data = await fetchTokenData(forceRefresh);
      
      // Debug: log the data we received
      console.log('Token data received:', data);
      console.log('Token data length:', data.length);
      if (data.length > 0) {
        console.log('Sample token:', data[0]);
      }
      
      // Debug UI: show the data for troubleshooting
      (window as any)._sniffleDebug = {
        tokenData: data,
        tokenDataLength: data.length,
        lastRefresh: new Date().toISOString()
      };
      
      setMemecoins(data);
      setError(null);
      setLastRefresh(new Date());
      
    } catch (err) {
      console.error('Failed to fetch helix data:', err);
      setError('Failed to load memecoin data. Please try again later.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    try {
      console.log('Force refresh initiated');
      
      // First invalidate the cache
      const cacheInvalidated = await invalidateTokenCache();
      if (cacheInvalidated) {
        console.log('Cache invalidated successfully');
      }
      
      // Then reload data with force refresh
      await loadHelixData(true);
      
    } catch (error) {
      console.error('Failed to force refresh:', error);
      setError('Failed to refresh data. Please try again.');
    }
  }, [loadHelixData]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Initial load
    loadHelixData(false);
    
    // Set up interval for regular updates
    intervalId = setInterval(() => {
      loadHelixData(false);
    }, 60000); // Refresh every 1 minute
    
    return () => clearInterval(intervalId);
  }, [loadHelixData]);

  const toggleFavorite = (id: number) => {
    setMemecoins(prevCoins => 
      prevCoins.map(coin => 
        coin.id === id ? { ...coin, favorite: !coin.favorite } : coin
      )
    );
  };

  const filteredCoins = memecoins.filter(coin => 
    coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedCoins = activeTab === 'trending' 
    ? filteredCoins.sort((a, b) => b.potential - a.potential)
    : activeTab === 'favorites' 
    ? filteredCoins.filter(coin => coin.favorite)
    : activeTab === 'safe' 
    ? filteredCoins.sort((a, b) => a.risk - b.risk)
    : filteredCoins;

  // Sort by age (newest to oldest) for all tabs
  const parseAge = (ageStr: string) => {
    // Example: '2m', '1h', '3d', '5s', '8mo', '1y'
    if (!ageStr) return Number.MAX_SAFE_INTEGER;
    const match = ageStr.match(/(\d+)(mo|[smhdy])/); // 'mo' before 'm'!
    if (!match) return Number.MAX_SAFE_INTEGER;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      case 'mo': return value * 2592000; // 1 month = 30 days
      case 'y': return value * 31536000; // 1 year = 365 days
      default: return Number.MAX_SAFE_INTEGER;
    }
  };

  // Always sort by age (newest first), except for 'safe' tab which sorts by risk
  let sortedCoins: FormattedMemecoin[];
  if (activeTab === 'safe') {
    // Sort by risk ASC (safest first), then by age (newest first)
    sortedCoins = displayedCoins.slice().sort((a, b) => {
      if (a.risk !== b.risk) return a.risk - b.risk;
      return parseAge(a.age) - parseAge(b.age);
    });
  } else {
    // Default: sort by age (newest first)
    sortedCoins = displayedCoins.slice().sort((a, b) => parseAge(a.age) - parseAge(b.age));
  }

  // Create a helper function for opening links
  const openHelixLink = useCallback((url: string) => {
    if (!url) {
      console.error("Attempted to open empty URL");
      return;
    }
    
    console.log("Opening Helix link:", url);
    
    try {
      // Simple direct window open approach
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error("Error opening link:", error);
    }
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden resize-x min-w-[400px] max-w-none">
      <div className="p-4 bg-solana-purple text-white">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Memecoin Explorer</h2>
            <p className="text-sm opacity-75">Discover trending memecoins with Sniffle intelligence</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs opacity-75">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <button 
              onClick={forceRefresh}
              disabled={isRefreshing}
              className="p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
              title="Force refresh data"
            >
              <FaSync className={`${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search coins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-solana-purple text-gray-800"
          />
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        
        <div className="flex mb-4 border-b border-purple-200">
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'trending' 
                ? 'text-solana-purple border-b-2 border-solana-purple' 
                : 'text-gray-500 hover:text-solana-purple'
            }`}
          >
            Trending
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'favorites' 
                ? 'text-solana-purple border-b-2 border-solana-purple' 
                : 'text-gray-500 hover:text-solana-purple'
            }`}
          >
            Favorites
          </button>
          <button
            onClick={() => setActiveTab('safe')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'safe' 
                ? 'text-solana-purple border-b-2 border-solana-purple' 
                : 'text-gray-500 hover:text-solana-purple'
            }`}
          >
            Safest
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <FaSpinner className="animate-spin text-solana-purple text-3xl" />
            <span className="ml-2 text-gray-600">Loading memecoin data...</span>
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">
            <FaInfoCircle className="text-3xl mb-2 inline-block" />
            <p>{error}</p>
            <button 
              onClick={forceRefresh}
              className="mt-2 px-4 py-2 bg-solana-purple text-white rounded-lg hover:bg-purple-700"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full min-w-[1000px]">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-purple-100">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider w-[12%]">Symbol</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider w-[14%]">Price</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider w-[10%]">Volume</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider w-[12%]">Market Cap</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider w-[12%]">24h Change</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider w-[8%]">Age</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider w-[10%]">Potential</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider w-[8%]">Risk</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider w-[12%]">Favorite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100">
                {sortedCoins.length > 0 ? (
                  sortedCoins.map((coin) => (
                    <tr key={coin.id} className="hover:bg-purple-50 cursor-pointer"
                      onClick={() => openHelixLink(coin.href)}
                    >
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-800 w-[12%]">{coin.symbol}{coin.symbol1 ? `/${coin.symbol1}` : ''}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-800 w-[14%]">${coin.price.toFixed(coin.price < 0.001 ? 8 : 6)}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-800 w-[10%]">{coin.volume}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-500 w-[12%]">{coin.marketCap}</td>
                      <td className={`px-3 py-4 whitespace-nowrap text-right text-sm font-medium w-[12%] ${coin.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>{coin.change24h >= 0 ? '+' : ''}{coin.change24h}%</td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-500 w-[8%]">{coin.age}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-center text-gray-800 w-[10%]">{coin.potential}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-center text-gray-800 w-[8%]">{coin.risk}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-center w-[12%]">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavorite(coin.id);
                          }}
                          className="text-lg"
                        >
                          {coin.favorite ? 
                            <FaStar className="text-solana-purple" /> : 
                            <FaRegStar className="text-gray-400 hover:text-solana-purple" />
                          }
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      No memecoins found matching your search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
