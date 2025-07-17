'use client';

import { useState, useEffect, useRef } from 'react';
import { IoSendSharp } from 'react-icons/io5';
import { FaDog, FaUser, FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import Image from 'next/image';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  fullPage?: boolean;
  windowMode?: boolean;
}

export default function ChatInterface({ fullPage = false, windowMode = false }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Speech recognition setup using react-speech-recognition
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Ping the agent backend once on app load to ensure the agent process is started
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetch('/api/agent-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__ping__' })
      }).catch(() => {});
      
      // Load speech synthesis voices
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        // Some browsers need this event to load voices
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Text-to-speech functionality
  const speakText = (text: string) => {
    if (!speechEnabled || !('speechSynthesis' in window)) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Find a natural-sounding voice (prefer female voices for AI assistant)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Microsoft') ||
      voice.name.includes('Alex') ||
      voice.name.includes('Samantha') ||
      (voice.lang.includes('en') && voice.name.includes('Female'))
    ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setSpeechEnabled(!speechEnabled);
  };

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

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
    resetTranscript();
    inputRef.current?.focus();
    
    try {
      const res = await fetch('/api/agent-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
      const data = await res.json();
      const assistantMsg = data.response || data.error || 'No response received';
      setMessages(prev => [
        ...prev,
        {
          type: 'assistant',
          content: assistantMsg,
          timestamp: new Date()
        }
      ]);
      
      // Automatically speak the AI response if speech is enabled
      if (speechEnabled && assistantMsg && !assistantMsg.startsWith('Error:')) {
        // Small delay to ensure message is rendered
        setTimeout(() => speakText(assistantMsg), 500);
      }
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

  const toggleListening = () => {
    if (!browserSupportsSpeechRecognition) {
      alert('Browser doesn\'t support speech recognition. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ 
        continuous: true,
        language: 'en-US' 
      });
    }
  };

  // Auto-focus input after voice input stops
  useEffect(() => {
    if (!listening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [listening]);

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
      {/* Header for all modes */}
      {!fullPage && !windowMode ? (
        <div className="bg-sniffle-dark text-white p-4 flex items-center justify-between">
          <div className="flex items-center">
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
          
          {/* Speaker Control Button */}
          <button
            onClick={toggleSpeech}
            className={`p-2 rounded-lg transition-colors ${
              speechEnabled
                ? isSpeaking 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse'
                  : 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-500 hover:bg-gray-600 text-white'
            }`}
            title={
              isSpeaking 
                ? 'Speaking... Click to stop'
                : speechEnabled 
                ? 'AI Speech Enabled - Click to disable' 
                : 'AI Speech Disabled - Click to enable'
            }
          >
            {speechEnabled ? (
              isSpeaking ? (
                <FaVolumeUp className="text-lg animate-pulse" />
              ) : (
                <FaVolumeUp className="text-lg" />
              )
            ) : (
              <FaVolumeMute className="text-lg" />
            )}
          </button>
        </div>
      ) : (
        /* Header for fullPage or windowMode */
        <div className="bg-sniffle-dark text-white p-4 flex items-center justify-between">
          <div className="flex items-center">
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
                {fullPage ? 'Full Page Chat Mode' : 'AI Chat Window'} - Ready to chat
              </p>
            </div>
          </div>
          
          {/* Speaker Control Button */}
          <button
            onClick={toggleSpeech}
            className={`p-2 rounded-lg transition-colors ${
              speechEnabled
                ? isSpeaking 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse'
                  : 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-500 hover:bg-gray-600 text-white'
            }`}
            title={
              isSpeaking 
                ? 'Speaking... Click to stop'
                : speechEnabled 
                ? 'AI Speech Enabled - Click to disable' 
                : 'AI Speech Disabled - Click to enable'
            }
          >
            {speechEnabled ? (
              isSpeaking ? (
                <FaVolumeUp className="text-lg animate-pulse" />
              ) : (
                <FaVolumeUp className="text-lg" />
              )
            ) : (
              <FaVolumeMute className="text-lg" />
            )}
          </button>
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
            onClick={toggleListening}
            disabled={!isConnected || !browserSupportsSpeechRecognition}
            className={`p-3 rounded-lg transition-colors ${
              listening 
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                : browserSupportsSpeechRecognition
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            } disabled:bg-gray-100 disabled:cursor-not-allowed`}
            title={
              !browserSupportsSpeechRecognition
                ? 'Speech recognition not supported in this browser'
                : listening 
                ? 'Stop recording' 
                : 'Start voice input'
            }
          >
            {listening ? (
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
        {listening && (
          <div className="mt-2 flex items-center justify-center text-red-500 text-sm">
            <FaMicrophone className="mr-2 animate-pulse" />
            <span>🎤 Listening... Speak clearly</span>
            <button
              onClick={() => SpeechRecognition.stopListening()}
              className="ml-3 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            >
              Stop
            </button>
          </div>
        )}
        
        {/* Voice input help text */}
        {browserSupportsSpeechRecognition && !listening && (
          <div className="mt-2 text-center text-xs text-gray-500">
            💡 Click the microphone to use voice input • {isMicrophoneAvailable ? 'Microphone ready' : 'Check microphone permissions'}
          </div>
        )}
        
        {/* No speech recognition support */}
        {!browserSupportsSpeechRecognition && (
          <div className="mt-2 text-center text-xs text-amber-600">
            ⚠️ Voice input not supported in this browser. Try Chrome, Edge, or Safari for voice features.
          </div>
        )}
        
        {/* Text-to-speech status */}
        {speechEnabled && (
          <div className="mt-2 text-center text-xs text-green-600">
            🔊 AI Speech Enabled - Responses will be spoken aloud
          </div>
        )}
        
        {!speechEnabled && 'speechSynthesis' in window && (
          <div className="mt-2 text-center text-xs text-gray-500">
            🔇 AI Speech Disabled - Click the speaker button to enable voice responses
          </div>
        )}
      </div>
    </div>
  );
}
