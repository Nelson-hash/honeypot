import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Network, MapPin } from 'lucide-react';

// Environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

interface VisitorData {
  id?: string
  ip_address?: string
  user_agent?: string
  timestamp?: string
  country?: string
  city?: string
  session_id?: string
  referrer?: string
  screen_resolution?: string
  timezone?: string
}

// Function to get visitor's IP address
async function getVisitorIP(): Promise<string | null> {
  const services = [
    'https://api.ipify.org?format=json',
    'https://ipapi.co/json/',
    'https://api.my-ip.io/ip.json',
    'https://httpbin.org/ip'
  ]

  for (const service of services) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(service, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) continue
      
      const data = await response.json()
      
      // Different services have different response formats
      const ip = data.ip || data.query || data.ipAddress || data.origin
      if (ip && typeof ip === 'string') {
        // Extract IP if it's in format "ip:port" or just validate basic IP format
        const cleanIP = ip.split(':')[0]
        if (cleanIP.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          return cleanIP
        }
      }
    } catch (error) {
      console.warn(`Failed to get IP from ${service}:`, error)
      continue
    }
  }
  
  return null
}

// Function to get geolocation from IP
async function getGeoLocation(ip: string): Promise<{ country?: string; city?: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) throw new Error('Geo API failed')
    
    const data = await response.json()
    
    return {
      country: data.country_name,
      city: data.city
    }
  } catch (error) {
    console.warn('Failed to get geolocation:', error)
    return {}
  }
}

// Function to get visitor information
function getVisitorInfo(): Partial<VisitorData> {
  const sessionId = Math.random().toString(36).substr(2, 9).toUpperCase()
  
  return {
    session_id: sessionId,
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

// Function to save data to Supabase using REST API
async function saveToSupabase(data: VisitorData): Promise<{ success: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase not configured - data not saved')
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/visitor_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Supabase error: ${response.status} - ${errorText}`)
    }

    console.log('✅ Data saved to Supabase successfully')
    return { success: true }
  } catch (error) {
    console.error('❌ Failed to save to Supabase:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Main function to collect and save visitor data
async function collectVisitorData(): Promise<{ success: boolean; data: VisitorData; error?: string }> {
  try {
    console.log('🔍 Starting IP collection...')
    
    // Get visitor IP
    const ip = await getVisitorIP()
    console.log(`📍 IP collected: ${ip || 'Failed'}`)
    
    // Get other visitor info
    const visitorInfo = getVisitorInfo()
    
    // Get geolocation if IP is available
    let geoInfo = {}
    if (ip) {
      geoInfo = await getGeoLocation(ip)
      console.log(`🌍 Location: ${geoInfo.city || 'Unknown'}, ${geoInfo.country || 'Unknown'}`)
    }
    
    // Combine all data
    const visitorData: VisitorData = {
      ...visitorInfo,
      ip_address: ip || 'Unable to detect',
      ...geoInfo,
      timestamp: new Date().toISOString()
    }
    
    // Save to Supabase
    const saveResult = await saveToSupabase(visitorData)
    
    return {
      success: true,
      data: visitorData,
      error: saveResult.success ? undefined : saveResult.error
    }
    
  } catch (error) {
    console.error('❌ Error in collectVisitorData:', error)
    
    // Return basic data even if collection fails
    const fallbackData: VisitorData = {
      ...getVisitorInfo(),
      ip_address: 'Collection failed',
      timestamp: new Date().toISOString()
    }
    
    return {
      success: false,
      data: fallbackData,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function App() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [visitorData, setVisitorData] = useState<VisitorData | null>(null);
  const [ipCollected, setIpCollected] = useState(false);

  useEffect(() => {
    // Start IP collection immediately when component mounts
    const collectData = async () => {
      try {
        const result = await collectVisitorData();
        setVisitorData(result.data);
        setIpCollected(true);
        
        if (result.success) {
          console.log('✅ Visitor data collected and logged:', result.data);
        } else {
          console.warn('⚠️ Data collected but logging failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Error collecting visitor data:', error);
      }
    };

    collectData();
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
          return prev + Math.random() * 15;
        });
      }, 120);

      return () => clearInterval(interval);
    }, 320);

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
                {progress < 25 && "Initializing secure connection..."}
                {progress >= 25 && progress < 50 && "Scanning network parameters..."}
                {progress >= 50 && progress < 75 && "Verifying security protocols..."}
                {progress >= 75 && progress < 95 && "Authenticating access..."}
                {progress >= 95 && "Finalizing security check..."}
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
              <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-6 max-w-md mx-auto animate-pulse">
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <Network className="w-6 h-6 text-red-400" />
                  <span className="text-red-400 font-bold text-lg">YOUR IP ADDRESS</span>
                </div>
                <div className="text-3xl md:text-4xl font-mono font-bold text-white bg-black/50 rounded-lg py-4 px-6 border border-red-400">
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
              <div className="text-center mb-4">
                <span className="text-red-400 font-bold">⚠️ CONNECTION LOGGED ⚠️</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <span className="text-green-400">Session ID:</span>
                  <span className="text-white ml-2">
                    #{visitorData?.session_id || 'LOGGED'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Timestamp:</span>
                  <span className="text-white ml-2">
                    {visitorData?.timestamp 
                      ? new Date(visitorData.timestamp).toLocaleString()
                      : new Date().toLocaleString()
                    }
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Browser:</span>
                  <span className="text-white ml-2">
                    {visitorData?.user_agent?.includes('Chrome') ? 'Chrome' :
                     visitorData?.user_agent?.includes('Firefox') ? 'Firefox' :
                     visitorData?.user_agent?.includes('Safari') ? 'Safari' :
                     visitorData?.user_agent?.includes('Edge') ? 'Edge' : 'DETECTED'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Screen:</span>
                  <span className="text-white ml-2">
                    {visitorData?.screen_resolution || 'CAPTURED'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Timezone:</span>
                  <span className="text-white ml-2">
                    {visitorData?.timezone || 'TRACKED'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Status:</span>
                  <span className="text-red-400 ml-2 font-bold">FLAGGED</span>
                </div>
                <div>
                  <span className="text-green-400">Action:</span>
                  <span className="text-yellow-400 ml-2 font-bold">REPORTED</span>
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
              <br />
              <span className="text-red-300">Evidence collected and stored for legal proceedings</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
