import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ToastProvider } from './lib/toast'
import { supabase, getChurch, LICENSE_CSV, VENDOR } from './lib/supabase'
import { checkDeviceRegistered, getDeviceRegistrationStatus, requestDeviceApproval } from './lib/loginLogs'
import { fetchCompanionStatus } from './lib/companion'

import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CompanySetupPage from './pages/CompanySetupPage'
import UsersPage from './pages/UsersPage'
import ImportPage from './pages/ImportPage'
import AnnouncementsLogPage from './pages/AnnouncementsLogPage'
import LoginLogsPage from './pages/LoginLogsPage'
import WhatsAppReceiptLogPage from './pages/WhatsAppReceiptLogPage'
import PaymentPage            from './pages/PaymentPage'
import PaymentRequestLogPage  from './pages/PaymentRequestLogPage'
import AccountingPage         from './pages/AccountingPage'
import AccountingSettingsPage from './pages/AccountingSettingsPage'
import ChartOfAccountsPage    from './pages/ChartOfAccountsPage'
import JournalEntryPage       from './pages/JournalEntryPage'
import LedgerPage             from './pages/LedgerPage'
import TrialBalancePage       from './pages/TrialBalancePage'
import FinancialStatementsPage from './pages/FinancialStatementsPage'
import BankAccountsPage        from './pages/BankAccountsPage'
import AccountingReportsPage   from './pages/AccountingReportsPage'
import SimpleAccountsDashboard    from './pages/SimpleAccountsDashboard'
import SimpleTransactionsPage     from './pages/SimpleTransactionsPage'
import SimpleCategoriesPage       from './pages/SimpleCategoriesPage'
import SimpleAccountsManagePage   from './pages/SimpleAccountsManagePage'
import SimpleReportsPage          from './pages/SimpleReportsPage'
import SimpleAccountsSettingsPage from './pages/SimpleAccountsSettingsPage'
import ReceiptVoucherPage         from './pages/ReceiptVoucherPage'
import PaymentVoucherPage         from './pages/PaymentVoucherPage'
import ContraVoucherPage          from './pages/ContraVoucherPage'
import JournalVoucherPage         from './pages/JournalVoucherPage'
import OpeningBalancesPage        from './pages/OpeningBalancesPage'
import FundsPage                  from './pages/FundsPage'
import FundReportPage             from './pages/FundReportPage'
import JournalTemplatesPage       from './pages/JournalTemplatesPage'
import YearEndClosingPage         from './pages/YearEndClosingPage'
import EventPlannerPage           from './pages/EventPlannerPage'
import EventRecorderPage          from './pages/EventRecorderPage'
import EventSettingsPage          from './pages/EventSettingsPage'
import BankReconciliationPage     from './pages/BankReconciliationPage'
import BudgetVsActualPage         from './pages/BudgetVsActualPage'
import EntityManagementPage       from './pages/EntityManagementPage'
import { EntityProvider }         from './lib/EntityContext'

console.log('📱 App component rendering')

const SPINNER = (
  <div style={{ width:32, height:32, border:'3px solid #e2e8f0', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 12px' }} />
)

const UNAUTHORIZED_DEVICE_MESSAGE = 'The application is not authorised to run on this device. Please contact TrustGate support for assistance.'

async function verifyCompanionAndDevice() {
  try {
    const payload = await fetchCompanionStatus()
    if (!payload) {
      return {
        authorized: false,
        message: 'TrustGate TM Companion is not running.',
        companionMissing: true,
        bypassStatus: 'unknown',
      }
    }

    const bypassStatus = payload?.bypassFileExists
      ? payload?.bypassValid
        ? 'active'
        : 'invalid'
      : 'absent'

    const deviceId = payload?.deviceId
    if (!deviceId) {
      return {
        authorized: Boolean(payload?.bypassActive),
        message: payload?.bypassActive
          ? 'Bypass active. Proceed to login.'
          : 'Companion app did not respond with a device ID.',
        companionMissing: false,
        bypassStatus,
        bypassPath: payload?.bypassPath,
        bypassFileExists: Boolean(payload?.bypassFileExists),
        bypassValid: Boolean(payload?.bypassValid),
      }
    }

    const deviceStatus = await getDeviceRegistrationStatus(deviceId)
    const registeredDevice = deviceStatus.approved ? deviceStatus.row : null
    if (payload?.bypassActive) {
      return {
        authorized: true,
        bypassActive: true,
        bypassStatus,
        bypassPath: payload?.bypassPath,
        bypassFileExists: Boolean(payload?.bypassFileExists),
        bypassValid: Boolean(payload?.bypassValid),
      }
    }

    if (registeredDevice) {
      return {
        authorized: true,
        bypassActive: false,
        bypassStatus,
        bypassPath: payload?.bypassPath,
        bypassFileExists: Boolean(payload?.bypassFileExists),
        bypassValid: Boolean(payload?.bypassValid),
      }
    }

    return {
      authorized: false,
      message: deviceStatus.status === 'pending' ? 'This device is awaiting approval.' : 'Device is not registered with Supabase.',
      companionMissing: false,
      bypassStatus,
      bypassPath: payload?.bypassPath,
      bypassFileExists: Boolean(payload?.bypassFileExists),
      bypassValid: Boolean(payload?.bypassValid),
      approvalState: deviceStatus.status === 'pending' ? 'pending' : 'blocked',
    }
  } catch (error) {
    console.error('[CompanionCheck]', error)
    return {
      authorized: false,
      message: error.message || UNAUTHORIZED_DEVICE_MESSAGE,
      companionMissing: false,
      bypassStatus: 'unknown',
    }
  }
}

// 🔒 License Gate – blocks non-super_admin users when license is inactive/expired
function LicenseGate({ children }) {
  const { profile, signOut } = useAuth()
  const [status, setStatus] = useState('checking') // 'checking' | 'ok' | 'blocked'
  const [blockReason, setBlockReason] = useState(null)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (!profile) return

    if (profile.role === 'super_admin') {
      setStatus('ok')
      return
    }

    async function check() {
      // Fetch church record first — needed for auth_code and grace period timestamp
      const church = await getChurch()
      const code = church?.auth_code?.trim()?.toUpperCase()
      if (!code) { setStatus('ok'); return }

      try {
        const resp = await fetch(LICENSE_CSV)
        const text = await resp.text()
        const rows = text.trim().split('\n').slice(1)
        let found = null
        for (const row of rows) {
          const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
          const [rowCode, churchCode, churchName, validUpto, licStatus] = cols
          if (rowCode?.toUpperCase() === code) {
            found = { code: rowCode, churchCode, churchName, validUpto, licStatus }
            break
          }
        }

        if (!found) { setStatus('ok'); return }

        const isDemo = code === '0000-DEMOACCOUNT'
        const inactive = found.licStatus?.toLowerCase().includes('inactive')
        let isExpired = false
        let daysLeft = null

        if (!isDemo) {
          const parts = found.validUpto?.split(/[-\/]/)
          if (parts?.length === 3) {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
            if (!isNaN(d.getTime())) {
              daysLeft = Math.ceil((d - new Date()) / 86400000)
              isExpired = !inactive && d < new Date()
            }
          }
        }

        if (inactive || isExpired) {
          // Clear the grace period timestamp so offline cannot bypass the block
          await supabase.from('companies').update({ license_ok_ts: null }).eq('id', church.id)
          setInfo({ ...found, daysLeft })
          setBlockReason(inactive ? 'inactive' : 'expired')
          setStatus('blocked')
        } else {
          // Stamp the last successful verification time in Supabase
          await supabase.from('companies').update({ license_ok_ts: new Date().toISOString() }).eq('id', church.id)
          setStatus('ok')
        }
      } catch (e) {
        // CSV unreachable — allow up to 24 hours from last verified timestamp in Supabase
        console.error('License CSV fetch failed:', e)
        const lastOk = church?.license_ok_ts ? new Date(church.license_ok_ts).getTime() : 0
        const hoursElapsed = (Date.now() - lastOk) / 3600000
        if (lastOk && hoursElapsed < 24) {
          setStatus('ok')
        } else {
          setBlockReason('network')
          setStatus('blocked')
        }
      }
    }

    check()
  }, [profile])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">{SPINNER}<p className="text-sm text-slate-500">Verifying license...</p></div>
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#071428 0%,#0d2550 40%,#1a4690 100%)' }}>
        <div style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'48px 40px', maxWidth:420, width:'90%', textAlign:'center', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }}>
          {/* Lock icon */}
          <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(239,68,68,0.15)', border:'2px solid rgba(239,68,68,0.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <h2 style={{ color:'#fff', fontSize:22, fontWeight:700, margin:'0 0 8px' }}>
            {blockReason === 'network' ? 'License Unverified' : `License ${blockReason === 'inactive' ? 'Inactive' : 'Expired'}`}
          </h2>
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:14, margin:'0 0 24px', lineHeight:1.6 }}>
            {blockReason === 'inactive'
              ? 'Your company license has been deactivated. Access is restricted until the license is reactivated.'
              : blockReason === 'expired'
              ? 'Your company license has expired. Please renew to continue using the system.'
              : 'License could not be verified and the 24-hour offline grace period has elapsed. Please check your internet connection or contact support.'}
          </p>

          {info?.churchCode && (
            <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'12px 16px', marginBottom:24, textAlign:'left' }}>
              <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Company ID</div>
              <div style={{ color:'#fff', fontWeight:600, fontSize:15 }}>{info.churchCode}</div>
              {info.validUpto && (
                <>
                  <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', marginTop:10, marginBottom:4 }}>
                    {blockReason === 'expired' ? 'Expired On' : 'Valid Until'}
                  </div>
                  <div style={{ color: blockReason === 'expired' ? '#ef4444' : '#f59e0b', fontWeight:600, fontSize:15 }}>{info.validUpto}</div>
                </>
              )}
            </div>
          )}

          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'12px 16px', marginBottom:28 }}>
            <div style={{ color:'rgba(255,255,255,0.45)', fontSize:12, marginBottom:4 }}>Contact for support</div>
            <div style={{ color:'#60a5fa', fontWeight:600, fontSize:15 }}>{VENDOR.name}</div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:14, marginTop:2 }}>{VENDOR.phone}</div>
          </div>

          <button
            onClick={signOut}
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.8)', borderRadius:8, padding:'10px 28px', cursor:'pointer', fontSize:14, fontWeight:500 }}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return children
}

// 🔒 Private Route
function PrivateRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          {SPINNER}
          <p className="text-sm text-slate-500">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <LicenseGate>{children}</LicenseGate>
}

// 🌐 Public Route
function PublicRoute({ children }) {
  const { session, loading } = useAuth()
  const [canRedirect, setCanRedirect] = useState(false)
  const [companionStatus, setCompanionStatus] = useState('checking') // checking | ok | unauthorized
  const [companionMessage, setCompanionMessage] = useState('')
  const [bypassInfo, setBypassInfo] = useState(null)
  const [companionMissing, setCompanionMissing] = useState(false)
  const [bypassStatus, setBypassStatus] = useState('unknown') // unknown | absent | invalid | active
  const [bypassPath, setBypassPath] = useState(null)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [emergencyPw, setEmergencyPw] = useState('')
  const [emergencyError, setEmergencyError] = useState('')
  const [approvalRequested, setApprovalRequested] = useState(false)
  const [requestingApproval, setRequestingApproval] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function runCompanionCheck() {
      const result = await verifyCompanionAndDevice()
      if (cancelled) return
      if (result.authorized) {
        setCompanionStatus('ok')
        setBypassInfo(result.bypassActive ? { bypassActive: true } : null)
      } else {
        setCompanionStatus('unauthorized')
        setCompanionMessage(result.message)
        setBypassInfo(result.bypassActive ? { bypassActive: true } : null)
        setApprovalRequested(false)
      }
      setCompanionMissing(Boolean(result.companionMissing))
      setBypassStatus(result.bypassStatus || 'unknown')
      setBypassPath(result.bypassPath || null)
    }

    runCompanionCheck()
    return () => { cancelled = true }
  }, [])

  // Emergency bypass: Ctrl+F10 opens master-password prompt when companion is unauthorized
  useEffect(() => {
    function onKey(e) {
      // Accept plain F10 or Ctrl+F10
      if (e.key !== 'F10') return
      // Only allow when companion currently blocking access
      if (companionStatus !== 'unauthorized') return
      // Prevent default behavior (some browsers move focus on F10)
      e.preventDefault()
      setEmergencyPw('')
      setEmergencyError('')
      setShowEmergencyModal(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [companionStatus])

  async function handleRequestApproval() {
    setRequestingApproval(true)
    try {
      const payload = await fetchCompanionStatus()
      if (!payload?.deviceId) throw new Error('Companion did not return a device id')

      const requestResult = await requestDeviceApproval({
        deviceId: payload.deviceId,
        deviceName: payload?.deviceProfile?.deviceName || payload?.deviceProfile?.name || null,
        location: payload?.deviceProfile?.location || null,
        orgName: payload?.deviceProfile?.orgName || null,
        designation: payload?.deviceProfile?.designation || null,
      })

      console.log('[App] Approval request result:', requestResult)
      setApprovalRequested(true)
      setCompanionMessage('Approval requested. Awaiting approval from the Super Admin.')
    } catch (err) {
      console.error('Approval request failed', err)
      setCompanionMessage(`Unable to request approval right now. ${err?.message || 'Please try again.'}`)
    } finally {
      setRequestingApproval(false)
    }
  }

  function submitEmergency() {
    setEmergencyError('')
    const pw = emergencyPw || ''
    if (!pw) { setEmergencyError('Please enter the master password'); return }
    try {
      if (pw === 'Master007))&') {
        try { window.localStorage.setItem('emergency_bypass', '1') } catch (err) {}
        setCompanionStatus('ok')
        setBypassInfo({ emergency: true })
        setShowEmergencyModal(false)
        setEmergencyPw('')
      } else {
        setEmergencyError('Incorrect master password')
      }
    } catch (err) {
      console.error('Emergency submit error', err)
      setEmergencyError('An error occurred')
    }
  }

  useEffect(() => {
    if (!session) {
      setCanRedirect(false)
      clearTimeout(timerRef.current)
      return
    }
    if (sessionStorage.getItem('login_welcome')) {
      // Just logged in — hold redirect so "Welcome back" animation is visible
      timerRef.current = setTimeout(() => {
        sessionStorage.removeItem('login_welcome')
        setCanRedirect(true)
      }, 3000)
    } else {
      // Already had a session (e.g. navigated back to /login while logged in)
      setCanRedirect(true)
    }
    return () => clearTimeout(timerRef.current)
  }, [session])

  if (loading || companionStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div style={{ width:32, height:32, border:'3px solid #e2e8f0', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 12px' }} />
          <p className="text-sm text-slate-500">Verifying companion app…</p>
        </div>
      </div>
    )
  }

  if (companionStatus === 'unauthorized') {
    const message = companionMessage || UNAUTHORIZED_DEVICE_MESSAGE

    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#0b1227 0%,#101a3a 40%,#122652 100%)' }}>
        <div style={{ maxWidth: 520, width: '92%', background: 'rgba(7,12,29,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: '36px 32px', boxShadow: '0 28px 80px rgba(0,0,0,0.45)' }}>
          <h1 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Unauthorized Device</h1>
          <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>This device is not authorised. For technical assistance, please contact Zion Solutions at +91 99940 73545.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 220, background: 'rgba(96,165,250,0.08)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Required</div>
              <div style={{ color: '#e2e8f0', fontSize: 14 }}>TrustGate TM Companion</div>
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 220, background: 'rgba(239,68,68,0.08)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fecaca', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Status</div>
              <div style={{ color: '#fda4af', fontSize: 14 }}>{companionMissing ? 'Companion missing' : (approvalRequested ? 'Awaiting Approval' : 'Unauthorized')}</div>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleRequestApproval}
              disabled={requestingApproval || approvalRequested}
              style={{ background: approvalRequested ? '#4b5563' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: requestingApproval || approvalRequested ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >
              {requestingApproval ? 'Submitting…' : (approvalRequested ? 'Awaiting Approval' : 'Request Approval')}
            </button>
          </div>
          <p style={{ color: '#94a3b8', marginTop: 12, fontSize: 13 }}>{companionMessage}</p>
        </div>
        {/* Emergency bypass modal */}
        {showEmergencyModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '92%', maxWidth: 420, background: 'white', borderRadius: 12, padding: 18, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
              <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 700 }}>SuperAdmin emergency bypass</h3>
              <p style={{ margin: 0, marginBottom: 12, color: '#475569', fontSize: 13 }}>Enter master password to continue.</p>
              <input
                autoFocus
                type="password"
                value={emergencyPw}
                onChange={e => setEmergencyPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitEmergency(); if (e.key === 'Escape') setShowEmergencyModal(false) }}
                style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 10 }}
              />
              {emergencyError && <div style={{ color: '#dc2626', marginBottom: 10 }}>{emergencyError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowEmergencyModal(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white' }}>Cancel</button>
                <button onClick={() => submitEmergency()} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white' }}>Unlock</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (session && canRedirect) return <Navigate to="/dashboard" replace />

  return children
}

// Shared EntityProvider for all /accounting/* routes (persists entity selection across pages)
function AccountingLayout() {
  return (
    <EntityProvider>
      <Outlet />
    </EntityProvider>
  )
}

// 🛣️ Routes
function AppRoutes() {
  const navigate = useNavigate()
  const [showCOAModal, setShowCOAModal] = useState(false)

  // Global Enter-key navigation: pressing Enter on any text input advances to the next focusable element
  useEffect(() => {
    function handleEnter(e) {
      if (e.key !== 'Enter' || e.defaultPrevented) return
      const el = e.target
      if (el.tagName !== 'INPUT') return
      if (el.type === 'submit' || el.type === 'button' || el.type === 'checkbox' || el.type === 'radio') return
      e.preventDefault()
      const all = Array.from(
        document.querySelectorAll('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')
      ).filter(n => n.tabIndex !== -1 && n.offsetParent !== null)
      const idx = all.indexOf(el)
      if (idx !== -1 && idx < all.length - 1) all[idx + 1].focus()
    }
    document.addEventListener('keydown', handleEnter)
    return () => document.removeEventListener('keydown', handleEnter)
  }, [])

  const location = useLocation()

  // Alt+C → Chart of Accounts (modal overlay), only on /accounting pages
  useEffect(() => {
    function handleHotkey(e) {
      if (!location.pathname.startsWith('/accounting')) return
      if (e.altKey && e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShowCOAModal(true)
      }
    }
    document.addEventListener('keydown', handleHotkey)
    return () => document.removeEventListener('keydown', handleHotkey)
  }, [location.pathname])

  // Escape closes the COA modal
  useEffect(() => {
    if (!showCOAModal) return
    const onEsc = e => { if (e.key === 'Escape') setShowCOAModal(false) }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [showCOAModal])

  return (
    <>
    {/* Alt+C — Chart of Accounts modal */}
    {showCOAModal && (
      <div
        onClick={() => setShowCOAModal(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '92vw', maxWidth: 1100, height: '88vh',
            background: 'var(--page-bg, #f1f5f9)',
            borderRadius: 14,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <EntityProvider>
              <ChartOfAccountsPage isModal onClose={() => setShowCOAModal(false)} />
            </EntityProvider>
          </div>
        </div>
      </div>
    )}
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <AppLayout><DashboardPage /></AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/company-setup"
        element={
          <PrivateRoute>
            <AppLayout><CompanySetupPage /></AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/users"
        element={
          <PrivateRoute>
            <AppLayout><UsersPage /></AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/import"
        element={
          <PrivateRoute>
            <EntityProvider>
              <AppLayout><ImportPage /></AppLayout>
            </EntityProvider>
          </PrivateRoute>
        }
      />


      <Route
        path="/announcements-log"
        element={<PrivateRoute><AppLayout><AnnouncementsLogPage /></AppLayout></PrivateRoute>}
      />
      <Route
        path="/login-logs"
        element={<PrivateRoute><AppLayout><LoginLogsPage /></AppLayout></PrivateRoute>}
      />
      <Route
        path="/whatsapp-receipt-log"
        element={<PrivateRoute><AppLayout><WhatsAppReceiptLogPage /></AppLayout></PrivateRoute>}
      />
      <Route
        path="/payment-request-log"
        element={<PrivateRoute><AppLayout><PaymentRequestLogPage /></AppLayout></PrivateRoute>}
      />

      {/* ── Accounting Module — all under a single EntityProvider ── */}
      <Route path="/accounting" element={<PrivateRoute><AccountingLayout /></PrivateRoute>}>
        <Route index                    element={<AppLayout><AccountingPage /></AppLayout>} />
        <Route path="chart-of-accounts" element={<AppLayout><ChartOfAccountsPage /></AppLayout>} />
        <Route path="journal-entries"   element={<AppLayout><JournalEntryPage /></AppLayout>} />
        <Route path="journal-entries/:id" element={<AppLayout><JournalEntryPage /></AppLayout>} />
        <Route path="ledger"            element={<AppLayout><LedgerPage /></AppLayout>} />
        <Route path="trial-balance"     element={<AppLayout><TrialBalancePage /></AppLayout>} />
        <Route path="statements"        element={<AppLayout><FinancialStatementsPage /></AppLayout>} />
        <Route path="settings"          element={<AppLayout><AccountingSettingsPage /></AppLayout>} />
        <Route path="bank-accounts"     element={<AppLayout><BankAccountsPage /></AppLayout>} />
        <Route path="gl-reports"        element={<AppLayout><AccountingReportsPage /></AppLayout>} />
        <Route path="receipt-voucher"   element={<AppLayout><ReceiptVoucherPage /></AppLayout>} />
        <Route path="payment-voucher"   element={<AppLayout><PaymentVoucherPage /></AppLayout>} />
        <Route path="contra-voucher"    element={<AppLayout><ContraVoucherPage /></AppLayout>} />
        <Route path="journal-voucher"   element={<AppLayout><JournalVoucherPage /></AppLayout>} />
        <Route path="opening-balances"  element={<AppLayout><OpeningBalancesPage /></AppLayout>} />
        <Route path="templates"         element={<AppLayout><JournalTemplatesPage /></AppLayout>} />
        <Route path="year-end-closing"  element={<AppLayout><YearEndClosingPage /></AppLayout>} />
        <Route path="bank-reconciliation" element={<AppLayout><BankReconciliationPage /></AppLayout>} />
        <Route path="budget-vs-actual"  element={<AppLayout><BudgetVsActualPage /></AppLayout>} />
        <Route path="funds"             element={<AppLayout><FundsPage /></AppLayout>} />
        <Route path="fund-report"       element={<AppLayout><FundReportPage /></AppLayout>} />
        <Route path="entities"          element={<AppLayout><EntityManagementPage /></AppLayout>} />
      </Route>

      {/* ── Events Module ── */}
      {/* ── Simple Accounts Module ── */}
      <Route path="/simple-accounts"             element={<PrivateRoute><AppLayout><SimpleAccountsDashboard /></AppLayout></PrivateRoute>} />
      <Route path="/simple-accounts/transactions" element={<PrivateRoute><AppLayout><SimpleTransactionsPage /></AppLayout></PrivateRoute>} />
      <Route path="/simple-accounts/categories"   element={<PrivateRoute><AppLayout><SimpleCategoriesPage /></AppLayout></PrivateRoute>} />
      <Route path="/simple-accounts/accounts"     element={<PrivateRoute><AppLayout><SimpleAccountsManagePage /></AppLayout></PrivateRoute>} />
      <Route path="/simple-accounts/reports"      element={<PrivateRoute><AppLayout><SimpleReportsPage /></AppLayout></PrivateRoute>} />
      <Route path="/simple-accounts/settings"     element={<PrivateRoute><AppLayout><SimpleAccountsSettingsPage /></AppLayout></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  )
}

// 🎯 Main App Component
function App() {
  console.log('🎯 App mounting')

  // Intercept /pay/:requestId before any Router/Auth setup.
  // PaymentPage is a public page — members must never see a login form.
  const payMatch = window.location.pathname.match(/^\/pay\/([^/]+)/)
  if (payMatch) {
    return <PaymentPage requestId={payMatch[1]} />
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

// ✅ IMPORTANT: Default export (this fixes your error)
export default App