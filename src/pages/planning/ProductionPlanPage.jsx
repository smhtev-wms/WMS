import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '../../lib/toast'
import { getProductionPlanRows } from '../../lib/planningLib'
import { fmtDate, fmtDateTime } from '../../lib/planningConstants'
import { Loader2, BarChart3 } from 'lucide-react'

const RISK = {
  ok: { label: 'On track', color: '#16a34a', bg: '#dcfce7' },
  tight: { label: 'Tight', color: '#d97706', bg: '#ffedd5' },
  late: { label: 'At risk', color: '#dc2626', bg: '#fee2e2' },
  no_schedule: { label: 'Not scheduled', color: '#64748b', bg: '#f1f5f9' },
  unknown: { label: '—', color: '#64748b', bg: '#f1f5f9' },
}

export default function ProductionPlanPage() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getProductionPlanRows())
    } catch (e) {
      toast(e.message || 'Failed to load production plan', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'risk') return rows.filter(r => ['late', 'no_schedule', 'tight'].includes(r.plan_risk))
    return rows.filter(r => r.plan_risk === filter)
  }, [rows, filter])

  const counts = useMemo(() => {
    const c = { ok: 0, tight: 0, late: 0, no_schedule: 0 }
    for (const r of rows) {
      if (c[r.plan_risk] != null) c[r.plan_risk]++
    }
    return c
  }, [rows])

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart3 size={22} style={{ color: 'var(--primary)' }} /> Production plan vs delivery
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Open PO lines compared to route readiness and latest machine schedule.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {Object.entries(counts).map(([key, n]) => {
          const m = RISK[key]
          return (
            <button
              key={key}
              type="button"
              className="card"
              onClick={() => setFilter(filter === key ? 'all' : key)}
              style={{ padding: 14, textAlign: 'center', cursor: 'pointer', border: filter === key ? `2px solid ${m.color}` : undefined }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{n}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.label}</div>
            </button>
          )
        })}
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Filter:</span>
        <select className="field-input" style={{ width: 200 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All lines</option>
          <option value="risk">Needs attention</option>
          <option value="late">At risk</option>
          <option value="tight">Tight</option>
          <option value="no_schedule">Not scheduled</option>
          <option value="ok">On track</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} lines</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No open PO lines to plan.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['PO', 'Line', 'Qty', 'Delivery', 'Days left', 'Route', 'Latest plan end', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const m = RISK[row.plan_risk] || RISK.unknown
                  const delivery = row.po?.delivery_date || row.line_delivery
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.po?.po_number}</td>
                      <td style={{ padding: '10px 14px' }}>
                        L{row.line_no} — {row.description}
                        {row.item?.item_code && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.item.item_code}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{row.qty} {row.uom}</td>
                      <td style={{ padding: '10px 14px' }}>{fmtDate(delivery)}</td>
                      <td style={{ padding: '10px 14px' }}>{row.days_to_delivery != null ? row.days_to_delivery : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{row.has_route ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>{fmtDateTime(row.planned_end)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>{m.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
