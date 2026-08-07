import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useWmsRbac } from '../../lib/WmsRbacContext'
import { supabase } from '../../lib/supabase'
import { getChurchFlags, loadChurchSettings } from '../../lib/churchSettings'
import { ChevronLeft, ChevronRight, ChevronDown,
  LayoutDashboard, Users, FileText, IndianRupee,
  BarChart3, Megaphone, Building, UserCog, Upload, ClipboardList, LogIn,
  BookOpen, MessageSquare, CreditCard, Send, Landmark,
  PiggyBank, Tag, List, Settings, Wallet, Calendar, BookMarked,
  Package, Layers, Cog, Truck, Wrench, Activity,
  Briefcase, ClipboardCheck, TimerOff,
  PackageOpen, ArrowDownToLine,
  AlertTriangle, FileDiff,
  Mail,
  BarChart2, UserCheck,
  Bell, Shield, ScrollText,
} from 'lucide-react'
import { HEADER_H } from './Header'

const NAV = [
  { group: 'MAIN', items: [
    { label: 'Dashboard',     path: '/dashboard',     icon: LayoutDashboard },
  ]},
  { group: 'MASTER DATA', wmsModule: 'masters', items: [
    { label: 'Customers',       path: '/masters/customers',      icon: Users },
    { label: 'Items / Parts',   path: '/masters/items',          icon: Package },
    { label: 'Materials',       path: '/masters/materials',      icon: Layers },
    { label: 'Machines',        path: '/masters/machines',       icon: Cog },
    { label: 'Operators',       path: '/masters/operators',      icon: UserCog },
    { label: 'Subcontractors',  path: '/masters/subcontractors', icon: Truck },
    { label: 'Tooling & Gauges', path: '/masters/tooling',       icon: Wrench },
  ]},
  { group: 'ORDERS', wmsModule: 'orders', items: [
    { label: 'Enquiries / RFQ',   path: '/orders/enquiries',          icon: MessageSquare },
    { label: 'Purchase orders',   path: '/orders/purchase-orders',    icon: FileText },
    { label: 'Order status',      path: '/orders/status',             icon: Activity },
  ]},
  { group: 'PLANNING', wmsModule: 'planning', items: [
    { label: 'Route sheets',        path: '/planning/route-sheets',     icon: ClipboardList },
    { label: 'Machine schedule',    path: '/planning/schedule',         icon: Calendar },
    { label: 'Production vs delivery', path: '/planning/production-plan', icon: BarChart3 },
  ]},
  { group: 'SHOP FLOOR', wmsModule: 'shop', items: [
    { label: 'Job cards',       path: '/shop/job-cards',  icon: Briefcase },
    { label: 'DPR',             path: '/shop/dpr',        icon: ClipboardCheck },
    { label: 'Downtime log',    path: '/shop/downtime',   icon: TimerOff },
  ]},
  { group: 'STORES', wmsModule: 'stores', items: [
    { label: 'RM inward',        path: '/stores/rm-inward',       icon: PackageOpen },
    { label: 'Material issue',   path: '/stores/material-issue',  icon: ArrowDownToLine },
  ]},
  { group: 'QUALITY', wmsModule: 'quality', items: [
    { label: 'Inspections',     path: '/quality/inspections', icon: ClipboardCheck },
    { label: 'NCR',             path: '/quality/ncr',           icon: AlertTriangle },
  ]},
  { group: 'MORE', items: [
    { label: 'Dispatch notes', path: '/dispatch/notes', icon: Truck, wmsModule: 'dispatch' },
    { label: 'Drawing revisions', path: '/engineering/drawing-revisions', icon: FileDiff, wmsModule: 'engineering' },
  ]},
  { group: 'COMMERCIAL', wmsModule: 'commercial', items: [
    { label: 'Tender alerts',     path: '/commercial/tenders',        icon: Megaphone },
    { label: 'Correspondence',    path: '/commercial/correspondence', icon: Mail },
    { label: 'Notifications',     path: '/notifications',             icon: Bell },
  ]},
  { group: 'MAINTENANCE', wmsModule: 'maintenance', items: [
    { label: 'PM schedules',      path: '/maintenance',               icon: Settings },
  ]},
  { group: 'INSIGHTS', wmsModule: 'insights', items: [
    { label: 'Executive dashboard', path: '/insights/executive',    icon: BarChart2 },
    { label: 'Job costing',         path: '/insights/job-costing',  icon: IndianRupee },
    { label: 'Payment ageing',      path: '/insights/receivables',  icon: CreditCard },
  ]},
  { group: 'HR', wmsModule: 'hr', items: [
    { label: 'Attendance',          path: '/hr/attendance',         icon: UserCheck },
  ]},
  { group: 'FINANCE', adminOnly: true, items: [
    { label: 'Accounts',          path: '/accounting',        icon: Landmark,    accountingOnly: true },
    { label: 'Simple Accounts',   path: '/simple-accounts',   icon: Wallet,      simpleOnly: true },
  ]},
  { group: 'ADMIN', adminOnly: true, items: [
    { label: 'Company Setup',      path: '/company-setup',    icon: Building,       superOnly: true },
    { label: 'Users',             path: '/users',           icon: UserCog,        superOnly: true },
    { label: 'Import Data',       path: '/import',          icon: Upload,         superOnly: true },
    { label: 'WMS permissions',   path: '/admin/wms-permissions', icon: Shield,   superOnly: true },
  ]},
  { group: 'LOGS', adminOnly: true, items: [
    { label: 'Login Details', path: '/login-logs', icon: LogIn, adminOnly: true },
    { label: 'Audit trail', path: '/admin/audit-trail', icon: ScrollText, wmsModule: 'admin' },
  ]},
]

export default function Sidebar({ collapsed, sidebarW, onToggle }) {
  const { profile } = useAuth()
  const { canRead } = useWmsRbac()
  const navigate    = useNavigate()
  const location    = useLocation()
  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin      = ['super_admin', 'admin', 'admin1'].includes(profile?.role)
  const role = profile?.role

  const [accountingEnabled,       setAccountingEnabled]       = useState(false)
  const [simpleAccountingEnabled, setSimpleAccountingEnabled] = useState(false)
  const [expandedItems, setExpandedItems] = useState(new Set())

  const navItemVisible = useCallback((item) => {
    if (item.superOnly && !isSuperAdmin) return false
    if (item.adminOnly && !isAdmin) return false
    if (item.accountingOnly && !accountingEnabled) return false
    if (item.simpleOnly && !simpleAccountingEnabled) return false
    if (item.wmsModule) return canRead(role, item.wmsModule)
    return true
  }, [isSuperAdmin, isAdmin, role, canRead, accountingEnabled, simpleAccountingEnabled])

  const navGroupVisible = useCallback((group) => {
    if (group.superOnly && !isSuperAdmin) return false
    if (group.wmsModule) return canRead(role, group.wmsModule)
    if (group.adminOnly) return isAdmin
    return group.items.some(navItemVisible)
  }, [isSuperAdmin, isAdmin, role, canRead, navItemVisible])

  const loadFlags = useCallback(() => {
    loadChurchSettings()
      .then(({ data }) => {
        const flags = getChurchFlags(data)
        setAccountingEnabled(flags.accountingEnabled)
        setSimpleAccountingEnabled(flags.simpleAccountingEnabled)
      })
      .catch(() => {})
  }, [])
  useEffect(() => { loadFlags() }, [location.pathname, loadFlags])
  useEffect(() => {
    window.addEventListener('church-settings-updated', loadFlags)
    return () => window.removeEventListener('church-settings-updated', loadFlags)
  }, [loadFlags])

  // Auto-expand parent items whose child is currently active
  useEffect(() => {
    NAV.forEach(group => {
      group.items?.forEach(item => {
        if (item.children) {
          const childActive = item.children.some(c => location.pathname === c.path || location.pathname.startsWith(c.path + '/'))
          if (childActive) setExpandedItems(prev => new Set([...prev, item.label]))
        }
      })
    })
  }, [location.pathname])

  const toggleExpand = (label) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label); else next.add(label)
      return next
    })
  }

  return (
    <aside style={{
      width: sidebarW,
      minWidth: sidebarW,
      background: `linear-gradient(180deg, var(--sidebar-bg) 0%, var(--sidebar-bg-end) 100%)`,
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      height: `calc(100vh / 0.95 - ${HEADER_H}px)`,
      position: 'fixed',
      left: 0, top: HEADER_H,
      zIndex: 300,
      transition: 'width 0.25s ease, min-width 0.25s ease',
      overflow: 'hidden',
    }}>

      <nav style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: collapsed ? '14px 8px' : '18px 10px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.08) transparent',
      }}>

        {/* Collapsed: toggle at top */}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <CollapseBtn collapsed={collapsed} onToggle={onToggle} />
          </div>
        )}

        {NAV.map(group => {
          if (!navGroupVisible(group)) return null
          const isMain = group.group === 'MAIN'
          return (
            <div key={group.group} style={{ marginBottom: 26 }}>
              {!collapsed && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px', marginBottom: 6 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'var(--sidebar-group)',
                    fontFamily: 'var(--font-ui)',
                  }}>
                    {group.group}
                  </span>
                  {isMain && <CollapseBtn collapsed={collapsed} onToggle={onToggle} />}
                </div>
              )}

              {group.items.map(item => {
                if (!navItemVisible(item)) return null
                if (item.superOnly && !isSuperAdmin) return null
                if (item.accountingOnly && !accountingEnabled) return null
                if (item.simpleOnly    && !simpleAccountingEnabled) return null

                if (item.children) {
                  const isExpanded = expandedItems.has(item.label)
                  const isActive   = item.children.some(c => location.pathname === c.path || location.pathname.startsWith(c.path + '/'))
                  return (
                    <div key={item.label}>
                      <NavItem
                        item={item}
                        isActive={isActive}
                        collapsed={collapsed}
                        hasChildren
                        isExpanded={isExpanded}
                        onClick={() => collapsed ? navigate(item.children[0].path) : toggleExpand(item.label)}
                      />
                      {!collapsed && isExpanded && item.children.map(child => {
                        const childActive = location.pathname === child.path
                        return (
                          <SubNavItem
                            key={child.path}
                            label={child.label}
                            isActive={childActive}
                            onClick={() => navigate(child.path)}
                          />
                        )
                      })}
                    </div>
                  )
                }

                const isActive = location.pathname === item.path ||
                  location.pathname.startsWith(item.path + '/')
                return (
                  <NavItem
                    key={item.label}
                    item={item}
                    isActive={isActive}
                    collapsed={collapsed}
                    onClick={() => !item.soon && navigate(item.path)}
                  />
                )
              })}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

/* ── Collapse button ─────────────────────────────────────────── */
function CollapseBtn({ collapsed, onToggle }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      style={{
        width: 26, height: 26,
        borderRadius: 7,
        border: '1px solid var(--sidebar-item-active-border)',
        background: hov ? 'var(--sidebar-item-active-bg)' : 'transparent',
        color: 'var(--sidebar-item-active-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', outline: 'none',
        transition: 'all 0.18s',
        transform: hov ? 'scale(1.1) translateY(-2px)' : 'scale(1) translateY(0)',
        boxShadow: hov 
          ? '0 2px 4px rgba(0,0,0,0.1), 0 6px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' 
          : '0 1px 2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}
    >
      {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
    </button>
  )
}

/* ── Nav item ─────────────────────────────────────────────────── */
function NavItem({ item, isActive, collapsed, onClick, hasChildren, isExpanded }) {
  const [hov, setHov] = useState(false)
  const Icon = item.icon

  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 8,
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: '100%',
        padding: collapsed ? '11px 0' : '10px 10px',
        borderRadius: 8,
        border: 'none',
        borderLeft: !collapsed && isActive
          ? '3px solid var(--sidebar-item-active-border)'
          : '3px solid transparent',
        marginBottom: 3,
        cursor: item.soon ? 'default' : 'pointer',
        background: isActive
          ? 'var(--sidebar-item-active-bg)'
          : hov && !item.soon ? 'var(--sidebar-item-hover)' : 'transparent',
        color: isActive
          ? 'var(--sidebar-text-active)'
          : item.soon ? 'rgba(255,255,255,0.16)'
          : hov ? '#ffffff'
          : 'var(--sidebar-text)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13, fontWeight: isActive ? 700 : 500,
        outline: 'none', textAlign: 'left',
        transition: 'all 0.15s ease',
        transform: hov && !item.soon && !isActive ? 'translateX(4px) translateY(-1px)' : 'none',
        boxShadow: item.soon
          ? 'none'
          : isActive
          ? '0 2px 6px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.08)'
          : hov
          ? '0 4px 12px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <Icon
        size={16}
        style={{
          flexShrink: 0,
          opacity: item.soon ? 0.25 : 1,
          transform: hov && !item.soon ? 'scale(1.12)' : 'scale(1)',
          transition: 'transform 0.15s ease',
        }}
      />
      {!collapsed && (
        <>
          <span style={{ flex: 1, letterSpacing: '0.01em' }}>{item.label}</span>
          {hasChildren && (
            <ChevronDown
              size={12}
              style={{
                flexShrink: 0,
                opacity: 0.6,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          )}
          {item.soon && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.18)',
              letterSpacing: '.06em', fontFamily: 'var(--font-ui)',
            }}>
              SOON
            </span>
          )}
        </>
      )}
    </button>
  )
}

/* ── Sub-nav item ──────────────────────────────────────────────── */
function SubNavItem({ label, isActive, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '7px 10px 7px 30px',
        borderRadius: 7,
        border: 'none',
        borderLeft: isActive
          ? '3px solid var(--sidebar-item-active-border)'
          : '3px solid transparent',
        marginBottom: 2,
        cursor: 'pointer',
        background: isActive
          ? 'var(--sidebar-item-active-bg)'
          : hov ? 'var(--sidebar-item-hover)' : 'transparent',
        color: isActive
          ? 'var(--sidebar-text-active)'
          : hov ? '#ffffff' : 'rgba(255,255,255,0.55)',
        fontFamily: 'var(--font-ui)',
        fontSize: 12, fontWeight: isActive ? 700 : 400,
        outline: 'none', textAlign: 'left',
        transition: 'all 0.15s ease',
        transform: hov && !isActive ? 'translateX(4px) translateY(-1px)' : 'none',
        boxShadow: isActive
          ? '0 2px 6px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.08)'
          : hov
          ? '0 4px 12px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: isActive ? 'var(--sidebar-item-active-border)' : 'rgba(255,255,255,0.3)',
      }} />
      <span style={{ letterSpacing: '0.01em' }}>{label}</span>
    </button>
  )
}
