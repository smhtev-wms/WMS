import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listAuditLog } from '../../lib/auditLib'
import { WMS_MODULES } from '../../lib/wmsRbacLib'
import { Loader2, ScrollText } from 'lucide-react'

function fmtWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AuditTrailPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const isAdmin = ['super_admin', 'admin', 'admin1'].includes(profile?.role)
  const [rows, setRows] = useState([])
  const [module, setModule] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listAuditLog({ module })) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast, module])

  useEffect(() => { load() }, [load])

  if (!isAdmin) {
    return <div className="card" style={{ padding: 24 }}>Audit trail is available to administrators only.</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScrollText size={22} style={{ color: 'var(--primary)' }} /> Audit trail
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Who changed what in WMS (client-logged actions).</p>
      </div>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
        <label className="field-label">Module filter</label>
        <select className="field-input" style={{ maxWidth: 280 }} value={module} onChange={e => setModule(e.target.value)}>
          <option value="">All modules</option>
          {WMS_MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No audit entries yet.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['When', 'User', 'Action', 'Module', 'Summary'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{fmtWhen(r.created_at)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{r.user_email || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{r.action}</td>
                  <td style={{ padding: '10px 14px' }}>{r.module}</td>
                  <td style={{ padding: '10px 14px' }}>{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
