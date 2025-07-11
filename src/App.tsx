import React, { useState, useEffect } from 'react';
import { Shield, Eye, AlertTriangle, Network, MapPin } from 'lucide-react';
import { logVisitor, type VisitorLog } from './lib/supabase';

function App() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [visitorData, setVisitorData] = useState<VisitorLog | null>(null);
  const [ipCollected, setIpCollected] = useState(false);

  useEffect(() => {
    // Start IP collection immediately when component mounts
    const collectVisitorData = async () => {
      try {
        const result = await logVisitor();
        if (result.success && result.data) {
          setVisitorData(result.data);
          setIpCollected(true);
          console.log('✅ Visitor data collected and logged:', result.data);
        } else {
          console.error('❌ Failed to collect visitor data:', result.error);
          // Still set visitor data even if logging failed
          if (result.data) {
            setVisitorData(result.data);
            setIpCollected(true);
          }
        }
      } catch (error) {
        console.error('❌ Error collecting visitor data:', error);
      }
    };

    collectVisitorData();
  }, []);

  useEffect(() => {
    // Start progress animation after a short delay
    const startProgress = setTimeout(() => {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setLoading(false);
              setTimeout(() => setShowFinalMessage(true), 500);
            }, 1000);
            return 100;
          }
          return prev + Math.random() * 12;
        });
      }, 300);

      return () => clearInterval(interval);
    }, 500);

    return () => clearTimeout(startProgress);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-8">
          {/* Loading Spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-green-500 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-green-400 font-mono">
                {Math.floor(progress)}%
              </span>
            </div>
          </div>

          {/* Loading Text */}
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Document Security Portal
            </h1>
            <div className="flex items-center justify-center space-x-2 text-green-400">
              <Shield className="w-5 h-5 animate-pulse" />
              <span className="font-mono text-sm">
                {progress < 30 && "Initializing secure connection..."}
                {progress >= 30 && progress < 60 && "Verifying security protocols..."}
                {progress >= 60 && progress < 90 && "Authenticating access..."}
                {progress >= 90 && "Finalizing verification..."}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-80 max-w-full mx-auto">
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
              <span>Processing...</span>
              <span>{Math.floor(progress)}% Complete</span>
            </div>
          </div>

          {/* Network Analysis Indicators */}
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-4 text-yellow-500 opacity-50">
              <Network className="w-4 h-4" />
              <span className="text-xs font-mono">Network Analysis Active</span>
              <Eye className="w-4 h-4" />
            </div>
            
            {ipCollected && (
              <div className="flex items-center justify-center space-x-2 text-green-400 opacity-75">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-mono">IP Address Captured</span>
              </div>
            )}
          </div>

          {/* Subtle warning indicators */}
          <div className="flex items-center justify-center space-x-4 text-orange-500 opacity-30">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-mono">Fraud Detection: Active</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-8 px-4">
        {/* Big Warning Message */}
        <div className={`transition-all duration-1000 ${showFinalMessage ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          {/* Pixelated Skull */}
          <div className="mb-8 flex justify-center">
            <div className="pixelated-skull">
              <div className="skull-row skull-row-1"></div>
              <div className="skull-row skull-row-2"></div>
              <div className="skull-row skull-row-3"></div>
              <div className="skull-row skull-row-4"></div>
              <div className="skull-row skull-row-5"></div>
              <div className="skull-row skull-row-6"></div>
              <div className="skull-row skull-row-7"></div>
              <div className="skull-row skull-row-8"></div>
              <div className="skull-row skull-row-9"></div>
              <div className="skull-row skull-row-10"></div>
              <div className="skull-row skull-row-11"></div>
              <div className="skull-row skull-row-12"></div>
            </div>
          </div>
          
          {/* Main Message */}
          <div className="space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
              THANK YOU FOR YOUR
              <br />
              <span className="text-red-400 font-black">IP ADDRESS</span>
            </h1>
            
            {/* Prominent IP Display */}
            {visitorData?.ip_address && (
              <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-6 max-w-md mx-auto">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <Network className="w-6 h-6 text-red-400" />
                  <span className="text-red-400 font-bold text-lg">YOUR IP ADDRESS</span>
                </div>
                <div className="text-3xl md:text-4xl font-mono font-bold text-white bg-black/50 rounded-lg py-4 px-6">
                  {visitorData.ip_address}
                </div>
                {visitorData.city && visitorData.country && (
                  <div className="flex items-center justify-center space-x-2 mt-3 text-red-300">
                    <MapPin className="w-4 h-4" />
                    <span className="font-semibold">{visitorData.city}, {visitorData.country}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <span className="text-red-400 font-bold text-xl">SECURITY ALERT</span>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              
              <p className="text-white text-lg leading-relaxed">
                Your connection details have been logged and reported to the appropriate authorities. 
                Scamming activities are illegal and prosecutable by law.
              </p>
            </div>

            {/* Technical Details showing collected data */}
            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-6 max-w-2xl mx-auto font-mono text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <span className="text-green-400">Session ID:</span>
                  <span className="text-white ml-2">
                    #{visitorData?.session_id || Math.random().toString(36).substr(2, 9).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Timestamp:</span>
                  <span className="text-white ml-2">{new Date().toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-green-400">Browser:</span>
                  <span className="text-white ml-2">
                    {visitorData?.user_agent?.includes('Chrome') ? 'Chrome' :
                     visitorData?.user_agent?.includes('Firefox') ? 'Firefox' :
                     visitorData?.user_agent?.includes('Safari') ? 'Safari' : 'Detected'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Screen:</span>
                  <span className="text-white ml-2">
                    {visitorData?.screen_resolution || 'Captured'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Status:</span>
                  <span className="text-red-400 ml-2">FLAGGED</span>
                </div>
                <div>
                  <span className="text-green-400">Action:</span>
                  <span className="text-yellow-400 ml-2">REPORTED</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 max-w-xl mx-auto">
              <p className="text-yellow-200 text-sm">
                ⚠️ <strong>Legal Notice:</strong> This is a honeypot designed to deter fraudulent activities. 
                If you're here legitimately, please disregard this message. All data collection 
                complies with applicable privacy laws.
              </p>
            </div>

            <p className="text-slate-400 text-xs max-w-xl mx-auto">
              Connection logged at {new Date().toLocaleString()} • Session tracked • Authorities notified
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
