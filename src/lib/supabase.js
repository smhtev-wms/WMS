import { createClient } from '@supabase/supabase-js'

const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY
const ENV_SUPABASE_SERVICE_ROLE = import.meta.env.VITE_SUPABASE_SERVICE_ROLE || import.meta.env.SUPABASE_SERVICE_ROLE

export const SUPABASE_URL = ENV_SUPABASE_URL || 'https://reblyjkgkyjxwnolljkf.supabase.co'
export const SUPABASE_ANON_KEY = ENV_SUPABASE_ANON_KEY || ''
export const SUPABASE_SERVICE_ROLE = ENV_SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqYXNqcnRoaWpweGxhcnJlaWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4MDMwMCwiZXhwIjoyMDkxNzU2MzAwfQ.B8oBuQRGxdkhFnvSrbddtMQ1Abo9YNwexRy1nks3Sn'

console.log('🔌 Supabase URL:', SUPABASE_URL)
console.log('🔑 Supabase Anon Key exists:', !!SUPABASE_ANON_KEY)
console.log('🔐 Supabase Service Role exists:', !!SUPABASE_SERVICE_ROLE)

// Main Supabase client with enhanced session persistence
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: 'sb-auth-token',
  }
})

// Check session on load
supabase.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    console.error('❌ Session restoration error:', error.message)
  } else if (session) {
    console.log('✅ Session restored for:', session.user?.email)
    // Test database connection only if authenticated
    supabase.from('members').select('count', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) {
          console.error('❌ Database query error:', error.message)
        } else {
          console.log('✅ Database connected!', count, 'members found')
        }
      })
  } else {
    console.log('ℹ️ No active session found - please log in')
  }
})

export const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
})

export { createClient }

export const VENDOR = { name: 'Zion Solutions', city: 'Pondicherry', phone: '+91-9994073545' }
export const LICENSE_CSV = 'https://docs.google.com/spreadsheets/d/1_F_HSaSBaaSQQb7m_zxAC1l-3krZgKd8/export?format=csv'

export function photoUrl(memberId, folder = 'active') {
  const { data } = supabase.storage.from('member-photos').getPublicUrl(`${folder}/${memberId}.jpg`)
  return data?.publicUrl || ''
}

export async function getChurch() {
  try {
    const { data, error } = await supabase.from('companies').select('*').limit(1).single()
    if (error) {
      console.error('Error fetching church:', error)
      return null
    }
    if (data) {
      return {
        ...data,
        church_name: data.church_name || data.company_name || ''
      }
    }
    return null
  } catch (error) {
    console.error('Exception fetching church:', error)
    return null
  }
}