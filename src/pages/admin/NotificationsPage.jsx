import { useState, useEffect, useCallback, useMemo } from 'react'

import { useNavigate } from 'react-router-dom'

import { useToast } from '../../lib/toast'

import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'

import {

  listNotifications,

  markNotificationRead,

  markAllNotificationsRead,

  refreshSystemNotifications,

  notificationCategory,

} from '../../lib/notificationLib'

import { logWmsAudit } from '../../lib/auditLib'

import { Loader2, Bell, RefreshCw, CheckCheck } from 'lucide-react'



const SEV_STYLE = {

  info: { bg: '#dbeafe', color: '#2563eb' },

  warning: { bg: '#ffedd5', color: '#d97706' },

  urgent: { bg: '#fee2e2', color: '#dc2626' },

}



const CATEGORY_TABS = [

  { id: 'all', label: 'All' },

  { id: 'commercial', label: 'Commercial' },

  { id: 'operations', label: 'Operations' },

]



export default function NotificationsPage() {

  const navigate = useNavigate()

  const toast = useToast()

  const { canEdit: canRefreshAlerts } = useWmsModuleAccess('commercial')

  const [rows, setRows] = useState([])

  const [loading, setLoading] = useState(true)

  const [refreshing, setRefreshing] = useState(false)

  const [category, setCategory] = useState('all')



  const load = useCallback(async () => {

    setLoading(true)

    try { setRows(await listNotifications()) } catch (e) { toast(e.message, 'error') }

    finally { setLoading(false) }

  }, [toast])



  useEffect(() => { load() }, [load])



  const filtered = useMemo(() => {

    if (category === 'all') return rows

    return rows.filter(n => notificationCategory(n.source_type) === category)

  }, [rows, category])



  async function runRefresh() {

    if (!canRefreshAlerts) return

    setRefreshing(true)

    try {

      const r = await refreshSystemNotifications()

      await logWmsAudit({ action: 'system', module: 'admin', summary: `Refreshed system notifications (${r.upserts} alerts)` })

      toast(`Alerts refreshed (${r.upserts} rules matched).`, 'success')

      await load()

    } catch (e) { toast(e.message, 'error') }

    finally { setRefreshing(false) }

  }



  async function openItem(n) {

    if (!n.is_read) await markNotificationRead(n.id)

    if (n.link_path) navigate(n.link_path)

    await load()

  }



  async function markAll() {

    try {

      await markAllNotificationsRead()

      await load()

    } catch (e) { toast(e.message, 'error') }

  }



  return (

    <div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>

        <div>

          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>

            <Bell size={22} style={{ color: 'var(--primary)' }} /> Notifications

          </h1>

          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>

            Commercial (tenders, receivables) and operations (calibration, PM).

          </p>

        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

          {canRefreshAlerts && (

            <button type="button" className="btn btn-secondary" onClick={runRefresh} disabled={refreshing}>

              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh alerts

            </button>

          )}

          <button type="button" className="btn btn-secondary" onClick={markAll}><CheckCheck size={14} /> Mark all read</button>

        </div>

      </div>



      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>

        {CATEGORY_TABS.map(tab => (

          <button

            key={tab.id}

            type="button"

            className={category === tab.id ? 'btn btn-primary' : 'btn btn-secondary'}

            style={{ padding: '6px 14px', fontSize: 13 }}

            onClick={() => setCategory(tab.id)}

          >

            {tab.label}

          </button>

        ))}

      </div>



      <div className="card" style={{ overflow: 'hidden' }}>

        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : filtered.length === 0 ? (

          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>

            No notifications{category !== 'all' ? ` in ${category}` : ''}.

            {canRefreshAlerts && category === 'all' && ' Use Refresh alerts to scan overdue items.'}

          </div>

        ) : (

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>

            {filtered.map(n => {

              const st = SEV_STYLE[n.severity] || SEV_STYLE.info

              const cat = notificationCategory(n.source_type)

              return (

                <li key={n.id} style={{ borderBottom: '1px solid var(--table-border)' }}>

                  <button

                    type="button"

                    onClick={() => openItem(n)}

                    style={{

                      width: '100%',

                      textAlign: 'left',

                      padding: '14px 18px',

                      background: n.is_read ? 'transparent' : 'var(--accent-subtle)',

                      border: 'none',

                      cursor: 'pointer',

                    }}

                  >

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>

                      <div>

                        <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>

                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{n.body}</div>

                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, textTransform: 'capitalize' }}>{cat}</div>

                      </div>

                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color, flexShrink: 0 }}>{n.severity}</span>

                    </div>

                  </button>

                </li>

              )

            })}

          </ul>

        )}

      </div>

    </div>

  )

}

