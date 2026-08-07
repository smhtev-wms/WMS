import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../lib/auth'
import { loadChurchSettings, getChurchFlags } from '../lib/churchSettings'
import {
  LayoutDashboard, Landmark, Wallet, Building, UserCog, Upload,
  LogIn, Users, ChevronRight, Sparkles, Package, Layers, Cog,
  FileText, Activity,
} from 'lucide-react'

function greetingForHour(h) {
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function displayName(profile) {
  return profile?.nickname?.trim()
    || profile?.full_name?.trim()
    || profile?.email?.split('@')[0]
    || 'there'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { session, profile, loading: authLoading } = useAuth()
  const [churchName, setChurchName] = useState('')
  const [flags, setFlags] = useState({ accountingEnabled: false, simpleAccountingEnabled: false })
  const [stats, setStats] = useState({ customers: null, items: null, users: null })
  const [statsLoading, setStatsLoading] = useState(true)

  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = ['super_admin', 'admin', 'admin1'].includes(profile?.role)
  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || ''

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), [])

  useEffect(() => {
    loadChurchSettings().then(({ data }) => {
      const name = data?.church_name || data?.company_name || ''
      setChurchName(name)
      setFlags(getChurchFlags(data))
    })
  }, [])

  useEffect(() => {
    if (!session || !isAdmin) {
      setStatsLoading(false)
      return
    }
    let cancelled = false
    async function loadStats() {
      setStatsLoading(true)
      try {
        const tasks = [
          supabase.from('wms_customers').select('*', { count: 'exact', head: true }),
          supabase.from('wms_items').select('*', { count: 'exact', head: true }),
        ]
        if (isSuperAdmin) {
          tasks.push(supabase.from('profiles').select('*', { count: 'exact', head: true }))
        }
        const results = await Promise.all(tasks)
        if (cancelled) return
        setStats({
          customers: results[0].error ? null : (results[0].count ?? 0),
          items: results[1].error ? null : (results[1].count ?? 0),
          users: results[2] ? (results[2].error ? null : (results[2].count ?? 0)) : null,
        })
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    loadStats()
    return () => { cancelled = true }
  }, [session, isAdmin, isSuperAdmin])

  const quickLinks = useMemo(() => {
    const links = []
    if (isAdmin) {
      links.push(
        { label: 'Customers', desc: 'BHEL & allied customer master', path: '/masters/customers', icon: Users, tone: 'blue' },
        { label: 'Items / Parts', desc: 'Drawings, revisions, UOM', path: '/masters/items', icon: Package, tone: 'violet' },
        { label: 'Materials', desc: 'Raw material grades & specs', path: '/masters/materials', icon: Layers, tone: 'green' },
        { label: 'Machines', desc: 'Shop equipment registry', path: '/masters/machines', icon: Cog, tone: 'amber' },
        { label: 'Purchase orders', desc: 'Customer POs & line items', path: '/orders/purchase-orders', icon: FileText, tone: 'blue' },
        { label: 'Order status', desc: 'Lifecycle & overdue deliveries', path: '/orders/status', icon: Activity, tone: 'green' },
      )
    }
    if (isAdmin && flags.accountingEnabled) {
      links.push({
        label: 'Accounts',
        desc: 'Ledger, vouchers & statements',
        path: '/accounting',
        icon: Landmark,
        tone: 'blue',
      })
    }
    if (isAdmin && flags.simpleAccountingEnabled) {
      links.push({
        label: 'Simple Accounts',
        desc: 'Cash book & day-to-day entries',
        path: '/simple-accounts',
        icon: Wallet,
        tone: 'green',
      })
    }
    if (isSuperAdmin) {
      links.push(
        { label: 'Company Setup', desc: 'Church profile & preferences', path: '/company-setup', icon: Building, tone: 'slate' },
        { label: 'Users', desc: 'Roles and access control', path: '/users', icon: UserCog, tone: 'violet' },
        { label: 'Import Data', desc: 'Bulk load members & records', path: '/import', icon: Upload, tone: 'amber' },
      )
    }
    if (isAdmin) {
      links.push(
        { label: 'Login Details', desc: 'Sign-in history & devices', path: '/login-logs', icon: LogIn, tone: 'slate' },
      )
    }
    return links
  }, [isAdmin, isSuperAdmin, flags])

  if (authLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-spinner" />
        <p>Loading your workspace…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="dashboard-loading">
        <LayoutDashboard size={44} color="var(--text-3)" />
        <p>Please log in to view the dashboard.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in dashboard-page">
      <section className="dashboard-hero" style={{ animationDelay: '0ms' }}>
        <div className="dashboard-hero-content">
          <p className="dashboard-hero-kicker">
            <Sparkles size={14} aria-hidden />
            {greeting}
          </p>
          <h1 className="dashboard-hero-title">{displayName(profile)}</h1>
          <p className="dashboard-hero-sub">
            {churchName ? (
              <>Welcome to <strong>{churchName}</strong></>
            ) : (
              'Welcome to your workshop management workspace'
            )}
            {roleLabel && (
              <span className="dashboard-role-pill">{roleLabel}</span>
            )}
          </p>
        </div>
        <div className="dashboard-hero-badge" aria-hidden>
          <LayoutDashboard size={28} />
        </div>
      </section>

      {isAdmin && (
        <div className="stat-grid">
          <div className="stat-tile animate-slide-up" style={{ animationDelay: '40ms' }}>
            <div className="stat-tile-icon" data-tone="blue">
              <Users size={18} />
            </div>
            <div>
              <p className="stat-tile-label">Customers</p>
              {statsLoading
                ? <div className="loading-skeleton stat-tile-value-skeleton" />
                : <p className="stat-tile-value">{stats.customers ?? '—'}</p>
              }
            </div>
          </div>
          <div className="stat-tile animate-slide-up" style={{ animationDelay: '80ms' }}>
            <div className="stat-tile-icon" data-tone="violet">
              <Package size={18} />
            </div>
            <div>
              <p className="stat-tile-label">Items / parts</p>
              {statsLoading
                ? <div className="loading-skeleton stat-tile-value-skeleton" />
                : <p className="stat-tile-value">{stats.items ?? '—'}</p>
              }
            </div>
          </div>
          {isSuperAdmin && (
            <div className="stat-tile animate-slide-up" style={{ animationDelay: '80ms' }}>
              <div className="stat-tile-icon" data-tone="violet">
                <UserCog size={18} />
              </div>
              <div>
                <p className="stat-tile-label">System users</p>
                {statsLoading
                  ? <div className="loading-skeleton stat-tile-value-skeleton" />
                  : <p className="stat-tile-value">{stats.users ?? '—'}</p>
                }
              </div>
            </div>
          )}
          <div className="stat-tile animate-slide-up" style={{ animationDelay: '120ms' }}>
            <div className="stat-tile-icon" data-tone="green">
              <Landmark size={18} />
            </div>
            <div>
              <p className="stat-tile-label">Finance modules</p>
              <p className="stat-tile-value stat-tile-value-sm">
                {[flags.accountingEnabled && 'Accounts', flags.simpleAccountingEnabled && 'Simple'].filter(Boolean).join(' · ') || 'None enabled'}
              </p>
            </div>
          </div>
        </div>
      )}

      {quickLinks.length > 0 && (
        <section className="dashboard-section animate-slide-up" style={{ animationDelay: '160ms' }}>
          <div className="page-header" style={{ marginBottom: 18, paddingBottom: 0, border: 'none' }}>
            <div>
              <h2 className="page-title" style={{ fontSize: 18 }}>Quick access</h2>
              <p className="page-subtitle">Jump to the areas you use most</p>
            </div>
          </div>
          <div className="quick-link-grid">
            {quickLinks.map(link => {
              const Icon = link.icon
              return (
                <button
                  key={link.path}
                  type="button"
                  className="quick-link-card hover-lift"
                  data-tone={link.tone}
                  onClick={() => navigate(link.path)}
                >
                  <div className="quick-link-card-top">
                    <span className="quick-link-icon">
                      <Icon size={18} />
                    </span>
                    <ChevronRight size={16} className="quick-link-arrow" />
                  </div>
                  <span className="quick-link-label">{link.label}</span>
                  <span className="quick-link-desc">{link.desc}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {!isAdmin && (
        <div className="card dashboard-tip animate-slide-up" style={{ animationDelay: '80ms', padding: '22px 24px' }}>
          <h3 className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>Your dashboard</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
            Use the menu when additional modules are assigned to your role. Contact your church administrator if you need access to finance or admin tools.
          </p>
        </div>
      )}
    </div>
  )
}
