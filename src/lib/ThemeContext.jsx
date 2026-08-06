import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, adminSupabase } from './supabase'

const ThemeContext = createContext()

export const THEMES = {
  royal:    { name: 'Royal',    icon: '👑', dark: false },
  ocean:    { name: 'Ocean',    icon: '🌊', dark: false },
  forest:   { name: 'Forest',   icon: '🌿', dark: false },
  crimson:  { name: 'Crimson',  icon: '🍷', dark: false },
  midnight: { name: 'Midnight', icon: '🌙', dark: true  },
  slate:    { name: 'Slate',    icon: '🪨', dark: true  },
  ember:    { name: 'Ember',    icon: '🔥', dark: true  },
  cyan:     { name: 'Cyan',     icon: '🩵', dark: true  },
}

export const FONTS = {
  outfit:   { name: 'Outfit',         sample: 'Rg', family: "'Outfit', sans-serif" },
  nunito:   { name: 'Nunito',        sample: 'Gg', family: "'Nunito', sans-serif" },
  grotesk:  { name: 'Space Grotesk', sample: 'Gq', family: "'Space Grotesk', sans-serif" },
  merri:    { name: 'Merriweather',  sample: 'Ag', family: "'Merriweather', serif" },
  crimson:  { name: 'Crimson',       sample: 'Qg', family: "'Crimson Text', serif" },
}

function applyToDOM(t) {
  localStorage.setItem('cms_theme', t)
  document.documentElement.setAttribute('data-theme', t)
}

function applyFontToDOM(f) {
  localStorage.setItem('cms_font', f)
  const family = FONTS[f]?.family || FONTS.outfit.family
  document.documentElement.style.setProperty('--font-ui', family)
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('cms_theme')
    return (saved && THEMES[saved]) ? saved : 'royal'
  })

  const [font, setFontState] = useState(() => {
    const saved = localStorage.getItem('cms_font')
    return (saved && FONTS[saved]) ? saved : 'outfit'
  })

  const savePreference = async (field, value) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.warn('[ThemeContext] Could not get session for save:', sessionError.message)
        return false
      }
      const userId = session?.user?.id
      if (!userId) return false

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[ThemeContext] Could not check profile existence:', profileError.message)
      }

      // Use the client (anon) Supabase for browser-side writes. Service role
      // keys must never be used from the browser (they cause 401 Invalid API key).
      const updateResult = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', userId)
        .select()

      if (!updateResult.error && Array.isArray(updateResult.data) && updateResult.data.length > 0) {
        return true
      }

      const upsertResult = await supabase
        .from('profiles')
        .upsert({ id: userId, [field]: value }, { onConflict: 'id' })
        .select()

      if (!upsertResult.error && Array.isArray(upsertResult.data)) {
        return true
      }

      console.warn('[ThemeContext] Could not save preference to profile:', updateResult.error?.message || upsertResult.error?.message)
      return false
    } catch (err) {
      console.warn('[ThemeContext] Save preference failed:', err.message)
      return false
    }
  }

  const setTheme = async (t) => {
    if (!THEMES[t]) return
    setThemeState(t)
    applyToDOM(t)
    await savePreference('theme', t)
  }

  const setFont = async (f) => {
    if (!FONTS[f]) return
    setFontState(f)
    applyFontToDOM(f)
    await savePreference('font', f)
  }

  const applyProfileTheme = (t) => {
    if (!t || !THEMES[t]) return
    setThemeState(t)
    applyToDOM(t)
  }

  const applyProfileFont = (f) => {
    if (!f || !FONTS[f]) return
    setFontState(f)
    applyFontToDOM(f)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    applyFontToDOM(font)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, applyProfileTheme, THEMES, font, setFont, applyProfileFont, FONTS }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
