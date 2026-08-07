import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useToast } from '../../lib/toast'
import { getPurchaseOrder, listPoAmendments, isUuid } from '../../lib/ordersLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function PoAmendmentsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [poNumber, setPoNumber] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    if (!isUuid(id)) {
      navigate('/orders/purchase-orders', { replace: true })
      return
    }
    setLoading(true)
    try {
      const [po, amendments] = await Promise.all([
        getPurchaseOrder(id),
        listPoAmendments(id),
      ])
      setPoNumber(po.po_number)
      setRows(amendments)
    } catch (e) {
      toast(e.message || 'Failed to load amendments', 'error')
      navigate('/orders/purchase-orders')
    } finally {
      setLoading(false)
    }
  }, [id, navigate, toast])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
        <Loader2 size={20} className="animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/orders/purchase-orders/${id}`)}>
          <ArrowLeft size={16} /> Back to PO
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Amendments — {poNumber}</h1>
        <Link to="/orders/purchase-orders" style={{ fontSize: 13, color: 'var(--primary)' }}>All POs</Link>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No amendments recorded. Saving changes on the PO form with an amendment reason creates a history entry.
          </div>
        ) : (
          <div style={{ padding: 0 }}>
            {rows.map(row => (
              <div key={row.id} style={{ borderBottom: '1px solid var(--table-border)', padding: '16px 18px' }}>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Amendment #{row.amendment_no}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(String(row.created_at).slice(0, 10))}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-2)' }}>{row.reason}</p>
                  <span style={{ fontSize: 11, color: 'var(--primary)' }}>{expanded === row.id ? 'Hide snapshots' : 'View before / after'}</span>
                </button>
                {expanded === row.id && (
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>Before</div>
                      <pre style={{ fontSize: 11, background: 'var(--bg-2)', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 320, margin: 0 }}>
                        {JSON.stringify(row.snapshot_before, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>After</div>
                      <pre style={{ fontSize: 11, background: 'var(--bg-2)', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 320, margin: 0 }}>
                        {JSON.stringify(row.snapshot_after, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
