"use client"; // Needed for client-side hooks

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { FaTimes, FaDog, FaChartLine, FaWallet, FaFileAlt, FaComments, FaChartBar, FaPlug, FaExpand } from 'react-icons/fa';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import ChatInterface from './components/ChatInterface';
import MemecoinsExplorer from './components/MemecoinsExplorer';

// Window position interface
interface WindowPosition {
  x: number;
  y: number;
}

// Window size interface
interface WindowSize {
  width: number;
  height: number;
}

// Open window state interface
interface OpenWindow {
  id: string;
  position: WindowPosition;
  size: WindowSize;
  zIndex: number;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [connected, setConnected] = useState(false);
  const [appStarted, setAppStarted] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState(10);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<WindowPosition>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{start: WindowPosition, size: WindowSize} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update connected state when account changes
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FaDog /> },
    { id: 'memecoins', label: 'Memecoins', icon: <FaChartLine /> },
    { id: 'stats', label: 'Stats', icon: <FaChartBar /> },
    { id: 'chat', label: 'Chat', icon: <FaComments /> },
    { id: 'whitepaper', label: 'Whitepaper', icon: <FaFileAlt /> },
    { id: 'wallet', label: 'Wallet', icon: <FaWallet /> },
  ];

  // Get default window size for a given type
  const getDefaultWindowSize = (id: string): WindowSize => {
    switch(id) {
      case 'chat':
        return { width: 700, height: 600 }; // Increased default width for better chat experience
      default:
        return { width: 500, height: 400 };
    }
  };

  const toggleWindow = (id: string) => {
    console.log("Toggle window:", id);
    // Check if window is already open
    const existingWindowIndex = openWindows.findIndex(w => w.id === id);
    
    if (existingWindowIndex !== -1) {
      // Close window - use functional update form to ensure latest state
      console.log("Closing window:", id);
      setOpenWindows((prevWindows) => {
        return prevWindows.filter(w => w.id !== id);
      });
      
      if (activeWindowId === id) {
        setActiveWindowId(null);
      }
    } else {
      // Open new window
      const windowSize = getDefaultWindowSize(id);
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const containerHeight = containerRef.current?.clientHeight || window.innerHeight;
      
      const newWindow: OpenWindow = {
        id,
        position: {
          x: (containerWidth / 2) - (windowSize.width / 2),
          y: (containerHeight / 2) - (windowSize.height / 2)
        },
        size: windowSize,
        zIndex: nextZIndex
      };
      
      // Use functional update form to ensure latest state
      setOpenWindows((prevWindows) => [...prevWindows, newWindow]);
      setActiveWindowId(id);
      setNextZIndex(prev => prev + 1);
    }
  };

  const bringToFront = (id: string) => {
    setActiveWindowId(id);
    setOpenWindows(openWindows.map(window => {
      if (window.id === id) {
        return { ...window, zIndex: nextZIndex };
      }
      return window;
    }));
    setNextZIndex(nextZIndex + 1);
  };

  const startDrag = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the window
    const window = openWindows.find(w => w.id === id);
    if (!window) return;
    
    // Calculate the offset between mouse position and window position
    const offsetX = e.clientX - window.position.x;
    const offsetY = e.clientY - window.position.y;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setDragging(id);
    bringToFront(id);
  };

  const startResize = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the window
    const window = openWindows.find(w => w.id === id);
    if (!window) return;
    
    setResizeStart({
      start: { x: e.clientX, y: e.clientY },
      size: window.size
    });
    setResizing(id);
    bringToFront(id);
  };

  const onDrag = (e: MouseEvent) => {
    if (!dragging) return;
    
    setOpenWindows(prevWindows => prevWindows.map(window => {
      if (window.id === dragging) {
        return {
          ...window,
          position: {
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          }
        };
      }
      return window;
    }));
  };

  const onResize = (e: MouseEvent) => {
    if (!resizing || !resizeStart) return;
    
    const deltaX = e.clientX - resizeStart.start.x;
    const deltaY = e.clientY - resizeStart.start.y;
    
    setOpenWindows(prevWindows => prevWindows.map(window => {
      if (window.id === resizing) {
        return {
          ...window,
          size: {
            width: Math.max(300, resizeStart.size.width + deltaX),
            height: Math.max(200, resizeStart.size.height + deltaY)
          }
        };
      }
      return window;
    }));
  };

  const stopDrag = () => {
    setDragging(null);
  };

  const stopResize = () => {
    setResizing(null);
    setResizeStart(null);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
    }
    
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [dragging, openWindows, dragOffset]);

  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResize);
    }
    
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [resizing, openWindows, resizeStart]);

  const getWindowByID = (id: string) => {
    return openWindows.find(w => w.id === id);
  };

  const renderWindow = (id: string) => {
    const windowData = getWindowByID(id);
    if (!windowData) return null;

    const windowStyle = {
      position: 'absolute' as const,
      left: `${windowData.position.x}px`,
      top: `${windowData.position.y}px`,
      width: `${windowData.size.width}px`,
      height: id === 'chat' ? `${windowData.size.height}px` : 'auto',
      zIndex: windowData.zIndex
    };

    const isActive = activeWindowId === id;
    const activeClass = isActive ? 'ring-2 ring-trendpup-orange' : '';

    switch(id) {
      case 'dashboard':
        return (
          <div 
            className={`bg-white rounded-xl shadow-2xl border-2 border-black overflow-hidden ${activeClass}`}
            style={windowStyle}
          >
            <div 
              className="bg-gradient-to-r from-trendpup-dark to-gray-800 text-white p-3 flex justify-between items-center cursor-move"
              onMouseDown={(e) => startDrag(e, id)}
            >
              <div className="flex items-center">
                <FaDog className="mr-2" />
                <h2 className="text-xl font-bold">Dashboard</h2>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWindow(id);
                }}
                className="bg-red-600 hover:bg-red-700 p-1.5 rounded-full text-white transition-colors z-50"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dashboard widgets */}
                <div className="bg-gradient-to-br from-trendpup-beige/50 to-trendpup-beige p-4 rounded-xl shadow-sm">
                  <h3 className="text-lg font-semibold text-trendpup-dark mb-1">Total Value</h3>
                  <p className="text-2xl font-bold text-trendpup-orange">$0.00</p>
                </div>
                <div className="bg-gradient-to-br from-trendpup-beige/50 to-trendpup-beige p-4 rounded-xl shadow-sm">
                  <h3 className="text-lg font-semibold text-trendpup-dark mb-1">24h Change</h3>
                  <p className="text-2xl font-bold text-green-600">+0.00%</p>
                </div>
                <div className="md:col-span-2 bg-gradient-to-br from-trendpup-beige/50 to-trendpup-beige p-4 rounded-xl shadow-sm">
                  <h3 className="text-lg font-semibold text-trendpup-dark mb-1">Active Positions</h3>
                  <p className="text-2xl font-bold text-trendpup-orange">0</p>
                </div>
              </div>
            </div>
            {/* Resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-30 flex items-center justify-center"
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(e, id);
              }}
            >
              <FaExpand className="text-black/50 rotate-45" size={14} />
            </div>
          </div>
        );
      case 'chat':
        return (
          <div 
            className={`bg-white rounded-xl shadow-2xl border-2 border-black overflow-hidden ${activeClass}`}
            style={{
              ...windowStyle,
              width: `${Math.max(windowData.size.width, 600)}px`, // Increased minimum width
              height: `${Math.max(windowData.size.height, 500)}px`, // Increased minimum height
            }}
          >
            <div 
              className="bg-gradient-to-r from-sniffle-dark to-gray-800 text-white p-3 flex justify-between items-center cursor-move"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startDrag(e, id);
              }}
            >
              <div className="flex items-center">
                <FaComments className="mr-2" />
                <h2 className="text-xl font-bold">Sniffle Chat</h2>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWindow(id);
                }}
                className="bg-red-600 hover:bg-red-700 p-1.5 rounded-full text-white transition-colors z-50"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div 
              className="h-[calc(100%-48px)] overflow-hidden"
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
            >
              <ChatInterface windowMode={true} />
            </div>
            {/* Resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-30 flex items-center justify-center"
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(e, id);
              }}
            >
              <FaExpand className="text-black/50 rotate-45" size={14} />
            </div>
          </div>
        );
      case 'memecoins':
        return (
          <div 
            className={`bg-white rounded-xl shadow-2xl border-2 border-black overflow-hidden ${activeClass}`}
            style={windowStyle}
          >
            <div 
              className="bg-gradient-to-r from-trendpup-dark to-gray-800 text-white p-3 flex justify-between items-center cursor-move"
              onMouseDown={(e) => startDrag(e, id)}
            >
              <div className="flex items-center">
                <FaChartLine className="mr-2" />
                <h2 className="text-xl font-bold">Memecoins</h2>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWindow(id);
                }}
                className="bg-red-600 hover:bg-red-700 p-1.5 rounded-full text-white transition-colors z-50"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-4 max-h-[500px] overflow-auto">
              <MemecoinsExplorer />
            </div>
            {/* Resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-30 flex items-center justify-center"
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(e, id);
              }}
            >
              <FaExpand className="text-black/50 rotate-45" size={14} />
            </div>
          </div>
        );
      case 'stats':
        return (
          <div 
            className={`bg-white rounded-xl shadow-2xl border-2 border-black overflow-hidden ${activeClass}`}
            style={windowStyle}
          >
            <div 
              className="bg-gradient-to-r from-trendpup-dark to-gray-800 text-white p-3 flex justify-between items-center cursor-move"
              onMouseDown={(e) => startDrag(e, id)}
            >
              <div className="flex items-center">
                <FaChartBar className="mr-2" />
                <h2 className="text-xl font-bold">Statistics</h2>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWindow(id);
                }}
                className="bg-red-600 hover:bg-red-700 p-1.5 rounded-full text-white transition-colors z-50"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-br from-trendpup-beige/50 to-trendpup-beige p-4 rounded-xl shadow-sm mb-4">
                <h3 className="text-lg font-semibold text-trendpup-dark mb-2">Top Gainers</h3>
                <p className="text-gray-600">No data available</p>
              </div>
              <div className="bg-gradient-to-br from-trendpup-beige/50 to-trendpup-beige p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-trendpup-dark mb-2">Market Overview</h3>
                <p className="text-gray-600">No data available</p>
              </div>
            </div>
            {/* Resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-30 flex items-center justify-center"
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(e, id);
              }}
            >
              <FaExpand className="text-black/50 rotate-45" size={14} />
            </div>
          </div>
        );
      case 'whitepaper':
        return (
          <div 
            className={`bg-white rounded-xl shadow-2xl border-2 border-black overflow-hidden ${activeClass}`}
            style={windowStyle}
          >
            <div 
              className="bg-gradient-to-r from-trendpup-dark to-gray-800 text-white p-3 flex justify-between items-center cursor-move"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startDrag(e, id);
              }}
            >
              <div className="flex items-center">
                <FaFileAlt className="mr-2" />
                <h2 className="text-xl font-bold">Sniffle Whitepaper</h2>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWindow(id);
                }}
                className="bg-red-600 hover:bg-red-700 p-1.5 rounded-full text-white transition-colors z-50"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[500px]">
              <h1 className="text-2xl font-bold text-sniffle-dark mb-3">Sniffle: BNB Smart Chain AI Memecoin Intelligence</h1>
              <p className="text-sm text-blue-600 mb-4">🏆 FAIR3 Fairness Hackathon Submission - Tech Fairness + BNB Chain + AI × Web3</p>
              
              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">Executive Summary</h2>
              <div className="prose prose-sm">
                <p className="mb-3">Sniffle is the premier free AI-powered memecoin intelligence platform designed exclusively for the BNB Smart Chain ecosystem. Through an innovative voice-enabled interface, users can interact naturally with advanced AI agents to discover high-potential BEP-20 tokens before major price movements.</p>
                <p className="mb-3">The platform combines real-time data scraping from BSC DEXs (PancakeSwap, BiSwap, Apeswap), social sentiment analysis, and sophisticated AI models to provide professional-grade trading insights. With hands-free voice input and text-to-speech responses, users can query markets, analyze tokens, and receive investment recommendations while maintaining their focus on trading activities.</p>
              </div>

              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">🏆 Hackathon Track Alignment</h2>
              <div className="prose prose-sm">
                <h3 className="text-lg font-semibold text-sniffle-dark mt-4 mb-2">🎯 Tech Fairness Implementation</h3>
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>Algorithm Transparency:</strong> Open-source AI models with explainable risk scoring for BEP-20 tokens</li>
                  <li><strong>Data Sovereignty:</strong> Users maintain control over their wallet data and trading preferences</li>
                  <li><strong>Sustainable Income:</strong> Democratizes professional-grade trading intelligence, previously exclusive to institutions</li>
                  <li><strong>Human-Centered AI:</strong> Voice-first interface makes AI accessible to all users, regardless of technical expertise</li>
                </ul>

                <h3 className="text-lg font-semibold text-sniffle-dark mt-4 mb-2">🔗 BNB Chain Integration</h3>
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>Native BEP-20 Analysis:</strong> Built specifically for BNB Smart Chain ecosystem with deep protocol integration</li>
                  <li><strong>BSC DEX Integration:</strong> Real-time data from PancakeSwap, BiSwap, and other BSC protocols</li>
                  <li><strong>Multi-Wallet Support:</strong> Seamless integration with MetaMask, Trust Wallet, Binance Chain Wallet</li>
                  <li><strong>Cross-Chain Composability:</strong> Designed for future expansion to other EVM-compatible chains</li>
                </ul>

                <h3 className="text-lg font-semibold text-sniffle-dark mt-4 mb-2">🤖 AI × Web3 Innovation</h3>
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>Multi-Agent Coordination:</strong> Specialized AI agents for different aspects of token analysis</li>
                  <li><strong>Voice-Enabled Interface:</strong> Natural language processing for hands-free trading insights</li>
                  <li><strong>Decentralized Intelligence:</strong> Community-driven AI that learns from collective trading patterns</li>
                  <li><strong>Mass-Market Accessibility:</strong> Scalable architecture for millions of users</li>
                </ul>
              </div>

              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">Voice Interface Features</h2>
              <div className="prose prose-sm">
                <h3 className="text-lg font-semibold text-sniffle-dark mt-4 mb-2">🎤 Voice Input</h3>
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>Hands-free Queries:</strong> Ask about BSC tokens using natural speech</li>
                  <li><strong>Multi-browser Support:</strong> Works with Chrome, Edge, Safari, and other modern browsers</li>
                  <li><strong>Continuous Listening:</strong> Advanced speech recognition that stays active during conversation</li>
                  <li><strong>Smart Interruption:</strong> Stop and restart voice input seamlessly</li>
                </ul>

                <h3 className="text-lg font-semibold text-sniffle-dark mt-4 mb-2">🔊 Text-to-Speech Output</h3>
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>Natural AI Voice:</strong> High-quality speech synthesis for AI responses</li>
                  <li><strong>Customizable Settings:</strong> Adjustable speech rate, pitch, and volume</li>
                  <li><strong>Smart Voice Selection:</strong> Automatically chooses the best available voice for your system</li>
                  <li><strong>Toggle Control:</strong> Easy on/off control via speaker button in chat header</li>
                </ul>
              </div>

              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">Technology Infrastructure</h2>
              
              <h3 className="text-lg font-semibold text-sniffle-dark mt-4 mb-2">BNB Smart Chain Integration</h3>
              <div className="prose prose-sm">
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>Network Details:</strong>
                    <ul className="list-disc pl-5 mt-1">
                      <li>Chain ID: 97 (Testnet)</li>
                      <li>Native Currency: BNB</li>
                      <li>RPC URL: api.zan.top/bsc-testnet</li>
                      <li>Block Explorer: testnet.bscscan.com</li>
                    </ul>
                  </li>
                  <li><strong>Multi-Wallet Integration:</strong>
                    <ul className="list-disc pl-5 mt-1">
                      <li>MetaMask, Trust Wallet, Binance Chain Wallet support</li>
                      <li>Seamless connection to BNB Smart Chain testnet</li>
                      <li>Real-time balance and transaction monitoring</li>
                    </ul>
                  </li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-sniffle-dark mt-4 mb-2">AI Analysis Engine</h3>
              <div className="prose prose-sm">
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>Data Aggregation:</strong> Scraper collects BNB Smart Chain token data from DEXs and scrapes Twitter for token-related tweets and sentiment.</li>
                  <li><strong>AI Analysis (Launch IO AI Models):</strong> Reads tweets and BSC token data, determines risk score, investment potential, and provides rationale for each BEP-20 token.</li>
                  <li><strong>Custom Agent (Launch IO AI Models + RAG):</strong> Answers user queries with the latest BSC token data and in-depth analysis using Retrieval-Augmented Generation.</li>
                </ul>
              </div>

              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">Strategic Advantages</h2>
              <div className="prose prose-sm">
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>BSC Exclusivity:</strong> Dedicated focus on the unique dynamics and opportunities within the BNB Smart Chain ecosystem</li>
                  <li><strong>Early Signal Detection:</strong> Proprietary algorithms capable of identifying promising BEP-20 tokens hours or days before mainstream awareness</li>
                  <li><strong>Integrated Data Intelligence:</strong> Unified analysis combining social indicators with on-chain BSC metrics</li>
                  <li><strong>Voice-First Design:</strong> Revolutionary hands-free operation for active traders</li>
                  <li><strong>Free Access Model:</strong> Democratizing access to professional-grade trading intelligence</li>
                  <li><strong>Community-Driven:</strong> Open-source development with transparent governance</li>
                  <li><strong>Fairness-First:</strong> No subscription fees, no premium tiers, no gatekeepers</li>
                </ul>
              </div>

              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">Hackathon Innovation</h2>
              <div className="prose prose-sm">
                <p className="mb-3">Sniffle represents a paradigm shift in how retail traders access market intelligence. By combining the transparency of Web3 with the power of AI and the accessibility of voice interaction, we're building the first truly fair memecoin intelligence platform.</p>
                <p className="mb-3">Our submission demonstrates how tech fairness principles can be applied to real-world financial applications, creating sustainable income opportunities for retail traders while maintaining complete transparency and user control.</p>
              </div>

              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">Success Metrics</h2>
              <div className="prose prose-sm">
                <ul className="list-disc pl-5 mb-4">
                  <li><strong>User Satisfaction:</strong> 95%+ User Retention on BSC</li>
                  <li><strong>Detection Accuracy:</strong> 90%+ BEP-20 Scam Detection Rate</li>
                  <li><strong>Early Warning Speed:</strong> 2-6 Hours Before BSC Pump</li>
                  <li><strong>ROI Performance:</strong> Average 15x Return on BSC Tokens</li>
                  <li><strong>Voice Interface Adoption:</strong> 70%+ Voice Feature Usage</li>
                </ul>
              </div>

              <h2 className="text-xl font-bold text-sniffle-dark mt-6 mb-3">Contact Information</h2>
              <div className="prose prose-sm">
                <p className="mb-2"><strong>FAIR3 Fairness Hackathon Submission</strong></p>
                <p className="mb-2">Competing in: Tech Fairness • BNB Chain Integration • AI × Web3 • Public Infrastructure</p>
                <p className="italic mt-4">Email: tanishqgupta322@gmail.com | Twitter: @Sniffle_BSC | Discord: tbd</p>
                <p className="text-xs text-gray-600 mt-2">Built with ❤️ for the BNB Smart Chain ecosystem</p>
              </div>
            </div>
            {/* Resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-30 flex items-center justify-center"
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(e, id);
              }}
            >
              <FaExpand className="text-black/50 rotate-45" size={14} />
            </div>
          </div>
        );
      case 'wallet':
        return (
          <div 
            className={`bg-white rounded-xl shadow-2xl border-2 border-black overflow-hidden ${activeClass}`}
            style={windowStyle}
          >
            <div 
              className="bg-gradient-to-r from-trendpup-dark to-gray-800 text-white p-3 flex justify-between items-center cursor-move"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startDrag(e, id);
              }}
            >
              <div className="flex items-center">
                <FaWallet className="mr-2" />
                <h2 className="text-xl font-bold">Wallet</h2>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWindow(id);
                }}
                className="bg-red-600 hover:bg-red-700 p-1.5 rounded-full text-white transition-colors z-50"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div className="p-6 text-center">
              <Image 
                src="/trendpup-logo.png" 
                alt="Wallet" 
                width={80} 
                height={80}
                className="mx-auto mb-4" 
              />
              <h2 className="text-xl font-bold text-trendpup-dark mb-2">Connect Your Wallet</h2>
              {isConnected ? (
                <div className="space-y-4">
                  <p className="text-gray-600">Connected to BNB Smart Chain Testnet</p>
                  <p className="text-gray-600">Address:</p>
                  <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                    {address}
                  </p>
                  <button 
                    onClick={() => disconnect()}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 mb-6">Connect your wallet to the BNB Smart Chain testnet to track your memecoin investments</p>
                  <div className="flex justify-center">
                    <ConnectButton />
                  </div>
                </div>
              )}
            </div>
            {/* Resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-30 flex items-center justify-center"
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(e, id);
              }}
            >
              <FaExpand className="text-black/50 rotate-45" size={14} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Function to open multiple windows at once
  const openMultipleWindows = (ids: string[]) => {
    console.log("Opening multiple windows:", ids);
    const newWindows = ids
      .filter(id => !openWindows.some(w => w.id === id))
      .map((id, index) => {
        // Center windows based on container size
        const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
        const containerHeight = containerRef.current?.clientHeight || window.innerHeight;
        const windowSize = getDefaultWindowSize(id);
        
        return {
          id,
          position: {
            x: (containerWidth / 2) - (windowSize.width / 2) + (index * 40),
            y: (containerHeight / 2) - (windowSize.height / 2) + (index * 40)
          },
          size: windowSize,
          zIndex: nextZIndex + index
        };
      });
    
    if (newWindows.length > 0) {
      console.log("Adding new windows:", newWindows);
      setOpenWindows(prevWindows => [...prevWindows, ...newWindows]);
      setActiveWindowId(newWindows[newWindows.length - 1].id);
      setNextZIndex(prevZIndex => prevZIndex + newWindows.length);
    }
  };

  const renderLandingPage = () => {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white/95 rounded-3xl shadow-2xl border border-trendpup-brown/10 p-8 md:p-12 max-w-md w-full text-center">
            <div className="flex justify-center mb-6">
              <Image 
                src="/trendpup-logo.png" 
                alt="Sniffle Logo" 
                width={200} 
                height={200}
                priority
                className="rounded-full"
              />
            </div>
            
            <h1 className="text-3xl font-bold text-sniffle-dark mb-2">Sniffle AI</h1>
            <p className="text-gray-600 mb-8 md:mb-10 text-sm">
              An autonomous AI agent that finds trending memecoins on BNB Smart Chain with voice interaction.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
              onClick={(e) => {
                e.stopPropagation();
                  setAppStarted(true);
                  setChatMode(false);
                // Open dashboard and chat windows automatically
                setTimeout(() => {
                  openMultipleWindows([]);
                }, 100);
                }}
                className="px-6 md:px-8 py-3 bg-trendpup-beige text-trendpup-dark rounded-lg font-medium hover:bg-trendpup-beige/80 transition-colors shadow-sm"
              >
                Get Started
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setAppStarted(true);
                  setChatMode(true);
                  setTimeout(() => {
                    toggleWindow('chat');
                  }, 100);
                }}
                className="px-6 md:px-8 py-3 bg-trendpup-beige text-trendpup-dark rounded-lg font-medium hover:bg-trendpup-beige/80 transition-colors shadow-sm"
              >
                Chat Mode
              </button>
            </div>
          </div>
        </div>
      );
  };

      return (
    <main 
      ref={containerRef}
      className="min-h-screen dashboard-bg relative overflow-hidden"
      onClick={(e) => {
        e.stopPropagation();
        activeWindowId && bringToFront(activeWindowId);
      }}
    >
        {/* Landing page */}
        {!appStarted && renderLandingPage()}

        {/* Dashboard */}
        {appStarted && (
          <>
            {/* Top right buttons */}
            <div className="absolute top-4 right-4 flex items-center space-x-3 z-50">
              {/* Whitepaper Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWindow('whitepaper');
                }}
                className={`p-2 rounded-lg transition-colors shadow-lg flex items-center ${
                  openWindows.some(w => w.id === 'whitepaper')
                    ? 'bg-trendpup-orange text-white'
                    : 'bg-white text-trendpup-dark hover:bg-white/90'
                }`}
                title="Whitepaper"
              >
                <FaFileAlt size={18} className="mr-2" />
                <span className="hidden md:inline">Whitepaper</span>
              </button>

              {/* Connect Button */}
              <div className="p-2 rounded-lg shadow-lg bg-white">
                <ConnectButton />
              </div>
            </div>

            {/* Side Menu Squares - now with better styling */}
            <div className="fixed left-6 top-1/2 transform -translate-y-1/2 space-y-5 z-40">
              {menuItems.filter(item => item.id !== 'whitepaper').map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWindow(item.id);
                  }}
                  className={`w-14 h-14 flex items-center justify-center rounded-xl transition-all duration-200 shadow-lg ${
                    openWindows.some(w => w.id === item.id)
                      ? 'bg-trendpup-orange text-white scale-110'
                      : 'bg-white text-trendpup-dark hover:bg-trendpup-beige hover:scale-105'
                  }`}
                  title={item.label}
                >
                  <span className="text-2xl">{item.icon}</span>
                </button>
              ))}
            </div>

            {/* Windows Area */}
            <div className="h-screen">
              {/* Debug info - remove in production */}
              <div className="fixed bottom-2 left-2 text-xs text-black/50 z-10">
                Open windows: {openWindows.map(w => w.id).join(', ')}
              </div>
              
              {openWindows.map((window) => (
                <div 
                  key={window.id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    bringToFront(window.id);
                  }}
                >
                  {renderWindow(window.id)}
                </div>
              ))}
            </div>

            {/* Welcome message if no windows are open */}
            {openWindows.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-12 bg-white/90 rounded-2xl shadow-lg max-w-md border-2 border-black">
                  <Image 
                    src="/trendpup-logo.png" 
                    alt="Sniffle Logo" 
                    width={100} 
                    height={100}
                    className="mx-auto mb-4" 
                  />
                  <h2 className="text-2xl font-bold text-sniffle-dark mb-4">Welcome to Sniffle</h2>
                  <p className="text-gray-600 mb-6">Click on the menu items on the left to get started with BNB Smart Chain memecoin intelligence</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Debug info - remove in production */}
      </main>
  );
}