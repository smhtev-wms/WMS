import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, adminSupabase } from './supabase'
import { getProfile, signIn as authSignIn } from './auth'
import { useTheme } from './ThemeContext'
import { stampLogout } from './loginLogs'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileLoadingRef = useRef(false)
  const lastUserIdRef = useRef(null)
  const logoutStampInProgressRef = useRef(false)
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
      setProfile(data)

      // Theme: DB wins if set; otherwise push localStorage value up to DB so
      // it survives future cache clears.
      if (data?.theme) {
        applyProfileTheme(data.theme)
      } else {
        const localTheme = localStorage.getItem('cms_theme')
        if (localTheme) {
          ;(async () => {
            try {
              await supabase.from('profiles').update({ theme: localTheme }).eq('id', data.id)
            } catch {}
          })()
        }
      }

      // Font: same logic
      if (data?.font) {
        applyProfileFont(data.font)
      } else {
        const localFont = localStorage.getItem('cms_font')
        if (localFont) {
          ;(async () => {
            try {
              await supabase.from('profiles').update({ font: localFont }).eq('id', data.id)
            } catch {}
          })()
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
        if (newSession?.user?.id) {
          lastUserIdRef.current = newSession.user.id
        }

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          console.log('🔔 Auth state sign-out event detected, stamping logout for user:', lastUserIdRef.current)
          await ensureLogoutStamped(lastUserIdRef.current)
        }
        
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

  const ensureLogoutStamped = async (userId) => {
    if (!userId || logoutStampInProgressRef.current) return
    logoutStampInProgressRef.current = true
    try {
      await stampLogout(userId)
    } catch (err) {
      console.error('Logout stamp failed:', err)
    } finally {
      logoutStampInProgressRef.current = false
    }
  }

  const signOut = async () => {
    console.log('🔓 AuthContext.signOut called')
    const userId = user?.id || session?.user?.id || lastUserIdRef.current
    await ensureLogoutStamped(userId)
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

      // Apply theme/font if present
      if (data?.theme) applyProfileTheme(data.theme)
      if (data?.font) applyProfileFont(data.font)

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