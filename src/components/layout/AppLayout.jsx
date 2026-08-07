import { useState } from 'react'
import { Monitor, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
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
  const DEVICE_PENDING_KEY = 'device_pending'
  const [personalSuccess,  setPersonalSuccess]  = useState(false)

  // ── New-device detection on mount ──────────────────────────────
  // Automatic device registration after login has been removed — device setup
  // is now optional and can be opened via the Header "Edit Device" action.

  // ── Edit personal info trigger (called from Header dropdown) ────
  const openEditMode = async () => {
    setPersonalForm({
      avatarName: profile?.avatar_name || '',
      nickname: profile?.nickname || ''
    })
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
      const nicknameValue = personalForm.nickname?.trim() || ''

      if (!user?.id) {
        console.warn('No authenticated user available to update profiles table; skipping profile update')
      } else {
        const uid = user.id
        console.log('Attempting profiles.update for uid:', uid, 'avatar:', avatarValue)
        // Use anon client for browser-side writes. If update didn't affect a
        // row, fall back to upsert to create the profile row for the user.
        const updatePayload = { avatar_name: avatarValue || null, updated_at: new Date().toISOString() }
        if (nicknameValue !== '') updatePayload.nickname = nicknameValue

        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', uid)
          .select('id, avatar_name, nickname')

        console.log('profiles.update returned:', { updateData, updateError })

        if (updateError) {
          console.warn('profiles.update error, attempting upsert:', updateError.message)
        }

        let finalAvatar = avatarValue

        if (!updateError && Array.isArray(updateData) && updateData.length > 0) {
          finalAvatar = updateData[0]?.avatar_name
          console.log('✅ profiles.avatar_name updated for user', uid, '->', finalAvatar)
        } else {
          const upsertPayload = { id: uid, avatar_name: avatarValue || null, updated_at: new Date().toISOString() }
          if (nicknameValue !== '') upsertPayload.nickname = nicknameValue

          const { data: upsertData, error: upsertError } = await supabase
            .from('profiles')
            .upsert(upsertPayload, { onConflict: 'id' })
            .select('id, avatar_name, nickname')

          console.log('profiles.upsert returned:', { upsertData, upsertError })

          if (upsertError) {
            console.error('Failed to update/upsert profiles.avatar_name:', upsertError)
            setPersonalError(upsertError.message || 'Failed to update profile avatar')
            setSavingPersonalInfo(false)
            return
          }

          finalAvatar = Array.isArray(upsertData) && upsertData.length > 0 ? upsertData[0]?.avatar_name : finalAvatar
          console.log('✅ profiles.avatar_name upserted for user', uid, '->', finalAvatar)
        }
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
      <main className="app-main app-main-shell" style={{
        flex: 1,
        marginLeft: sidebarW,
        marginTop: HEADER_H,
        minHeight: `calc(100vh - ${HEADER_H}px)`,
        padding: '28px 32px 40px',
        width: '100%',
        maxWidth: '100%',
        transition: 'margin-left 0.25s ease',
        minWidth: 0,
      }}>
        {children}
      </main>

      {/* ── Personal Info Edit Popup ──────────────────────────────── */}
      {showPersonalInfo && pendingInfo && (
        <div className="modal-overlay">
          <div className="modal-panel modal-panel-sm" role="dialog" aria-labelledby="personal-info-title">

            <div className="card-header" style={{ borderRadius: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="modal-icon-wrap">
                  <Monitor size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div id="personal-info-title" className="card-title" style={{ fontSize: 14 }}>
                    {isEditMode ? 'Edit personal info' : 'New device detected'}
                  </div>
                  <p className="page-subtitle" style={{ marginTop: 2, marginBottom: 0 }}>
                    {isEditMode ? 'Update how your name appears in the header' : 'One-time setup — saved for future logins'}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '18px 22px' }}>
              {[
                { label: 'Avatar initials', key: 'avatarName', required: false, hint: 'Shown in the avatar circle — leave blank to use your account name' },
                { label: 'Nickname', key: 'nickname', required: false, hint: 'Short name on the header badge (optional)' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label className="field-label">
                    {f.label}{f.required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
                  </label>
                  <input
                    className="field-input"
                    value={personalForm[f.key]}
                    onChange={e => setPersonalForm(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.key === 'avatarName' ? 'e.g. PSK' : ''}
                  />
                  {f.hint && <p className="field-hint">{f.hint}</p>}
                </div>
              ))}

              {personalError && (
                <div className="alert alert-danger">{personalError}</div>
              )}

              {personalSuccess && (
                <div className="alert alert-success">Personal info saved successfully.</div>
              )}
            </div>

            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10 }}>
              {isEditMode && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowPersonalInfo(false); setIsEditMode(false) }}
                  disabled={savingPersonalInfo}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleSavePersonalInfo}
                disabled={savingPersonalInfo}
              >
                {savingPersonalInfo
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : 'Update'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
