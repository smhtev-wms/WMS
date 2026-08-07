import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../lib/toast'
import { getOrderStatusSummary } from '../../lib/ordersLib'
import { PO_STATUSES, statusMeta, fmtDate } from '../../lib/orderConstants'
import { Loader2, Activity, AlertTriangle } from 'lucide-react'

export default function OrderStatusPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ byStatus: {}, total: 0, overdue: [], rows: [] })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await getOrderStatusSummary())
    } catch (e) {
      toast(e.message || 'Failed to load order status', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const active = PO_STATUSES.filter(s => !['closed', 'cancelled'].includes(s.value))

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
        <Loader2 size={20} className="animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={22} style={{ color: 'var(--primary)' }} /> Order status
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>PO lifecycle overview and overdue deliveries.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{summary.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Total POs</div>
        </div>
        {active.map(s => {
          const count = summary.byStatus[s.value] || 0
          const m = statusMeta(PO_STATUSES, s.value)
          return (
            <div key={s.value} className="card" style={{ padding: 16, textAlign: 'center', borderLeft: `4px solid ${m.color}` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.3 }}>{m.label}</div>
            </div>
          )
        })}
      </div>

      {summary.overdue.length > 0 && (
        <div className="card" style={{ padding: 18, marginBottom: 16, borderColor: 'var(--warning)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warning)' }}>
            <AlertTriangle size={16} /> Overdue delivery ({summary.overdue.length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--table-border)' }}>
                  {['PO', 'Customer', 'Delivery', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.overdue.map(r => {
                  const m = statusMeta(PO_STATUSES, r.status)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)', cursor: 'pointer' }} onClick={() => navigate(`/orders/purchase-orders/${r.id}`)}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{r.po_number}</td>
                      <td style={{ padding: '8px 10px' }}>{r.customer?.name || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{fmtDate(r.delivery_date)}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: m.color }}>{m.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--table-border)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Open orders</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                {['PO', 'Customer', 'Delivery', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.rows
                .filter(r => !['closed', 'cancelled'].includes(r.status))
                .sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || '')))
                .map(r => {
                  const m = statusMeta(PO_STATUSES, r.status)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)', cursor: 'pointer' }} onClick={() => navigate(`/orders/purchase-orders/${r.id}`)}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{r.po_number}</td>
                      <td style={{ padding: '10px 14px' }}>{r.customer?.name || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{fmtDate(r.delivery_date)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>{m.label}</span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
