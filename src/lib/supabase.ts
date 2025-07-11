import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables - running in demo mode')
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export interface VisitorLog {
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

// Function to get visitor's IP address using multiple services
export async function getVisitorIP(): Promise<string | null> {
  const services = [
    'https://api.ipify.org?format=json',
    'https://ipapi.co/json/',
    'https://api.my-ip.io/ip.json'
  ]

  for (const service of services) {
    try {
      const response = await fetch(service, { timeout: 5000 } as any)
      const data = await response.json()
      
      // Different services have different response formats
      const ip = data.ip || data.query || data.ipAddress
      if (ip && typeof ip === 'string' && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return ip
      }
    } catch (error) {
      console.warn(`Failed to get IP from ${service}:`, error)
      continue
    }
  }
  
  return null
}

// Function to get additional visitor information
export function getVisitorInfo(): Partial<VisitorLog> {
  const sessionId = Math.random().toString(36).substr(2, 9).toUpperCase()
  
  return {
    session_id: sessionId,
    user_agent: navigator.userAgent,
    referrer: document.referrer || 'Direct',
    screen_resolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

// Function to get geolocation info from IP
export async function getGeoLocation(ip: string): Promise<{ country?: string; city?: string }> {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
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

// Main function to log visitor data
export async function logVisitor(): Promise<{ success: boolean; data?: VisitorLog; error?: string }> {
  try {
    // Get visitor IP
    const ip = await getVisitorIP()
    
    // Get other visitor info
    const visitorInfo = getVisitorInfo()
    
    // Get geolocation if IP is available
    let geoInfo = {}
    if (ip) {
      geoInfo = await getGeoLocation(ip)
    }
    
    // Combine all data
    const logData: VisitorLog = {
      ...visitorInfo,
      ip_address: ip,
      ...geoInfo
    }
    
    // Insert into Supabase if available
    if (supabase) {
      const { data, error } = await supabase
        .from('visitor_logs')
        .insert([logData])
        .select()
        .single()
      
      if (error) {
        console.error('Error logging visitor:', error)
        return { success: false, error: error.message, data: logData }
      }
      
      console.log('Visitor logged successfully:', data)
      return { success: true, data }
    } else {
      // Demo mode - just return the data without saving
      console.log('Demo mode - visitor data:', logData)
      return { success: true, data: logData }
    }
    
  } catch (error) {
    console.error('Error in logVisitor:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { ip_address: 'Error collecting IP' }
    }
  }
}
