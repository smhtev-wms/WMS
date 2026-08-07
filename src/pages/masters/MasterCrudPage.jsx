/* ═══════════════════════════════════════════════════════════════
   MasterCrudPage — shared list + modal CRUD for WMS master tables
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters, listMaster, saveMaster, setMasterActive, listCustomersBrief } from '../../lib/mastersLib'
import { Loader2, Plus, Pencil, Power, Search, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

function matchesSearch(row, q, config) {
  if (!q) return true
  const s = q.toLowerCase()
  const keys = [
    config.codeField,
    config.nameField,
    ...(config.columns || []).map(c => c.key),
  ]
  return keys.some(k => String(row[k] ?? '').toLowerCase().includes(s))
}

export default function MasterCrudPage({ config }) {
  const { profile } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)
  const Icon = config.icon

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...config.emptyForm })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listMaster(config.table, { orderBy: config.codeField, ascending: true })
      setRows(data)
    } catch (e) {
      toast(e.message || 'Failed to load records', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [config.table, config.codeField, toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (config.loadOptions !== 'customers') return
    listCustomersBrief().then(setCustomers).catch(() => setCustomers([]))
  }, [config.loadOptions])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (!showInactive && r.is_active === false) return false
      return matchesSearch(r, search.trim(), config)
    })
  }, [rows, search, showInactive, config])

  function openNew() {
    setEditing(null)
    setForm({ ...config.emptyForm })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    const next = { ...config.emptyForm }
    for (const k of Object.keys(next)) {
      next[k] = row[k] ?? next[k]
    }
    setForm(next)
    setModalOpen(true)
  }

  async function handleSave() {
    for (const f of config.fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) {
        toast(`${f.label} is required.`, 'error')
        return
      }
    }
    setSaving(true)
    try {
      const payload = { ...form }
      if (payload.default_customer_id === '') payload.default_customer_id = null
      await saveMaster(config.table, payload, editing)
      toast(editing ? 'Updated.' : 'Created.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row) {
    if (!canEdit) return
    try {
      await setMasterActive(config.table, row.id, !row.is_active)
      toast(row.is_active ? 'Deactivated.' : 'Reactivated.', 'success')
      await load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  function renderField(f) {
    const val = form[f.key] ?? ''
    const set = v => setForm(prev => ({ ...prev, [f.key]: v }))

    if (f.type === 'textarea') {
      return (
        <textarea
          className="field-input"
          style={{ height: 72, padding: '8px 10px', resize: 'vertical' }}
          value={val}
          onChange={e => set(e.target.value)}
          placeholder={f.placeholder}
        />
      )
    }
    if (f.type === 'select') {
      return (
        <select className="field-input" value={val} onChange={e => set(e.target.value)}>
          {(f.options || []).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    }
    if (f.type === 'customer_select') {
      return (
        <select className="field-input" value={val || ''} onChange={e => set(e.target.value)}>
          <option value="">— None —</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>
          ))}
        </select>
      )
    }
    return (
      <input
        className="field-input"
        value={val}
        onChange={e => set(e.target.value)}
        placeholder={f.placeholder}
      />
    )
  }

  if (!canManageMasters(profile?.role) && profile?.role !== 'user' && profile?.role !== 'demo') {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)' }}>You do not have access to master data.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 32 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={20} style={{ color: 'var(--accent)' }} />
            {config.title}
          </h1>
          <p className="page-subtitle">{config.subtitle}</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Add {config.codeLabel?.toLowerCase() || 'record'}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px' }}>
          <Search size={16} style={{ color: 'var(--text-3)' }} />
          <input
            className="field-input"
            style={{ flex: 1 }}
            placeholder={config.searchHint}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} shown</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No records yet.{canEdit ? ' Click Add to create the first entry.' : ''}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--table-border)' }}>
                  {config.columns.map(col => (
                    <th key={col.key} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {col.label}
                    </th>
                  ))}
                  <th style={{ padding: '10px 14px', width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)', opacity: row.is_active === false ? 0.55 : 1 }}>
                    {config.columns.map(col => {
                      const raw = row[col.key]
                      const text = col.format ? col.format(raw, row) : (raw ?? '—')
                      return (
                        <td key={col.key} style={{ padding: '10px 14px', color: 'var(--text-1)', fontFamily: col.mono ? 'monospace' : 'inherit', fontSize: col.mono ? 12 : 13 }}>
                          {text || '—'}
                        </td>
                      )
                    })}
                    <td style={{ padding: '8px 14px' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEdit(row)} title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => toggleActive(row)} title={row.is_active ? 'Deactivate' : 'Activate'}>
                            <Power size={14} style={{ color: row.is_active ? 'var(--warning)' : 'var(--success)' }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 520 }}>
        <div className="card-header">
          <h3 className="card-title">{editing ? `Edit ${config.title}` : `New ${config.title}`}</h3>
          <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {config.fields.map(f => (
            <div key={f.key}>
              <label className="field-label">
                {f.label}{f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
              </label>
              {renderField(f)}
            </div>
          ))}
        </div>
        <div className="modal-panel-footer" style={{ padding: '0 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
          </button>
        </div>
      </AppModal>
    </div>
  )
}
