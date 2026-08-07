import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listMachinesBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listTooling, saveTooling, setToolingActive } from '../../lib/toolingLib'
import { TOOL_TYPES, dueLabel, daysUntil } from '../../lib/phase3Constants'
import { Loader2, Plus, Wrench, X, Save, Pencil, Power } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  tool_code: '',
  name: '',
  tool_type: 'gauge',
  location: '',
  machine_id: '',
  calibration_required: true,
  calibration_interval_days: '365',
  last_calibration_date: '',
  notes: '',
})

export default function ToolingPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('masters')
  const [rows, setRows] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listTooling()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listMachinesBrief().then(setMachines).catch(() => []) }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows.filter(r => r.is_active !== false)
    return rows.filter(r => r.is_active !== false && (
      [r.tool_code, r.name, r.location].some(v => String(v || '').toLowerCase().includes(q))
    ))
  }, [rows, search])

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      tool_code: row.tool_code,
      name: row.name,
      tool_type: row.tool_type,
      location: row.location || '',
      machine_id: row.machine_id || '',
      calibration_required: row.calibration_required,
      calibration_interval_days: row.calibration_interval_days ? String(row.calibration_interval_days) : '',
      last_calibration_date: row.last_calibration_date || '',
      notes: row.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.tool_code?.trim() || !form.name?.trim()) {
      toast('Tool code and name are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveTooling(form, editing)
      toast('Saved.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function toggleActive(row) {
    try {
      await setToolingActive(row.id, !row.is_active)
      toast(row.is_active ? 'Deactivated.' : 'Reactivated.', 'success')
      await load()
    } catch (e) { toast(e.message, 'error') }
  }

  function calCell(row) {
    if (!row.calibration_required) return '—'
    const n = daysUntil(row.next_calibration_date)
    const label = dueLabel(row.next_calibration_date)
    const color = n != null && n < 0 ? 'var(--danger)' : n != null && n <= 14 ? 'var(--warning)' : 'var(--text-2)'
    return <span style={{ color, fontSize: 12 }}>{label}</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wrench size={22} style={{ color: 'var(--primary)' }} /> Tooling & gauges
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Tools, fixtures, and calibration due dates.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add tool</button>}
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
        <input className="field-input" placeholder="Search code, name, location…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No tooling records.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Code', 'Name', 'Type', 'Machine', 'Cal. due', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.tool_code}</td>
                  <td style={{ padding: '10px 14px' }}>{r.name}</td>
                  <td style={{ padding: '10px 14px' }}>{TOOL_TYPES.find(t => t.value === r.tool_type)?.label || r.tool_type}</td>
                  <td style={{ padding: '10px 14px' }}>{r.machine ? `${r.machine.machine_code}` : '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{calCell(r)}</td>
                  <td style={{ padding: '8px 14px' }}>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEdit(r)}><Pencil size={14} /></button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => toggleActive(r)}><Power size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 520 }}>
        <div className="card-header">
          <h3 className="card-title">{editing ? 'Edit tool' : 'New tool / gauge'}</h3>
          <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="field-label">Tool code *</label>
            <input className="field-input" value={form.tool_code} onChange={e => setForm(f => ({ ...f, tool_code: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Name *</label>
            <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select className="field-input" value={form.tool_type} onChange={e => setForm(f => ({ ...f, tool_type: e.target.value }))}>
              {TOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Location</label>
            <input className="field-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Machine (optional)</label>
            <select className="field-input" value={form.machine_id} onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))}>
              <option value="">—</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.name}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.calibration_required} onChange={e => setForm(f => ({ ...f, calibration_required: e.target.checked }))} />
            Calibration required
          </label>
          {form.calibration_required && (
            <>
              <div>
                <label className="field-label">Interval (days)</label>
                <input type="number" className="field-input" value={form.calibration_interval_days} onChange={e => setForm(f => ({ ...f, calibration_interval_days: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Last calibration</label>
                <input type="date" className="field-input" value={form.last_calibration_date} onChange={e => setForm(f => ({ ...f, last_calibration_date: e.target.value }))} />
              </div>
            </>
          )}
          <textarea className="field-input" rows={2} placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="modal-panel-footer" style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={14} /> Save</button>
        </div>
      </AppModal>
    </div>
  )
}
