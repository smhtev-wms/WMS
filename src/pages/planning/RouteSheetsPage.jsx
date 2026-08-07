import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listRouteSheets } from '../../lib/planningLib'
import { ROUTE_SHEET_STATUSES, statusMeta } from '../../lib/planningConstants'
import { Loader2, Plus, Pencil, Search, ClipboardList } from 'lucide-react'

export default function RouteSheetsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('planning')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listRouteSheets())
    } catch (e) {
      toast(e.message || 'Failed to load route sheets', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.sheet_code, r.revision, r.item?.item_code, r.item?.description]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  function StatusBadge({ status }) {
    const m = statusMeta(ROUTE_SHEET_STATUSES, status)
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>
        {m.label}
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={22} style={{ color: 'var(--primary)' }} /> Route / process sheets
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Operation sequence per item revision for shop planning.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => navigate('/planning/route-sheets/new')}>
            <Plus size={16} /> New route sheet
          </button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-3)' }} />
        <input className="field-input" style={{ flex: 1 }} placeholder="Search code, item…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} shown</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No route sheets yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--table-border)' }}>
                  {['Sheet code', 'Item', 'Rev', 'Ops', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)', cursor: 'pointer' }} onClick={() => navigate(`/planning/route-sheets/${row.id}`)}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.sheet_code}</td>
                    <td style={{ padding: '10px 14px' }}>{row.item ? `${row.item.item_code} — ${row.item.description}` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.revision}</td>
                    <td style={{ padding: '10px 14px' }}>{row.operation_count}</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: '8px 14px' }} onClick={e => e.stopPropagation()}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => navigate(`/planning/route-sheets/${row.id}`)}>
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
