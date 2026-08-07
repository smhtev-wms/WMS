import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useWmsRbac } from '../lib/WmsRbacContext'
import { loadChurchSettings, getChurchFlags } from '../lib/churchSettings'
import {
  quickAccessLayoutStorageKey,
  loadQuickAccessLayoutLocal,
  saveQuickAccessLayoutLocal,
  mergeQuickLinksIntoGroups,
  resolveGroupedLinks,
  moveLinkInGroups,
  updateGroupTitle,
  reorderGroups,
  togglePathDisabled,
  toggleCategoryDisabled,
  packQuickAccessLayout,
} from '../lib/quickAccessLayoutLib'
import { loadQuickAccessFromProfile, saveQuickAccessToProfile } from '../lib/quickAccessProfileLib'
import {
  LayoutGrid, Landmark, Wallet, Building, UserCog, Upload,
  LogIn, Users, ChevronRight, Package, Layers, Cog,
  FileText, Activity, ClipboardCheck, AlertTriangle, Truck, FileDiff,
  Megaphone, Mail, Settings, BarChart2, IndianRupee, CreditCard,
  UserCheck, Bell, Briefcase, GripVertical, X, Check, Eraser, RotateCcw, Loader2, Pin, PinOff,
  PanelRightClose, ChevronLeft,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

function QuickAccessPasswordConfirmModal({
  action,
  busy,
  password,
  passwordError,
  inputRef,
  onPasswordChange,
  onClose,
  onConfirm,
}) {
  if (!action) return null

  const isClear = action === 'clear'
  const title = isClear ? 'Clear canvas' : 'Reset Quick Access'
  const subtitle = isClear ? 'Main grid will be emptied' : 'All customizations will be lost'
  const body = isClear
    ? 'This hides every module from the main Quick Access grid. Your organize panel layout is unchanged; modules will show as disabled until you turn them back on.'
    : 'This restores the default categories, headings, module grouping, and order. Custom names, drag order, and disable settings will be removed.'
  const confirmLabel = isClear ? 'Clear canvas' : 'Reset to default'

  return (
    <div
      className="quick-access-confirm-overlay"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
      role="presentation"
    >
      <div className="quick-access-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-access-confirm-title">
        <div className="quick-access-confirm-dialog-header">
          <div className="quick-access-confirm-dialog-header-inner">
            <div className="quick-access-confirm-dialog-icon">
              <AlertTriangle size={16} color="#fff" />
            </div>
            <div>
              <h3 id="quick-access-confirm-title" className="quick-access-confirm-dialog-title">{title}</h3>
              <p className="quick-access-confirm-dialog-subtitle">{subtitle}</p>
            </div>
          </div>
          {!busy && (
            <button type="button" className="quick-access-confirm-dialog-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className="quick-access-confirm-dialog-body">
          <p className="quick-access-confirm-dialog-message">{body}</p>
          <p className="quick-access-confirm-dialog-pw-label">Enter your login password to confirm.</p>
          <input
            ref={inputRef}
            type="password"
            className={`quick-access-confirm-dialog-input${passwordError ? ' quick-access-confirm-dialog-input--error' : ''}`}
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm() }}
            placeholder="Your account password"
            autoComplete="current-password"
            disabled={busy}
          />
          {passwordError && (
            <p className="quick-access-confirm-dialog-error">Incorrect password. Please try again.</p>
          )}
          <div className="quick-access-confirm-dialog-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="quick-access-confirm-dialog-danger"
              onClick={onConfirm}
              disabled={busy || !password}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : (isClear ? <Eraser size={13} /> : <RotateCcw size={13} />)}
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildQuickLinks({ role, canRead, isAdmin, isSuperAdmin, flags }) {
  const wmsLinks = [
    { label: 'Customers', desc: 'BHEL & allied customer master', path: '/masters/customers', icon: Users, module: 'masters' },
    { label: 'Items / Parts', desc: 'Drawings, revisions, UOM', path: '/masters/items', icon: Package, module: 'masters' },
    { label: 'Materials', desc: 'Raw material grades & specs', path: '/masters/materials', icon: Layers, module: 'masters' },
    { label: 'Machines', desc: 'Shop equipment registry', path: '/masters/machines', icon: Cog, module: 'masters' },
    { label: 'Job cards', desc: 'Shop floor work orders', path: '/shop/job-cards', icon: Briefcase, module: 'shop' },
    { label: 'DPR', desc: 'Daily production reporting', path: '/shop/dpr', icon: ClipboardCheck, module: 'shop' },
    { label: 'Purchase orders', desc: 'Customer POs & line items', path: '/orders/purchase-orders', icon: FileText, module: 'orders' },
    { label: 'Order status', desc: 'Lifecycle & overdue deliveries', path: '/orders/status', icon: Activity, module: 'orders' },
    { label: 'Inspections', desc: 'In-process & final QC records', path: '/quality/inspections', icon: ClipboardCheck, module: 'quality' },
    { label: 'NCR', desc: 'Non-conformance & corrective action', path: '/quality/ncr', icon: AlertTriangle, module: 'quality' },
    { label: 'Dispatch notes', desc: 'Delivery challans against PO lines', path: '/dispatch/notes', icon: Truck, module: 'dispatch' },
    { label: 'Drawing revisions', desc: 'Revision log & item updates', path: '/engineering/drawing-revisions', icon: FileDiff, module: 'engineering' },
    { label: 'Tender alerts', desc: 'Submission deadlines & status', path: '/commercial/tenders', icon: Megaphone, module: 'commercial' },
    { label: 'Correspondence', desc: 'Customer letters & follow-ups', path: '/commercial/correspondence', icon: Mail, module: 'commercial' },
    { label: 'PM maintenance', desc: 'Preventive schedules & logs', path: '/maintenance', icon: Settings, module: 'maintenance' },
    { label: 'Executive dashboard', desc: 'Workshop KPIs at a glance', path: '/insights/executive', icon: BarChart2, module: 'insights' },
    { label: 'Job costing', desc: 'Margin by job card', path: '/insights/job-costing', icon: IndianRupee, module: 'insights' },
    { label: 'Payment ageing', desc: 'Customer invoice outstanding', path: '/insights/receivables', icon: CreditCard, module: 'insights' },
    { label: 'Attendance', desc: 'Operator presence (HR-lite)', path: '/hr/attendance', icon: UserCheck, module: 'hr' },
    { label: 'Notifications', desc: 'Alerts & overdue items', path: '/notifications', icon: Bell, module: 'commercial' },
  ]
  const links = wmsLinks.filter(l => canRead(role, l.module))
  if (isAdmin && flags.accountingEnabled) {
    links.push({
      label: 'Accounts',
      desc: 'Ledger, vouchers & statements',
      path: '/accounting',
      icon: Landmark,
    })
  }
  if (isAdmin && flags.simpleAccountingEnabled) {
    links.push({
      label: 'Simple Accounts',
      desc: 'Cash book & day-to-day entries',
      path: '/simple-accounts',
      icon: Wallet,
    })
  }
  if (isSuperAdmin) {
    links.push(
      { label: 'Company Setup', desc: 'Church profile & preferences', path: '/company-setup', icon: Building },
      { label: 'Users', desc: 'Roles and access control', path: '/users', icon: UserCog },
      { label: 'Import Data', desc: 'Bulk load members & records', path: '/import', icon: Upload },
    )
  }
  if (isAdmin) {
    links.push(
      { label: 'Login Details', desc: 'Sign-in history & devices', path: '/login-logs', icon: LogIn },
    )
  }
  return links
}

function QuickLinkCard({ link, onNavigate, disabled, dragHandle }) {
  const Icon = link.icon
  return (
    <div
      className={`quick-link-card-wrap${disabled ? ' quick-link-card-wrap--disabled' : ''}`}
      data-drag-over={dragHandle?.isOver}
    >
      {dragHandle && (
        <button
          type="button"
          className="quick-link-card-drag"
          aria-label={`Move ${link.label}`}
          draggable
          onDragStart={dragHandle.onDragStart}
          onDragEnd={dragHandle.onDragEnd}
        >
          <GripVertical size={16} />
        </button>
      )}
      <button
        type="button"
        className="quick-link-card hover-lift"
        data-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => !disabled && onNavigate(link.path)}
      >
        <div className="quick-link-card-top">
          <span className="quick-link-icon">
            <Icon size={18} />
          </span>
          {!disabled && <ChevronRight size={16} className="quick-link-arrow" />}
        </div>
        <span className="quick-link-label">{link.label}</span>
        <span className="quick-link-desc">{link.desc}</span>
      </button>
    </div>
  )
}

function QuickAccessMainGroup({ group, onMove, onNavigate }) {
  const dragPayload = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [overIndex, setOverIndex] = useState(null)

  const clearDrag = () => {
    dragPayload.current = null
    setDragging(false)
    setOverIndex(null)
  }

  const handleDragStart = (index, path) => (e) => {
    dragPayload.current = { type: 'item', path, fromGroupId: group.id, fromIndex: index }
    setDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload.current))
  }

  const handleDragOver = (index) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIndex(index)
  }

  const handleDrop = (index) => (e) => {
    e.preventDefault()
    let payload = dragPayload.current
    if (!payload) {
      try { payload = JSON.parse(e.dataTransfer.getData('application/json')) } catch { /* ignore */ }
    }
    if (payload?.path) onMove(payload, group.id, index)
    clearDrag()
  }

  return (
    <div
      className={`quick-access-group${group.disabled ? ' quick-access-group--disabled' : ''}`}
      onDragOver={e => { e.preventDefault() }}
      onDrop={handleDrop(group.links.length)}
    >
      <h3 className="quick-access-group-title">{group.title}</h3>
      <div className="quick-link-grid quick-link-grid--draggable">
        {group.links.map((link, index) => (
          <div
            key={link.path}
            className="quick-link-grid-cell"
            data-dragging={dragging && dragPayload.current?.path === link.path}
            data-drag-over={overIndex === index && dragPayload.current?.path !== link.path}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
          >
            <QuickLinkCard
              link={link}
              disabled={link.disabled}
              onNavigate={onNavigate}
              dragHandle={{
                onDragStart: handleDragStart(index, link.path),
                onDragEnd: clearDrag,
                isOver: overIndex === index && dragPayload.current?.path !== link.path,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickAccessGroupPanel({
  groups,
  disabledPaths,
  disabledGroupIds,
  onMove,
  onTitleChange,
  onReorderGroups,
  onTogglePath,
  onToggleGroup,
  onNavigate,
  onRequestClearCanvas,
  onRequestResetLayout,
  panelPinned,
  onTogglePanelPin,
  onClosePanel,
}) {
  const dragPayload = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dropTarget, setDropTarget] = useState(null)

  const clearDrag = () => {
    dragPayload.current = null
    setDragging(false)
    setDropTarget(null)
  }

  const readPayload = (e) => {
    let payload = dragPayload.current
    if (!payload) {
      try {
        payload = JSON.parse(e.dataTransfer.getData('application/json'))
      } catch { /* ignore */ }
    }
    return payload
  }

  const handleDragStartItem = (groupId, index, path) => (e) => {
    dragPayload.current = { type: 'item', path, fromGroupId: groupId, fromIndex: index }
    setDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload.current))
  }

  const handleDragStartGroup = (groupIndex) => (e) => {
    dragPayload.current = { type: 'group', fromIndex: groupIndex }
    setDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload.current))
    e.stopPropagation()
  }

  const handleDragEnd = () => clearDrag()

  const handleDragOverSlot = (groupId, index) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget({ groupId, index })
  }

  const handleDragOverGroup = (groupIndex) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget({ groupIndex, isGroup: true })
  }

  const handleDropSlot = (groupId, index) => (e) => {
    e.preventDefault()
    const payload = readPayload(e)
    if (payload?.type === 'item' && payload.path) onMove(payload, groupId, index)
    clearDrag()
  }

  const handleDropGroup = (toIndex) => (e) => {
    e.preventDefault()
    const payload = readPayload(e)
    if (payload?.type === 'group' && Number.isFinite(payload.fromIndex)) {
      onReorderGroups(payload.fromIndex, toIndex)
    }
    clearDrag()
  }

  return (
    <aside className="quick-access-order-panel" id="quick-access-organize-panel" aria-label="Quick access groups">
      <div className="quick-access-order-panel-header">
        <div className="quick-access-order-panel-toolbar">
          <h2 className="quick-access-order-panel-title">Organize</h2>
          <div className="quick-access-order-panel-actions">
            <button
              type="button"
              className={`quick-access-order-panel-action${panelPinned ? ' quick-access-order-panel-action--active' : ''}`}
              aria-pressed={panelPinned}
              title={panelPinned ? 'Unpin panel (you can close it)' : 'Pin panel open'}
              aria-label={panelPinned ? 'Unpin organize panel' : 'Pin organize panel open'}
              onClick={onTogglePanelPin}
            >
              {panelPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
            <button
              type="button"
              className="quick-access-order-panel-action"
              title={panelPinned ? 'Unpin to close panel' : 'Close organize panel'}
              aria-label="Close organize panel"
              onClick={onClosePanel}
              disabled={panelPinned}
            >
              <PanelRightClose size={16} />
            </button>
            <button
              type="button"
              className="quick-access-order-panel-action"
              title="Clear canvas — hide all tiles on the main grid"
              aria-label="Clear canvas"
              onClick={onRequestClearCanvas}
            >
              <Eraser size={16} />
            </button>
            <button
              type="button"
              className="quick-access-order-panel-action"
              title="Reset all Quick Access customizations to default"
              aria-label="Reset to default layout"
              onClick={onRequestResetLayout}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
        <p className="quick-access-order-panel-hint">
          Drag to reorder. Disabled items stay here and are hidden on the grid.
        </p>
      </div>
      <div className="quick-access-order-groups custom-scrollbar">
        {groups.map((group, groupIndex) => {
          const groupDisabled = disabledGroupIds.includes(group.id)
            || (group.links.length > 0 && group.links.every(l => l.disabled))
          return (
          <section
            key={group.id}
            className={`quick-access-order-group${groupDisabled ? ' quick-access-order-group--disabled' : ''}`}
            data-drag-over={dropTarget?.isGroup && dropTarget?.groupIndex === groupIndex}
            onDragOver={handleDragOverGroup(groupIndex)}
            onDrop={handleDropGroup(groupIndex)}
          >
            <div className="quick-access-order-group-head">
              <button
                type="button"
                className="quick-access-order-group-handle"
                aria-label={`Reorder category ${group.title}`}
                draggable
                onDragStart={handleDragStartGroup(groupIndex)}
                onDragEnd={handleDragEnd}
              >
                <GripVertical size={16} />
              </button>
              <input
                type="text"
                className="quick-access-order-group-title"
                value={group.title}
                aria-label={`Heading: ${group.title}`}
                onChange={e => onTitleChange(group.id, e.target.value)}
                onBlur={e => {
                  const t = e.target.value.trim()
                  if (t) onTitleChange(group.id, t)
                }}
              />
              <button
                type="button"
                className="quick-access-order-group-toggle"
                aria-label={groupDisabled ? `Enable category ${group.title}` : `Disable category ${group.title}`}
                title={groupDisabled ? 'Enable category' : 'Disable category (grey out tiles)'}
                onClick={() => onToggleGroup(group.id)}
              >
                {groupDisabled ? <Check size={14} /> : <X size={14} />}
              </button>
            </div>
            <ul
              className="quick-access-order-list quick-access-order-list--nested"
              onDragOver={handleDragOverSlot(group.id, group.links.length)}
              onDrop={handleDropSlot(group.id, group.links.length)}
            >
              {group.links.length === 0 && (
                <li
                  className="quick-access-order-dropzone"
                  data-drag-over={dropTarget?.groupId === group.id && dropTarget?.index === 0}
                  onDragOver={handleDragOverSlot(group.id, 0)}
                  onDrop={handleDropSlot(group.id, 0)}
                >
                  Drop modules here
                </li>
              )}
              {group.links.map((link, index) => {
                const Icon = link.icon
                const itemDisabled = link.disabled
                const isOver = dropTarget?.groupId === group.id && dropTarget?.index === index
                return (
                  <li
                    key={link.path}
                    className={`quick-access-order-item${itemDisabled ? ' quick-access-order-item--muted' : ''}`}
                    data-dragging={dragging && dragPayload.current?.path === link.path}
                    data-drag-over={isOver && dragPayload.current?.path !== link.path}
                    onDragOver={handleDragOverSlot(group.id, index)}
                    onDrop={handleDropSlot(group.id, index)}
                  >
                    <button
                      type="button"
                      className="quick-access-order-handle"
                      aria-label={`Move ${link.label}`}
                      draggable
                      onDragStart={handleDragStartItem(group.id, index, link.path)}
                      onDragEnd={handleDragEnd}
                    >
                      <GripVertical size={16} />
                    </button>
                    <button
                      type="button"
                      className="quick-access-order-item-body"
                      onClick={() => onNavigate(link.path)}
                    >
                      <span className="quick-access-order-item-icon">
                        <Icon size={15} />
                      </span>
                      <span className="quick-access-order-item-label">{link.label}</span>
                    </button>
                    <button
                      type="button"
                      className="quick-access-order-remove"
                      aria-label={itemDisabled ? `Enable ${link.label}` : `Disable ${link.label}`}
                      title={itemDisabled ? 'Enable on Quick Access' : 'Disable (grey out, keep in category)'}
                      onClick={() => onTogglePath(link.path)}
                    >
                      {itemDisabled ? <Check size={14} /> : <X size={14} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
          )
        })}
      </div>
    </aside>
  )
}

export default function QuickAccessPage() {
  const navigate = useNavigate()
  const { session, profile, loading: authLoading, refreshProfile } = useAuth()
  const { canRead } = useWmsRbac()
  const [flags, setFlags] = useState({ accountingEnabled: false, simpleAccountingEnabled: false })
  const [layout, setLayout] = useState({
    groups: [],
    groupOrder: [],
    disabledPaths: [],
    disabledGroupIds: [],
  })
  const saveTimerRef = useRef(null)
  const confirmPwRef = useRef(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [layoutSyncError, setLayoutSyncError] = useState(null)
  const [layoutHydrating, setLayoutHydrating] = useState(true)
  const layoutHydratedForUser = useRef(null)
  const pendingSaveRef = useRef(null)
  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = ['super_admin', 'admin', 'admin1'].includes(profile?.role)

  const userId = profile?.id || session?.user?.id
  const orderStorageKey = useMemo(() => quickAccessLayoutStorageKey(userId), [userId])
  const organizePanelKey = useMemo(
    () => `wms-quick-access-organize-open:${userId || 'anonymous'}`,
    [userId],
  )
  const organizePanelPinKey = useMemo(
    () => `wms-quick-access-organize-pinned:${userId || 'anonymous'}`,
    [userId],
  )
  const [organizePanelOpen, setOrganizePanelOpen] = useState(true)
  const [organizePanelPinned, setOrganizePanelPinned] = useState(false)

  const role = profile?.role

  const quickLinks = useMemo(
    () => buildQuickLinks({ role, canRead, isAdmin, isSuperAdmin, flags }),
    [role, canRead, isAdmin, isSuperAdmin, flags],
  )

  useEffect(() => {
    loadChurchSettings().then(({ data }) => {
      setFlags(getChurchFlags(data))
    })
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(organizePanelKey)
      if (stored === '0') setOrganizePanelOpen(false)
      else if (stored === '1') setOrganizePanelOpen(true)
      const pinned = localStorage.getItem(organizePanelPinKey)
      if (pinned === '1') {
        setOrganizePanelPinned(true)
        setOrganizePanelOpen(true)
      } else if (pinned === '0') setOrganizePanelPinned(false)
    } catch {
      /* private mode */
    }
  }, [organizePanelKey, organizePanelPinKey])

  const toggleOrganizePanel = useCallback(() => {
    if (organizePanelPinned) return
    setOrganizePanelOpen(prev => {
      const next = !prev
      try {
        localStorage.setItem(organizePanelKey, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [organizePanelKey, organizePanelPinned])

  const toggleOrganizePanelPin = useCallback(() => {
    setOrganizePanelPinned(prev => {
      const next = !prev
      try {
        localStorage.setItem(organizePanelPinKey, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (next) {
        setOrganizePanelOpen(true)
        try {
          localStorage.setItem(organizePanelKey, '1')
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }, [organizePanelPinKey, organizePanelKey])

  useEffect(() => {
    if (organizePanelPinned && !organizePanelOpen) {
      setOrganizePanelOpen(true)
    }
  }, [organizePanelPinned, organizePanelOpen])

  useEffect(() => {
    if (authLoading) return undefined
    if (!session?.user?.id) {
      setLayoutHydrating(false)
      return undefined
    }
    if (!profile) return undefined
    if (layoutHydratedForUser.current === userId) return undefined

    let cancelled = false
    async function hydrateLayout() {
      setLayoutHydrating(true)
      setLayoutSyncError(null)

      let remoteLayout = null
      if (userId) {
        const { layout, error, missingColumn } = await loadQuickAccessFromProfile(userId)
        if (error) {
          if (!cancelled) {
            setLayoutSyncError(
              missingColumn
                ? 'Cloud save is unavailable until migration 20260808120000_profiles_wms_quick_access.sql is applied on Supabase (profiles.wms_quick_access).'
                : (error.message || 'Could not load Quick Access from your profile.'),
            )
          }
        } else {
          remoteLayout = layout
        }
      }

      let merged = null
      if (remoteLayout && typeof remoteLayout === 'object') {
        merged = mergeQuickLinksIntoGroups(quickLinks, remoteLayout)
      } else if (profile?.wms_quick_access && typeof profile.wms_quick_access === 'object') {
        merged = mergeQuickLinksIntoGroups(quickLinks, profile.wms_quick_access)
      }

      const local = loadQuickAccessLayoutLocal(orderStorageKey)
      if (!merged && local) {
        merged = mergeQuickLinksIntoGroups(quickLinks, local)
      }

      if (!merged) {
        merged = mergeQuickLinksIntoGroups(quickLinks, null)
      } else if (userId && !remoteLayout && local) {
        const packed = packQuickAccessLayout(
          merged.groups,
          merged.groupOrder,
          merged.disabledPaths,
          merged.disabledGroupIds,
        )
        const { ok, error, missingColumn } = await saveQuickAccessToProfile(userId, packed)
        if (!ok && !cancelled) {
          setLayoutSyncError(
            missingColumn
              ? 'Layout is only on this device until migration 20260808120000_profiles_wms_quick_access.sql is applied on Supabase.'
              : (error?.message || 'Could not sync Quick Access to your profile.'),
          )
        } else if (ok) {
          refreshProfile?.()
        }
      }

      if (!cancelled) {
        setLayout(merged)
        layoutHydratedForUser.current = userId
        setLayoutHydrating(false)
      }
    }

    hydrateLayout()
    return () => { cancelled = true }
  }, [authLoading, session?.user?.id, userId, orderStorageKey, profile, quickLinks, refreshProfile])

  useEffect(() => {
    if (authLoading || layoutHydrating) return
    if (!layoutHydratedForUser.current) return
    setLayout(prev => {
      if (!prev.groups?.length) return mergeQuickLinksIntoGroups(quickLinks, null)
      return mergeQuickLinksIntoGroups(
        quickLinks,
        packQuickAccessLayout(
          prev.groups,
          prev.groupOrder,
          prev.disabledPaths,
          prev.disabledGroupIds,
        ),
      )
    })
  }, [quickLinks, authLoading, layoutHydrating])

  useEffect(() => {
    if (layoutHydratedForUser.current && layoutHydratedForUser.current !== userId) {
      layoutHydratedForUser.current = null
    }
  }, [userId])

  const flushCloudSave = useCallback(async () => {
    if (!userId || !pendingSaveRef.current) return
    const packed = pendingSaveRef.current
    pendingSaveRef.current = null
    const { ok, error, missingColumn } = await saveQuickAccessToProfile(userId, packed)
    if (!ok) {
      setLayoutSyncError(
        missingColumn
          ? 'Cloud save failed: apply migration 20260808120000_profiles_wms_quick_access.sql on Supabase.'
          : (error?.message || 'Could not save Quick Access to your profile.'),
      )
      return
    }
    setLayoutSyncError(null)
    refreshProfile?.()
  }, [userId, refreshProfile])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    flushCloudSave()
  }, [flushCloudSave])

  const persistLayout = useCallback((next) => {
    const packed = packQuickAccessLayout(
      next.groups,
      next.groupOrder,
      next.disabledPaths,
      next.disabledGroupIds,
    )
    saveQuickAccessLayoutLocal(orderStorageKey, packed)
    if (!userId) return
    pendingSaveRef.current = packed
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      flushCloudSave()
    }, 500)
  }, [orderStorageKey, userId, flushCloudSave])

  const commitLayout = useCallback((updater) => {
    setLayout(prev => {
      const draft = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      const next = {
        ...draft,
        groupOrder: (draft.groups || prev.groups).map(g => g.id),
      }
      persistLayout(next)
      return next
    })
  }, [persistLayout])

  const handleMove = useCallback((payload, toGroupId, toIndex) => {
    commitLayout(prev => ({
      ...prev,
      groups: moveLinkInGroups(prev.groups, payload, toGroupId, toIndex),
    }))
  }, [commitLayout])

  const handleTitleChange = useCallback((groupId, title) => {
    commitLayout(prev => ({
      ...prev,
      groups: updateGroupTitle(prev.groups, groupId, title),
    }))
  }, [commitLayout])

  const handleReorderGroups = useCallback((fromIndex, toIndex) => {
    commitLayout(prev => ({
      ...prev,
      groups: reorderGroups(prev.groups, fromIndex, toIndex),
    }))
  }, [commitLayout])

  const handleTogglePath = useCallback((path) => {
    commitLayout(prev => ({
      ...prev,
      disabledPaths: togglePathDisabled(prev.disabledPaths, path),
    }))
  }, [commitLayout])

  const handleToggleGroup = useCallback((groupId) => {
    commitLayout(prev => {
      const { disabledPaths, disabledGroupIds } = toggleCategoryDisabled(
        prev.groups,
        groupId,
        prev.disabledPaths,
        prev.disabledGroupIds,
      )
      return { ...prev, disabledPaths, disabledGroupIds }
    })
  }, [commitLayout])

  const closeConfirmModal = useCallback(() => {
    if (confirmBusy) return
    setConfirmAction(null)
    setConfirmPassword('')
    setConfirmPasswordError(false)
  }, [confirmBusy])

  useEffect(() => {
    if (confirmAction) {
      const t = setTimeout(() => confirmPwRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    return undefined
  }, [confirmAction])

  const handleConfirmDestructive = useCallback(async () => {
    const email = session?.user?.email || profile?.email
    if (!confirmAction || !email || !confirmPassword.trim()) return

    setConfirmBusy(true)
    setConfirmPasswordError(false)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: confirmPassword,
    })
    if (error) {
      setConfirmBusy(false)
      setConfirmPasswordError(true)
      confirmPwRef.current?.select()
      return
    }

    if (confirmAction === 'clear') {
      const allPaths = quickLinks.map(l => l.path)
      commitLayout(prev => ({
        ...prev,
        disabledPaths: allPaths,
        disabledGroupIds: [],
      }))
    } else if (confirmAction === 'reset') {
      const fresh = mergeQuickLinksIntoGroups(quickLinks, null)
      commitLayout(() => fresh)
    }

    setConfirmBusy(false)
    setConfirmAction(null)
    setConfirmPassword('')
    setConfirmPasswordError(false)
  }, [confirmAction, confirmPassword, session?.user?.email, profile?.email, quickLinks, commitLayout])

  const resolveOpts = useMemo(() => ({
    disabledPaths: layout.disabledPaths,
    disabledGroupIds: layout.disabledGroupIds,
  }), [layout.disabledPaths, layout.disabledGroupIds])

  const displayGroups = useMemo(
    () => resolveGroupedLinks(layout.groups, quickLinks, resolveOpts),
    [layout.groups, quickLinks, resolveOpts],
  )

  const panelGroups = useMemo(
    () => resolveGroupedLinks(layout.groups, quickLinks, { ...resolveOpts, includeEmpty: true }),
    [layout.groups, quickLinks, resolveOpts],
  )

  /** Main grid: only enabled tiles; disabled items stay visible (greyed) in the side panel. */
  const canvasGroups = useMemo(
    () => displayGroups
      .map(g => ({ ...g, links: g.links.filter(l => !l.disabled) }))
      .filter(g => g.links.length > 0),
    [displayGroups],
  )

  const hasAnyLayout = layout.groups.some(g => g.paths.length > 0)
  const hasEnabledTiles = canvasGroups.length > 0

  if (authLoading || layoutHydrating) {
    return (
      <div className="quick-access-loading">
        <div className="quick-access-spinner" />
        <p>Loading your workspace…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="quick-access-loading">
        <LayoutGrid size={44} color="var(--text-3)" />
        <p>Please log in to view quick access.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in quick-access-page">
      <QuickAccessPasswordConfirmModal
        action={confirmAction}
        busy={confirmBusy}
        password={confirmPassword}
        passwordError={confirmPasswordError}
        inputRef={confirmPwRef}
        onPasswordChange={v => { setConfirmPassword(v); setConfirmPasswordError(false) }}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmDestructive}
      />
      {layoutSyncError && (
        <div className="quick-access-sync-banner" role="status">
          <p>{layoutSyncError}</p>
          <button type="button" className="quick-access-sync-banner-dismiss" onClick={() => setLayoutSyncError(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div
        className={`quick-access-layout${organizePanelOpen ? '' : ' quick-access-layout--panel-closed'}`}
      >
        <div className="quick-access-main">
          {hasAnyLayout && (
            <section className="quick-access-section animate-slide-up">
              <div className="page-header" style={{ marginBottom: 18, paddingBottom: 0, border: 'none' }}>
                <div>
                  <h1 className="page-title">Quick Access</h1>
                  <p className="page-subtitle">Drag tiles to reorder. Hidden modules stay in the panel (greyed) until you turn them back on.</p>
                </div>
              </div>
              {canvasGroups.map(group => (
                <QuickAccessMainGroup
                  key={group.id}
                  group={group}
                  onMove={handleMove}
                  onNavigate={navigate}
                />
              ))}
            </section>
          )}

          {hasAnyLayout && !hasEnabledTiles && (
            <div className="card quick-access-tip animate-slide-up" style={{ padding: '22px 24px' }}>
              <h3 className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>All tiles disabled</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
                Enable categories or modules in the panel on the right, or use the left sidebar.
              </p>
            </div>
          )}

          {!isAdmin && quickLinks.length === 0 && (
            <div className="card quick-access-tip animate-slide-up" style={{ animationDelay: '80ms', padding: '22px 24px' }}>
              <h3 className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>Quick Access</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
                Use the sidebar when modules are assigned to your role. Contact your administrator if you need access to additional areas.
              </p>
            </div>
          )}
        </div>

        {quickLinks.length > 0 && (
          <div
            className={`quick-access-panel-column${organizePanelOpen ? ' is-open' : ' is-closed'}${organizePanelPinned ? ' is-pinned' : ''}`}
          >
            {!organizePanelOpen && !organizePanelPinned && (
              <button
                type="button"
                className="quick-access-panel-reopen"
                onClick={toggleOrganizePanel}
                aria-expanded={false}
                aria-controls="quick-access-organize-panel"
                aria-label="Open organize panel"
                title="Open organize panel"
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
            )}
            <div className="quick-access-order-panel-wrap">
              {organizePanelOpen && (
              <QuickAccessGroupPanel
                groups={panelGroups}
                disabledPaths={layout.disabledPaths}
                disabledGroupIds={layout.disabledGroupIds}
                onMove={handleMove}
                onTitleChange={handleTitleChange}
                onReorderGroups={handleReorderGroups}
                onTogglePath={handleTogglePath}
                onToggleGroup={handleToggleGroup}
                onNavigate={navigate}
                onRequestClearCanvas={() => setConfirmAction('clear')}
                onRequestResetLayout={() => setConfirmAction('reset')}
                panelPinned={organizePanelPinned}
                onTogglePanelPin={toggleOrganizePanelPin}
                onClosePanel={toggleOrganizePanel}
              />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
