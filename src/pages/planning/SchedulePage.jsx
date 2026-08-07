import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters, listMachinesBrief } from '../../lib/mastersLib'
import {
  listScheduleEntries,
  saveScheduleEntry,
  deleteScheduleEntry,
  listPoLinesForPlanning,
  listRouteOperationsForItem,
} from '../../lib/planningLib'
import { SCHEDULE_STATUSES, statusMeta, fmtDateTime, toLocalInputValue, fromLocalInputValue } from '../../lib/planningConstants'
import { Loader2, Plus, Calendar, X, Save, Trash2 } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  machine_id: '',
  po_line_id: '',
  route_operation_id: '',
  planned_start: '',
  planned_end: '',
  status: 'planned',
  notes: '',
})

export default function SchedulePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)

  const [machines, setMachines] = useState([])
  const [machineFilter, setMachineFilter] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [poLines, setPoLines] = useState([])
  const [routeOps, setRouteOps] = useState([])
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 14)
    return { from: start.toISOString(), to: end.toISOString() }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listScheduleEntries({
        machineId: machineFilter || undefined,
        from: range.from,
        to: range.to,
      }))
    } catch (e) {
      toast(e.message || 'Failed to load schedule', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [machineFilter, range.from, range.to, toast])

  useEffect(() => {
    listMachinesBrief().then(setMachines).catch(() => setMachines([]))
    listPoLinesForPlanning().then(setPoLines).catch(() => setPoLines([]))
  }, [])

  useEffect(() => { load() }, [load])

  async function onPoLineChange(poLineId) {
    setForm(f => ({ ...f, po_line_id: poLineId, route_operation_id: '' }))
    const line = poLines.find(l => l.id === poLineId)
    if (line?.item_id) {
      try {
        setRouteOps(await listRouteOperationsForItem(line.item_id))
      } catch {
        setRouteOps([])
      }
    } else setRouteOps([])
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm(), machine_id: machineFilter || '' })
    setRouteOps([])
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      machine_id: row.machine_id,
      po_line_id: row.po_line_id,
      route_operation_id: row.route_operation_id || '',
      planned_start: toLocalInputValue(row.planned_start),
      planned_end: toLocalInputValue(row.planned_end),
      status: row.status,
      notes: row.notes || '',
    })
    onPoLineChange(row.po_line_id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.machine_id || !form.po_line_id || !form.planned_start || !form.planned_end) {
      toast('Machine, PO line, and start/end times are required.', 'error')
      return
    }
    const planned_start = fromLocalInputValue(form.planned_start)
    const planned_end = fromLocalInputValue(form.planned_end)
    if (!planned_start || !planned_end || planned_end <= planned_start) {
      toast('End time must be after start time.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveScheduleEntry({ ...form, planned_start, planned_end }, editing)
      toast(editing ? 'Schedule updated.' : 'Scheduled.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!window.confirm('Remove this schedule slot?')) return
    try {
      await deleteScheduleEntry(row.id)
      toast('Removed.', 'success')
      await load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  function StatusBadge({ status }) {
    const m = statusMeta(SCHEDULE_STATUSES, status)
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>{m.label}</span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={22} style={{ color: 'var(--primary)' }} /> Machine schedule
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Next 14 days — assign PO lines to machines.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Schedule slot</button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14 }}>
        <label className="field-label">Machine</label>
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
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No slots in the next 14 days.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['Machine', 'PO / line', 'Operation', 'Start', 'End', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px' }}>{row.machine?.machine_code || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {row.po?.po_number} / L{row.po_line?.line_no}
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.po_line?.description}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{row.route_operation ? `Op ${row.route_operation.op_seq}: ${row.route_operation.operation_name}` : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{fmtDateTime(row.planned_start)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{fmtDateTime(row.planned_end)}</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: '8px 14px' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEdit(row)}>Edit</button>
                          <button type="button" className="btn btn-secondary" style={{ padding: 6 }} onClick={() => handleDelete(row)}><Trash2 size={14} /></button>
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
              <h3 className="card-title">{editing ? 'Edit schedule' : 'New schedule slot'}</h3>
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
                <label className="field-label">PO line *</label>
                <select className="field-input" value={form.po_line_id} onChange={e => onPoLineChange(e.target.value)}>
                  <option value="">Select</option>
                  {poLines.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Route operation (optional)</label>
                <select className="field-input" value={form.route_operation_id} onChange={e => setForm(f => ({ ...f, route_operation_id: e.target.value }))}>
                  <option value="">—</option>
                  {routeOps.map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Start *</label>
                  <input type="datetime-local" className="field-input" value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">End *</label>
                  <input type="datetime-local" className="field-input" value={form.planned_end} onChange={e => setForm(f => ({ ...f, planned_end: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="field-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {SCHEDULE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
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
