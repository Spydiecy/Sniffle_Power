'use client';

import { useState, useEffect, useRef } from 'react';
import { IoSendSharp } from 'react-icons/io5';
import { FaDog, FaUser, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import Image from 'next/image';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  fullPage?: boolean;
  windowMode?: boolean; // New prop for windowed mode
}

export default function ChatInterface({ fullPage = false, windowMode = false }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Ping the agent backend once on app load to ensure the agent process is started
  if (typeof window !== 'undefined') {
    fetch('/api/agent-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__ping__' })
    }).catch(() => {});
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const messageText = input.trim();
    setMessages(prev => [...prev, {
      type: 'user',
      content: messageText,
      timestamp: new Date()
    }]);
    setIsTyping(true);
    setInput('');
    inputRef.current?.focus();
    let assistantMsg = '';
    let assistantMsgIdx = -1;
    try {
      const res = await fetch('/api/agent-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
      const data = await res.json();
      assistantMsg = data.response || data.error || '';
      setMessages(prev => {
        assistantMsgIdx = prev.length;
        return [
          ...prev,
          {
            type: 'assistant',
            content: assistantMsg,
            timestamp: new Date()
          }
        ];
      });
    } catch (error: any) {
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `Error: ${error.message || 'Failed to contact agent.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Initialize speech recognition and check permissions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check microphone permission
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
          setMicPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown');
        }).catch(() => {
          setMicPermission('unknown');
        });
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening for longer
        recognition.interimResults = true; // Show interim results
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
          setMicPermission('granted');
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Only update input with final results to avoid flickering
          if (finalTranscript) {
            setInput(prev => {
              const newValue = prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + finalTranscript;
              return newValue;
            });
          }
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          
          // Provide user-friendly error messages
          if (event.error === 'not-allowed') {
            setMicPermission('denied');
            alert('Microphone access denied. Please allow microphone access in your browser settings and try again.');
          } else if (event.error === 'no-speech') {
            // Don't show error for no-speech, just stop listening
            console.log('No speech detected');
          } else if (event.error === 'aborted') {
            console.log('Speech recognition aborted');
          } else {
            console.error('Speech recognition error:', event.error);
          }
        };

        setSpeechRecognition(recognition);
      }
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!speechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use a modern browser like Chrome or Edge.');
      return;
    }

    if (isListening) {
      console.log('Stopping speech recognition');
      speechRecognition.stop();
      setIsListening(false);
    } else {
      console.log('Starting speech recognition');
      try {
        speechRecognition.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
        alert('Could not start voice recognition. Please try again.');
      }
    }
  };

  // Auto-focus input after voice input
  useEffect(() => {
    if (!isListening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isListening]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Dynamic height calculation based on mode
  let containerHeight = 'h-[calc(100vh-8rem)]'; // Default for fullPage
  
  if (windowMode) {
    containerHeight = 'h-full'; // Use full container height in window mode
  } else if (!fullPage) {
    containerHeight = 'h-[calc(100vh-12rem)]'; // Dashboard mode
  }

  return (
    <div className={`flex flex-col ${containerHeight} max-w-4xl mx-auto rounded-xl shadow-xl overflow-hidden border border-sniffle-brown/20 bg-white`}>
      {!fullPage && !windowMode && (
        <div className="bg-sniffle-dark text-white p-4 flex items-center">
          <div className="flex-shrink-0 mr-3">
            <Image 
              src="/trendpup-logo.png" 
              alt="Sniffle Logo" 
              width={32} 
              height={32}
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Sniffle Assistant</h1>
            <p className="text-sm opacity-75">
              Connected to Sniffle Agent - Ready to chat
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-sniffle-light">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start max-w-[80%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  msg.type === 'user' ? 'bg-sniffle-orange ml-2' : 'bg-sniffle-brown mr-2'
                }`}>
                  {msg.type === 'user' ? (
                    <FaUser className="text-white text-sm" />
                  ) : (
                    <FaDog className="text-white text-sm" />
                  )}
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    msg.type === 'user'
                      ? 'bg-sniffle-orange text-white'
                      : 'bg-white text-sniffle-dark border border-sniffle-brown/20'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-xs opacity-75 mt-1 block">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-sniffle-brown mr-2 flex items-center justify-center">
                  <FaDog className="text-white text-sm" />
                </div>
                <div className="bg-white text-gray-800 rounded-lg p-3 border border-sniffle-brown/20">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-sniffle-brown rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-sniffle-brown rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-sniffle-brown rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-sniffle-brown/10">
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Ask about memecoins, trends, or market insights..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 p-3 border border-sniffle-brown/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-sniffle-orange resize-none h-12 max-h-32 min-h-[3rem]"
            rows={1}
          />
          <button
            onClick={toggleVoiceRecording}
            disabled={!isConnected || micPermission === 'denied'}
            className={`p-3 rounded-lg transition-colors ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                : micPermission === 'denied'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
            } disabled:bg-gray-100 disabled:cursor-not-allowed`}
            title={
              micPermission === 'denied' 
                ? 'Microphone access denied - check browser permissions' 
                : isListening 
                ? 'Stop recording' 
                : 'Start voice input'
            }
          >
            {isListening ? (
              <FaMicrophoneSlash className="text-xl" />
            ) : (
              <FaMicrophone className="text-xl" />
            )}
          </button>
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim()}
            className="p-3 bg-sniffle-orange text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <IoSendSharp className="text-xl" />
          </button>
        </div>
        
        {/* Voice recording status */}
        {isListening && (
          <div className="mt-2 flex items-center justify-center text-red-500 text-sm">
            <FaMicrophone className="mr-2 animate-pulse" />
            <span>🎤 Listening... Speak clearly and pause when finished</span>
            <button
              onClick={() => speechRecognition?.stop()}
              className="ml-3 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            >
              Stop
            </button>
          </div>
        )}
        
        {/* Voice input help text */}
        {speechRecognition && !isListening && micPermission === 'granted' && (
          <div className="mt-2 text-center text-xs text-gray-500">
            💡 Click the microphone to use voice input • Supported in Chrome, Edge, Safari
          </div>
        )}
        
        {speechRecognition && !isListening && micPermission === 'denied' && (
          <div className="mt-2 text-center text-xs text-red-600">
            🚫 Microphone access denied. Please enable microphone permissions in your browser settings.
          </div>
        )}
        
        {speechRecognition && !isListening && micPermission === 'unknown' && (
          <div className="mt-2 text-center text-xs text-amber-600">
            🎤 Click microphone to enable voice input (permission required)
          </div>
        )}
        
        {/* No speech recognition support */}
        {!speechRecognition && typeof window !== 'undefined' && (
          <div className="mt-2 text-center text-xs text-amber-600">
            ⚠️ Voice input not supported in this browser. Try Chrome or Edge for voice features.
          </div>
        )}
      </div>
    </div>
  );
}