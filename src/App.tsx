import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Network, MapPin, Eye, Wifi, Monitor } from 'lucide-react';

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
  screen_resolution?: string
  timezone?: string
  browser_language?: string
  connection_type?: string
  webrtc_ips?: string
  canvas_fingerprint?: string
  fonts_detected?: number
  plugins_count?: number
  is_vpn_detected?: boolean
  threat_level?: string
}

// Enhanced IP detection with WebRTC leak detection
async function getVisitorIP(): Promise<{ publicIP: string | null; localIPs: string[] }> {
  let publicIP: string | null = null;
  let localIPs: string[] = [];

  // Try to get public IP from services
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
      const ip = data.ip || data.query || data.ipAddress || data.origin
      if (ip && typeof ip === 'string') {
        const cleanIP = ip.split(':')[0]
        if (cleanIP.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          publicIP = cleanIP
          break
        }
      }
    } catch (error) {
      console.warn(`Failed to get IP from ${service}:`, error)
      continue
    }
  }

  // Try WebRTC IP leak detection (can bypass some VPNs)
  try {
    const rtcIPs = await getWebRTCIPs()
    localIPs = rtcIPs
  } catch (error) {
    console.warn('WebRTC IP detection failed:', error)
  }

  return { publicIP, localIPs }
}

// WebRTC IP leak detection
function getWebRTCIPs(): Promise<string[]> {
  return new Promise((resolve) => {
    const ips: string[] = []
    const rtc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    
    rtc.createDataChannel('')
    rtc.onicecandidate = (e) => {
      if (e.candidate) {
        const ip = e.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/)?.[1]
        if (ip && !ips.includes(ip)) {
          ips.push(ip)
        }
      }
    }
    
    rtc.createOffer().then(offer => rtc.setLocalDescription(offer))
    
    setTimeout(() => {
      rtc.close()
      resolve(ips)
    }, 2000)
  })
}

// Canvas fingerprinting
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'unavailable'
    
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Honeypot fingerprint 🍯', 2, 2)
    return canvas.toDataURL().slice(22, 32) // Short hash
  } catch (error) {
    return 'blocked'
  }
}

// Font detection
function detectFonts(): number {
  const testFonts = [
    'Arial', 'Times New Roman', 'Courier New', 'Helvetica', 'Verdana',
    'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Arial Black', 'Impact', 'Segoe UI', 'Tahoma'
  ]
  
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return 0
  
  let fontsDetected = 0
  const baselineText = 'mmmmmmmmmmlli'
  
  testFonts.forEach(font => {
    context.font = `72px ${font}, monospace`
    const width = context.measureText(baselineText).width
    
    context.font = '72px monospace'
    const baselineWidth = context.measureText(baselineText).width
    
    if (width !== baselineWidth) {
      fontsDetected++
    }
  })
  
  return fontsDetected
}

// Enhanced geolocation
async function getGeoLocation(ip: string): Promise<{ country?: string; city?: string; isp?: string; org?: string; as?: string }> {
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
      city: data.city,
      isp: data.org,
      org: data.org,
      as: data.asn
    }
  } catch (error) {
    console.warn('Failed to get geolocation:', error)
    return {}
  }
}

// VPN Detection
function detectVPNUsage(visitorData: VisitorData): boolean {
  if (!visitorData.timezone || !visitorData.country) return false
  
  const timezone = visitorData.timezone.toLowerCase()
  const country = visitorData.country.toLowerCase()
  const city = (visitorData.city || '').toLowerCase()
  
  return !timezone.includes(country) && 
         !timezone.includes(city) &&
         !timezone.includes(country.slice(0, 3))
}

// Enhanced visitor info collection
function getVisitorInfo(): Partial<VisitorData> {
  const sessionId = Math.random().toString(36).substr(2, 9).toUpperCase()
  
  const connectionType = (navigator as any).connection?.effectiveType || 
                        (navigator as any).connection?.type || 'unknown'
  
  return {
    session_id: sessionId,
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browser_language: navigator.language,
    connection_type: connectionType,
    canvas_fingerprint: getCanvasFingerprint(),
    fonts_detected: detectFonts(),
    plugins_count: navigator.plugins.length,
  }
}

// Enhanced Supabase save with threat analysis
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

    console.log('✅ Enhanced data saved to Supabase successfully')
    return { success: true }
  } catch (error) {
    console.error('❌ Failed to save to Supabase:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Main enhanced data collection
async function collectVisitorData(): Promise<{ success: boolean; data: VisitorData; error?: string }> {
  try {
    console.log('🔍 Starting enhanced IP collection...')
    
    // Get visitor IPs (public + WebRTC leak)
    const ipData = await getVisitorIP()
    console.log(`📍 Public IP: ${ipData.publicIP || 'Failed'}`)
    console.log(`🔍 WebRTC IPs: ${ipData.localIPs.join(', ') || 'None'}`)
    
    // Get other visitor info
    const visitorInfo = getVisitorInfo()
    
    // Get enhanced geolocation
    let geoInfo = {}
    if (ipData.publicIP) {
      geoInfo = await getGeoLocation(ipData.publicIP)
      console.log(`🌍 Location: ${(geoInfo as any).city || 'Unknown'}, ${(geoInfo as any).country || 'Unknown'}`)
    }
    
    // Combine all data
    const visitorData: VisitorData = {
      ...visitorInfo,
      ip_address: ipData.publicIP || 'Unable to detect',
      webrtc_ips: ipData.localIPs.join(', '),
      ...geoInfo,
      timestamp: new Date().toISOString()
    }
    
    // Detect VPN and assign threat level
    visitorData.is_vpn_detected = detectVPNUsage(visitorData)
    visitorData.threat_level = visitorData.is_vpn_detected ? 'HIGH' : 'MEDIUM'
    
    console.log(`⚠️ VPN Detected: ${visitorData.is_vpn_detected}`)
    console.log(`🎯 Threat Level: ${visitorData.threat_level}`)
    
    // Save to Supabase
    const saveResult = await saveToSupabase(visitorData)
    
    return {
      success: true,
      data: visitorData,
      error: saveResult.success ? undefined : saveResult.error
    }
    
  } catch (error) {
    console.error('❌ Error in enhanced collectVisitorData:', error)
    
    const fallbackData: VisitorData = {
      ...getVisitorInfo(),
      ip_address: 'Collection failed',
      timestamp: new Date().toISOString(),
      threat_level: 'UNKNOWN'
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
    const collectData = async () => {
      try {
        const result = await collectVisitorData();
        setVisitorData(result.data);
        setIpCollected(true);
        
        if (result.success) {
          console.log('✅ Enhanced visitor data collected and logged:', result.data);
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
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-green-500 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-green-400 font-mono">
                {Math.floor(progress)}%
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Document Security Portal
            </h1>
            <div className="flex items-center justify-center space-x-2 text-green-400">
              <Shield className="w-5 h-5 animate-pulse" />
              <span className="font-mono text-sm">
                {progress < 20 && "Initializing secure connection..."}
                {progress >= 20 && progress < 40 && "Scanning network parameters..."}
                {progress >= 40 && progress < 60 && "Deploying fingerprint analysis..."}
                {progress >= 60 && progress < 80 && "Running VPN detection..."}
                {progress >= 80 && progress < 95 && "Authenticating access..."}
                {progress >= 95 && "Finalizing threat assessment..."}
              </span>
            </div>
          </div>

          <div className="w-80 max-w-full mx-auto">
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
              <span>Deep scanning...</span>
              <span>{Math.floor(progress)}% Complete</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-4 text-orange-500 opacity-30">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-mono">Advanced Threat Detection: Active</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  const isVPNDetected = visitorData && detectVPNUsage(visitorData)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-8 px-4">
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
          
          <div className="space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
              THANK YOU FOR YOUR
              <br />
              <span className="text-red-400 font-black">IP ADDRESS</span>
            </h1>
            
            {/* Enhanced IP Display with VPN Detection */}
            {visitorData?.ip_address && (
              <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-6 max-w-md mx-auto animate-pulse">
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <Network className="w-6 h-6 text-red-400" />
                  <span className="text-red-400 font-bold text-lg">
                    {isVPNDetected ? 'VPN BYPASSED - REAL IP' : 'YOUR IP ADDRESS'}
                  </span>
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
                {isVPNDetected && (
                  <div className="mt-3 text-yellow-300 font-bold text-sm">
                    ⚠️ VPN/PROXY DETECTED - LOCATION SPOOFING FAILED
                  </div>
                )}
              </div>
            )}
            
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <span className="text-red-400 font-bold text-xl">
                  {isVPNDetected ? 'ADVANCED THREAT DETECTED' : 'SECURITY ALERT'}
                </span>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              
              <p className="text-white text-lg leading-relaxed">
                {isVPNDetected 
                  ? 'Advanced fingerprinting has bypassed your VPN and location spoofing attempts. Your real identity and device signature have been captured and reported to law enforcement.'
                  : 'Your connection details have been logged and reported to the appropriate authorities. Scamming activities are illegal and prosecutable by law.'
                }
              </p>
            </div>

            {/* Enhanced Technical Details with VPN Detection */}
            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-6 max-w-2xl mx-auto font-mono text-sm">
              <div className="text-center mb-4">
                <span className="text-red-400 font-bold">
                  ⚠️ {isVPNDetected ? 'ADVANCED FINGERPRINT CAPTURED' : 'CONNECTION LOGGED'} ⚠️
                </span>
              </div>
              
              {/* VPN Detection Warning */}
              {isVPNDetected && (
                <div className="bg-red-600/30 border border-red-400 rounded p-3 mb-4">
                  <div className="text-center text-red-300 font-bold flex items-center justify-center space-x-2">
                    <Wifi className="w-4 h-4" />
                    <span>🔍 VPN/PROXY PENETRATED 🔍</span>
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-red-200 mt-1 text-center">
                    WebRTC bypass • Canvas fingerprint • Font analysis • Deep packet inspection
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <span className="text-green-400">Real IP Location:</span>
                  <span className="text-white ml-2">
                    {visitorData?.city}, {visitorData?.country}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Device Timezone:</span>
                  <span className="text-white ml-2">
                    {visitorData?.timezone?.replace('_', ' ') || 'TRACKED'}
                  </span>
                </div>
                {visitorData?.webrtc_ips && (
                  <div className="col-span-1 md:col-span-2">
                    <span className="text-green-400">WebRTC IPs:</span>
                    <span className="text-white ml-2 text-xs">
                      {visitorData.webrtc_ips || 'None detected'}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-green-400">Canvas Hash:</span>
                  <span className="text-white ml-2">
                    {visitorData?.canvas_fingerprint || 'CAPTURED'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Fonts:</span>
                  <span className="text-white ml-2">
                    {visitorData?.fonts_detected || 0} detected
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Browser Lang:</span>
                  <span className="text-white ml-2">
                    {visitorData?.browser_language || 'LOGGED'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Connection:</span>
                  <span className="text-white ml-2">
                    {visitorData?.connection_type || 'TRACED'}
                  </span>
                </div>
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
                  <span className="text-green-400">Threat Level:</span>
                  <span className={`ml-2 font-bold ${
                    visitorData?.threat_level === 'HIGH' ? 'text-red-400' :
                    visitorData?.threat_level === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {visitorData?.threat_level || 'ASSESSED'}
                  </span>
                </div>
                <div>
                  <span className="text-green-400">Action:</span>
                  <span className="text-red-400 ml-2 font-bold">
                    {isVPNDetected ? 'FBI NOTIFIED' : 'REPORTED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Legal Notice */}
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 max-w-xl mx-auto">
              <p className="text-yellow-200 text-sm">
                ⚠️ <strong>Legal Notice:</strong> This is an advanced honeypot system with military-grade 
                fingerprinting technology. All data including device signatures, network traces, and 
                behavioral patterns have been preserved for law enforcement. If you're here legitimately, 
                please disregard this message.
              </p>
            </div>

            <p className="text-slate-400 text-xs max-w-xl mx-auto">
              Digital forensics completed at {new Date().toLocaleString()} • Evidence preserved • International authorities coordinated
              <br />
              <span className="text-red-300">
                {isVPNDetected 
                  ? 'Advanced evasion detected - Enhanced monitoring activated'
                  : 'Evidence collected and stored for legal proceedings'
                }
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
