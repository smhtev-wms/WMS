import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listOperatorsBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listAttendance, saveAttendance, ATTENDANCE_STATUSES } from '../../lib/hrLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, UserCheck, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  operator_id: '',
  work_date: new Date().toISOString().slice(0, 10),
  status: 'present',
  hours_worked: '8',
  notes: '',
})

export default function AttendancePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('hr')
  const [rows, setRows] = useState([])
  const [operators, setOperators] = useState([])
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listAttendance(fromDate, toDate)) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast, fromDate, toDate])

  useEffect(() => { load() }, [load])
  useEffect(() => { listOperatorsBrief().then(setOperators).catch(() => []) }, [])

  function openNew() {
    setForm(emptyForm())
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.operator_id || !form.work_date) {
      toast('Operator and date required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveAttendance(form)
      toast('Attendance saved.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCheck size={22} style={{ color: 'var(--primary)' }} /> Attendance
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Daily operator presence (HR-lite). Set hourly rate on Operators master for job costing.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Mark attendance</button>}
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div>
          <label className="field-label">From</label>
          <input type="date" className="field-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" className="field-input" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No attendance in range.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Date', 'Operator', 'Status', 'Hours', 'Notes'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.work_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{r.operator?.employee_code} — {r.operator?.full_name}</td>
                  <td style={{ padding: '10px 14px' }}>{ATTENDANCE_STATUSES.find(s => s.value === r.status)?.label || r.status}</td>
                  <td style={{ padding: '10px 14px' }}>{r.hours_worked}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-3)' }}>{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 480 }}>
        <div className="card-header"><h3 className="card-title">Mark attendance</h3><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select className="field-input" value={form.operator_id} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))}>
            <option value="">Operator *</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.employee_code} — {o.full_name}</option>)}
          </select>
          <input type="date" className="field-input" value={form.work_date} onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} />
          <select className="field-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {ATTENDANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" className="field-input" placeholder="Hours worked" value={form.hours_worked} onChange={e => setForm(f => ({ ...f, hours_worked: e.target.value }))} />
          <textarea className="field-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="modal-panel-footer" style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={14} /> Save</button>
        </div>
      </AppModal>
    </div>
  )
}
