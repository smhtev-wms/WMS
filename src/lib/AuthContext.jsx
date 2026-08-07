import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, adminSupabase } from './supabase'
import { getProfile, signIn as authSignIn } from './auth'
import { useTheme } from './ThemeContext'
import { stampLogout } from './loginLogs'
import { quickAccessLayoutStorageKey } from './quickAccessLayoutLib'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileLoadingRef = useRef(false)
  const { applyProfileTheme, applyProfileFont } = useTheme()

  // Function to load and validate profile with deduplication
  const loadProfile = useCallback(async (sessionUser) => {
    // Prevent duplicate profile loading
    if (profileLoadingRef.current) {
      console.log('⏸️ Profile already loading, skipping...')
      return
    }

    // If no session user, skip loading
    if (!sessionUser) {
      console.log('⚠️ No session user, skipping profile load')
      setProfile(null)
      return null
    }

    try {
      profileLoadingRef.current = true
      console.log('🔍 Starting getProfile for:', sessionUser.email)
      
      // Add 15 second timeout to profile loading
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile loading timeout')), 15000)
      )
      
      const { data, error: profileError } = await Promise.race([profilePromise, timeoutPromise])
      
      if (profileError) {
        console.error('❌ Error fetching profile:', profileError.message)
        setProfile(null)
        return null
      }
      
      console.log('✅ Profile loaded successfully:', data?.email)
      console.log('ℹ️ Profile avatar_name:', data?.avatar_name)

      let profileData = data
      if (data?.id && !data?.wms_quick_access) {
        try {
          const qaKey = quickAccessLayoutStorageKey(data.id)
          const raw = localStorage.getItem(qaKey)
          if (raw) {
            const layout = JSON.parse(raw)
            const { data: updated, error: qaError } = await supabase
              .from('profiles')
              .update({
                wms_quick_access: layout,
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.id)
              .select('wms_quick_access')
              .maybeSingle()
            if (!qaError && updated?.wms_quick_access) {
              profileData = { ...data, wms_quick_access: updated.wms_quick_access }
              console.log('✅ Quick Access layout synced from device to profile')
            } else if (qaError) {
              console.warn('Quick Access profile sync skipped:', qaError.message)
            }
          }
        } catch (qaSyncErr) {
          console.warn('Quick Access local → profile sync failed:', qaSyncErr)
        }
      }

      setProfile(profileData)

      // Theme: DB wins if set; otherwise push localStorage value up to DB so
      // it survives future cache clears.
      if (data?.theme) {
        applyProfileTheme(data.theme)
      } else {
        const localTheme = localStorage.getItem('cms_theme')
        if (localTheme) {
          ;(async () => { try { await adminSupabase.from('profiles').update({ theme: localTheme }).eq('id', data.id) } catch {} })()
        }
      }

      // Font: same logic
      if (data?.font) {
        applyProfileFont(data.font)
      } else {
        const localFont = localStorage.getItem('cms_font')
        if (localFont) {
          ;(async () => { try { await adminSupabase.from('profiles').update({ font: localFont }).eq('id', data.id) } catch {} })()
        }
      }

      return data
    } catch (error) {
      console.error('❌ Error loading profile:', error.message)
      setProfile(null)
      return null
    } finally {
      profileLoadingRef.current = false
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true
    
    const initializeAuth = async () => {
      try {
        console.log('🔧 AuthProvider initializing...')
        
        // Get initial session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          if (mounted) {
            setSession(null)
            setUser(null)
            setLoading(false)
          }
          return
        }
        
        if (mounted) {
          console.log('📦 Initial session:', currentSession?.user?.email || 'No session')
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
          
          if (currentSession?.user) {
            console.log('⏳ Loading profile...')
            await loadProfile(currentSession.user)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔄 Auth state changed:', event, newSession?.user?.email || 'No session')
      
      if (mounted) {
        setSession(newSession)
        setUser(newSession?.user ?? null)

        // Only load profile on INITIAL_SESSION to avoid race conditions on SIGNED_IN
        if (event === 'INITIAL_SESSION' && newSession?.user) {
          console.log('⏳ Loading profile on initial session...')
          await loadProfile(newSession.user)
        } else if (event === 'SIGNED_IN' && newSession?.user) {
          // For SIGNED_IN events (during login), load profile asynchronously
          console.log('⏳ Loading profile on sign in...')
          loadProfile(newSession.user).catch(console.error)
        } else if (!newSession) {
          setProfile(null)
        }
        
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = async (email, password) => {
    console.log('🔐 AuthContext.signIn called for:', email)
    const result = await authSignIn(email, password)
    if (result.error) {
      console.error('❌ Sign in failed:', result.error.message)
      throw result.error
    }
    console.log('✅ Sign in successful')
    return result.data
  }

  const signOut = async () => {
    console.log('🔓 AuthContext.signOut called')
    if (user?.id) await stampLogout(user.id)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
    }
    setProfile(null)
    setUser(null)
    setSession(null)
  }

  const refreshSession = async () => {
    console.log('🔄 Refreshing session...')
    const { data: { session: currentSession }, error } = await supabase.auth.getSession()
    if (!error && currentSession) {
      setSession(currentSession)
      setUser(currentSession.user ?? null)
      // Load profile for the currently signed-in user
      try {
        await loadProfile(currentSession.user)
      } catch (err) {
        console.error('Error refreshing profile during session refresh:', err)
      }
    }
    return !error && currentSession
  }

  const refreshProfile = async () => {
    try {
      // Prefer the in-memory user id, else use session user
      const userId = user?.id || (await supabase.auth.getSession()).data.session?.user?.id
      if (!userId) return false

      console.log('🔄 refreshProfile fetching profile for:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ refreshProfile fetch error:', error)
        return false
      }

      console.log('✅ refreshProfile loaded:', data?.email, 'avatar_name:', data?.avatar_name, 'profileData:', data)
      setProfile(data)

      // Apply theme/font if present, otherwise fall back to localStorage and persist
      if (data?.theme) {
        applyProfileTheme(data.theme)
      } else {
        const localTheme = localStorage.getItem('cms_theme')
        if (localTheme) {
          applyProfileTheme(localTheme)
          try {
            await supabase.from('profiles').upsert({ id: data.id, theme: localTheme }, { onConflict: 'id' })
          } catch (persistError) {
            console.warn('Failed to persist theme on refresh:', persistError)
          }
        }
      }

      if (data?.font) {
        applyProfileFont(data.font)
      } else {
        const localFont = localStorage.getItem('cms_font')
        if (localFont) {
          applyProfileFont(localFont)
          try {
            await supabase.from('profiles').upsert({ id: data.id, font: localFont }, { onConflict: 'id' })
          } catch (persistError) {
            console.warn('Failed to persist font on refresh:', persistError)
          }
        }
      }

      return true
    } catch (err) {
      console.error('refreshProfile failed:', err)
      return false
    }
  }

  const value = {
    session,
    user,
    profile,
    loading: loading,
    initialized: !loading, // initialized is true when loading is false
    signIn,
    signOut,
    refreshSession,
    refreshProfile,
    isAuthenticated: !!session
  }
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}