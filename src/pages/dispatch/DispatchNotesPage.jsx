import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDispatches } from '../../lib/dispatchLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, Truck } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'

export default function DispatchNotesPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { canEdit } = useWmsModuleAccess('dispatch')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listDispatches()) } catch { setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Truck size={22} style={{ color: 'var(--primary)' }} /> Dispatch notes
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Delivery challans against customer POs.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => navigate('/dispatch/notes/new')}>
            <Plus size={16} /> New dispatch
          </button>
        )}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No dispatches yet.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['DC no.', 'Date', 'PO', 'Customer', 'LR / vehicle', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)', cursor: 'pointer' }} onClick={() => navigate(`/dispatch/notes/${r.id}`)}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.dispatch_no}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.dispatch_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{r.po?.po_number}</td>
                  <td style={{ padding: '10px 14px' }}>{r.customer?.name}</td>
                  <td style={{ padding: '10px 14px' }}>{[r.lr_number, r.vehicle_no].filter(Boolean).join(' / ') || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
