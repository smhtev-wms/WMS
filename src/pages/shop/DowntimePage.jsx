import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listMachinesBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listDowntimeLogs, saveDowntimeLog } from '../../lib/shopLib'
import { DOWNTIME_CATEGORIES } from '../../lib/shopConstants'
import { toLocalInputValue, fromLocalInputValue } from '../../lib/planningConstants'
import { Loader2, Plus, TimerOff, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  machine_id: '',
  started_at: toLocalInputValue(new Date().toISOString()),
  ended_at: '',
  category: 'breakdown',
  reason: '',
  notes: '',
})

export default function DowntimePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('shop')

  const [rows, setRows] = useState([])
  const [machines, setMachines] = useState([])
  const [machineFilter, setMachineFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listDowntimeLogs({ machineId: machineFilter || undefined }))
    } catch (e) {
      toast(e.message || 'Failed to load downtime log', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [machineFilter, toast])

  useEffect(() => { listMachinesBrief().then(setMachines).catch(() => setMachines([])) }, [])
  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm(), machine_id: machineFilter || '' })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      machine_id: row.machine_id,
      started_at: toLocalInputValue(row.started_at),
      ended_at: row.ended_at ? toLocalInputValue(row.ended_at) : '',
      category: row.category,
      reason: row.reason,
      notes: row.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.machine_id || !form.reason?.trim() || !form.started_at) {
      toast('Machine, start time, and reason are required.', 'error')
      return
    }
    const started_at = fromLocalInputValue(form.started_at)
    const ended_at = form.ended_at ? fromLocalInputValue(form.ended_at) : null
    if (ended_at && ended_at <= started_at) {
      toast('End time must be after start.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveDowntimeLog({ ...form, started_at, ended_at }, editing)
      toast(editing ? 'Updated.' : 'Logged.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function fmtDt(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <TimerOff size={22} style={{ color: 'var(--primary)' }} /> Machine downtime
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Breakdowns, setup delays, and maintenance stoppages.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Log downtime</button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14 }}>
        <label className="field-label">Machine filter</label>
        <select className="field-input" style={{ maxWidth: 280 }} value={machineFilter} onChange={e => setMachineFilter(e.target.value)}>
          <option value="">All machines</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No downtime records.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['Machine', 'Category', 'Reason', 'Start', 'End', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px' }}>{row.machine?.machine_code}</td>
                    <td style={{ padding: '10px 14px' }}>{DOWNTIME_CATEGORIES.find(c => c.value === row.category)?.label || row.category}</td>
                    <td style={{ padding: '10px 14px' }}>{row.reason}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{fmtDt(row.started_at)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{row.ended_at ? fmtDt(row.ended_at) : <span style={{ color: 'var(--warning)' }}>Open</span>}</td>
                    <td style={{ padding: '8px 14px' }}>
                      {canEdit && (
                        <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openEdit(row)}>Edit</button>
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
              <h3 className="card-title">{editing ? 'Edit downtime' : 'Log downtime'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-panel-scroll custom-scrollbar" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">Machine *</label>
                <select className="field-input" value={form.machine_id} onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))}>
                  <option value="">Select</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Category</label>
                <select className="field-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {DOWNTIME_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Reason *</label>
                <input className="field-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Start *</label>
                  <input type="datetime-local" className="field-input" value={form.started_at} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">End (optional)</label>
                  <input type="datetime-local" className="field-input" value={form.ended_at} onChange={e => setForm(f => ({ ...f, ended_at: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea className="field-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
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
