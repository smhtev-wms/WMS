import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters } from '../../lib/mastersLib'
import { listPurchaseOrders } from '../../lib/ordersLib'
import { PO_STATUSES, statusMeta, fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, Search, FileText, Pencil } from 'lucide-react'

export default function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listPurchaseOrders())
    } catch (e) {
      toast(e.message || 'Failed to load purchase orders', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (!q) return true
      return [r.po_number, r.customer_po_ref, r.customer?.name, r.customer?.customer_code]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    })
  }, [rows, search, statusFilter])

  function StatusBadge({ status }) {
    const m = statusMeta(PO_STATUSES, status)
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>
        {m.label}
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={22} style={{ color: 'var(--primary)' }} /> Purchase orders
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Customer PO entry, line items, and drawing attachments.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => navigate('/orders/purchase-orders/new')}>
            <Plus size={16} /> New PO
          </button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-3)' }} />
        <input className="field-input" style={{ flex: '1 1 200px' }} placeholder="Search PO no., customer ref…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field-input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {PO_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} shown</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No purchase orders yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--table-border)' }}>
                  {['PO no.', 'PO date', 'Customer', 'Cust. PO ref', 'Delivery', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)', cursor: 'pointer' }} onClick={() => navigate(`/orders/purchase-orders/${row.id}`)}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.po_number}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.po_date)}</td>
                    <td style={{ padding: '10px 14px' }}>{row.customer?.name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.customer_po_ref || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.delivery_date)}</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: '8px 14px' }} onClick={e => e.stopPropagation()}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => navigate(`/orders/purchase-orders/${row.id}`)} title="Open">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
