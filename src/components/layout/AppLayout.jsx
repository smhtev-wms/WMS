import { useState } from 'react'
import { Monitor, Loader2 } from 'lucide-react'
import { supabase, adminSupabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import Sidebar from './Sidebar'
import Header, { HEADER_H } from './Header'

export default function AppLayout({ children }) {
  const { user, profile, refreshProfile } = useAuth()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  )

  const [showPersonalInfo, setShowPersonalInfo] = useState(false)
  const [isEditMode,       setIsEditMode]       = useState(false)
  const [pendingInfo,      setPendingInfo]      = useState(null)
  const [savingPersonalInfo, setSavingPersonalInfo] = useState(false)
  const [personalForm,     setPersonalForm]     = useState({ avatarName: '' })
  const [personalError,    setPersonalError]    = useState('')
  const [personalSuccess,  setPersonalSuccess]  = useState(false)

  // ── New-device detection on mount ──────────────────────────────
  // Automatic device registration after login has been removed — device setup
  // is now optional and can be opened via the Header "Edit Device" action.

  // ── Edit personal info trigger (called from Header dropdown) ────
  const openEditMode = async () => {
    setPersonalForm({ avatarName: profile?.avatar_name || '' })
    setPendingInfo({ userId: user?.id })
    setIsEditMode(true)
    setPersonalError('')
    setPersonalSuccess(false)
    setShowPersonalInfo(true)
  }

  // ── Save handler ────────────────────────────────────────────────
  const handleSavePersonalInfo = async () => {
    setSavingPersonalInfo(true)
    setPersonalError('')
    setPersonalSuccess(false)
    
    try {
      const avatarValue = personalForm.avatarName?.trim() || ''

      if (!user?.id) {
        console.warn('No authenticated user available to update profiles table; skipping profile update')
      } else {
        const uid = user.id
        console.log('Attempting profiles.update for uid:', uid, 'avatar:', avatarValue)
        const { data: profileData, error: profileError } = await adminSupabase
          .from('profiles')
          .update({ avatar_name: avatarValue || null, updated_at: new Date().toISOString() })
          .eq('id', uid)
          .select('id, avatar_name')
          .maybeSingle()

        console.log('profiles.update returned:', { profileData, profileError })
        console.log('profiles.update returned avatar_name:', profileData?.avatar_name)

        if (profileError) {
          console.error('Failed to update profiles.avatar_name:', profileError)
          setPersonalError(profileError.message || 'Failed to update profile avatar')
          setSavingPersonalInfo(false)
          return
        }

        const { data: verifyData, error: verifyError } = await adminSupabase
          .from('profiles')
          .select('id, avatar_name')
          .eq('id', uid)
          .single()

        console.log('profiles.verify after update:', { verifyData, verifyError })

        if (verifyError) {
          console.error('Failed to verify profiles.avatar_name after update:', verifyError)
        }

        if (verifyData?.avatar_name !== avatarValue) {
          console.warn('profiles.verify returned wrong avatar_name after update', {
            requested: avatarValue,
            returned: verifyData?.avatar_name,
          })
        }

        console.log('✅ profiles.avatar_name update response for user', uid, '->', avatarValue)
      }

      // Refresh the in-memory profile so UI updates everywhere, then close modal
      if (refreshProfile) {
        try {
          await refreshProfile()
        } catch (err) {
          console.warn('refreshProfile failed:', err)
        }
      }

      sessionStorage.removeItem(DEVICE_PENDING_KEY)
      setPersonalSuccess(true)
      // Close modal immediately so header re-renders from updated profile
      setShowPersonalInfo(false)
      setIsEditMode(false)
      setSavingPersonalInfo(false)
    } catch (e) {
      console.error('Personal info save error:', e)
      setPersonalError(e?.message || 'Failed to save avatar initials. Please try again.')
      setSavingPersonalInfo(false)
    }
  }

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  const sidebarW = collapsed ? 60 : 240

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div className="no-print" style={{ display: 'contents' }}>
        <Header onEditDevice={openEditMode} />
      </div>
      <div className="no-print" style={{ display: 'contents' }}>
        <Sidebar collapsed={collapsed} sidebarW={sidebarW} onToggle={toggle} />
      </div>
      <main className="app-main" style={{
        flex: 1,
        marginLeft: sidebarW,
        marginTop: HEADER_H,
        minHeight: `calc(100vh - ${HEADER_H}px)`,
        padding: '28px 32px',
        width: '100%',
        transition: 'margin-left 0.25s ease',
        minWidth: 0,
      }}>
        {children}
      </main>

      {/* ── Personal Info Edit Popup ──────────────────────────────── */}
      {showPersonalInfo && pendingInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,30,0.82)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'linear-gradient(180deg,rgba(15,20,56,0.98) 0%,rgba(10,14,42,0.99) 100%)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>

            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Monitor size={18} style={{ color: '#60a5fa' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {isEditMode ? 'Edit Personal Info' : 'New Device Detected'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {isEditMode ? 'Update your avatar initials only' : 'One-time setup — saved for all future logins'}
                </div>
              </div>
            </div>

                  <div style={{ padding: '16px 22px' }}>
              {[
                { label: 'AVATAR NAME',        key: 'avatarName', required: false, hint: 'Initials shown in the avatar circle — leave blank to use your account name' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#60a5fa', marginBottom: 6 }}>
                    {f.label}{f.required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}
                  </label>
                  <input
                    style={{ width: '100%', height: 44, padding: '0 14px', background: 'rgba(10,14,42,0.8)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, fontSize: 13, color: '#e2e8f0', fontFamily: 'inherit', outline: 'none' }}
                    value={personalForm[f.key]}
                    onChange={e => setPersonalForm(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.key === 'avatarName' ? 'e.g. PSK' : ''}
                  />
                  {f.hint && <p style={{ fontSize: 9, color: '#475569', margin: '5px 0 0', letterSpacing: '0.04em' }}>{f.hint}</p>}
                </div>
              ))}
              
              {personalError && (
                <div style={{ marginTop: 14, padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#fca5a5' }}>
                  ⚠️ {personalError}
                </div>
              )}
              
              {personalSuccess && (
                <div style={{ marginTop: 14, padding: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontSize: 12, color: '#86efac', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ✓ Personal info saved successfully!
                </div>
              )}
            </div>

            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10 }}>
              {isEditMode && (
                <button onClick={() => { setShowPersonalInfo(false); setIsEditMode(false) }} disabled={savingPersonalInfo}
                  style={{ flex: '0 0 auto', padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
              <button onClick={handleSavePersonalInfo} disabled={savingPersonalInfo}
                style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: savingPersonalInfo ? 'rgba(37,99,235,0.4)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: savingPersonalInfo ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {savingPersonalInfo
                  ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
                  : 'Update Avatar →'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
