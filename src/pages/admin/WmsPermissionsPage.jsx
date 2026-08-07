import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsRbac } from '../../lib/WmsRbacContext'
import {
  WMS_MODULES,
  WMS_ROLES,
  listRolePermissions,
  saveRolePermission,
} from '../../lib/wmsRbacLib'
import { logWmsAudit } from '../../lib/auditLib'
import { Loader2, Shield, Save } from 'lucide-react'

export default function WmsPermissionsPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { reload: reloadRbac } = useWmsRbac()
  const [matrix, setMatrix] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isSuper = profile?.role === 'super_admin'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listRolePermissions()
      const m = {}
      for (const r of rows) {
        m[`${r.role}:${r.module}`] = { can_read: r.can_read, can_write: r.can_write }
      }
      setMatrix(m)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  function get(role, mod) {
    return matrix[`${role}:${mod.key}`] || { can_read: false, can_write: false }
  }

  function toggle(role, mod, field) {
    const k = `${role}:${mod.key}`
    const cur = get(role, mod)
    setMatrix(prev => ({
      ...prev,
      [k]: { ...cur, [field]: !cur[field] },
    }))
  }

  async function saveAll() {
    setSaving(true)
    try {
      for (const role of WMS_ROLES) {
        for (const mod of WMS_MODULES) {
          const p = get(role, mod)
          await saveRolePermission({
            role,
            module: mod.key,
            can_read: p.can_read,
            can_write: p.can_write,
          })
        }
      }
      await logWmsAudit({
        action: 'update',
        module: 'admin',
        summary: 'Updated WMS role permission matrix',
      })
      await reloadRbac()
      toast('Permissions saved.', 'success')
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  if (!isSuper) {
    return <div className="card" style={{ padding: 24 }}>Only Super Admin can edit WMS module permissions.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} style={{ color: 'var(--primary)' }} /> WMS permissions
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Read/write access by role and module (field-level RBAC).</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving || loading}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save matrix</>}
        </button>
      </div>

      {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="w-full" style={{ fontSize: 12, borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>Module</th>
                {WMS_ROLES.map(r => (
                  <th key={r} colSpan={2} style={{ padding: 10, textAlign: 'center', fontSize: 11 }}>{r}</th>
                ))}
              </tr>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                <th />
                {WMS_ROLES.map(r => (
                  <th key={r} style={{ padding: 4, fontSize: 10, fontWeight: 600 }} colSpan={2}>R / W</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WMS_MODULES.map(mod => (
                <tr key={mod.key} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{mod.label}</td>
                  {WMS_ROLES.map(role => {
                    const p = get(role, mod)
                    return (
                      <td key={role} style={{ padding: 6, textAlign: 'center' }} colSpan={2}>
                        <label style={{ marginRight: 8 }}>
                          <input type="checkbox" checked={p.can_read} onChange={() => toggle(role, mod, 'can_read')} />
                        </label>
                        <label>
                          <input type="checkbox" checked={p.can_write} onChange={() => toggle(role, mod, 'can_write')} />
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
