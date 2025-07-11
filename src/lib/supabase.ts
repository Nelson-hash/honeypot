// Environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface VisitorData {
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
export async function getVisitorIP(): Promise<string | null> {
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
export async function getGeoLocation(ip: string): Promise<{ country?: string; city?: string }> {
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
export function getVisitorInfo(): Partial<VisitorData> {
  const sessionId = Math.random().toString(36).substr(2, 9).toUpperCase()
  
  return {
    session_id: sessionId,
    user_agent: navigator.userAgent,
    referrer: document.referrer || 'Direct',
    screen_resolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

// Function to save data to Supabase using REST API
export async function saveToSupabase(data: VisitorData): Promise<{ success: boolean; error?: string }> {
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
export async function collectVisitorData(): Promise<{ success: boolean; data: VisitorData; error?: string }> {
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
