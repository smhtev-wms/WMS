import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listMachinesBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import {
  listMaintenancePlans,
  saveMaintenancePlan,
  setMaintenancePlanActive,
  listMaintenanceLogs,
  saveMaintenanceLog,
  suggestPlanCode,
} from '../../lib/maintenanceLib'
import { dueLabel, daysUntil } from '../../lib/phase3Constants'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, Settings, X, Save, Pencil, Power, ClipboardList } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyPlan = () => ({
  plan_code: '',
  machine_id: '',
  title: '',
  frequency_days: '90',
  last_done_date: '',
  next_due_date: '',
  notes: '',
})

const emptyLog = () => ({
  plan_id: '',
  machine_id: '',
  work_date: new Date().toISOString().slice(0, 10),
  work_done: '',
  downtime_hours: '',
  performed_by: '',
  notes: '',
})

export default function MaintenancePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('maintenance')
  const [plans, setPlans] = useState([])
  const [logs, setLogs] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [planModal, setPlanModal] = useState(false)
  const [logModal, setLogModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [planForm, setPlanForm] = useState(emptyPlan())
  const [logForm, setLogForm] = useState(emptyLog())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, l] = await Promise.all([listMaintenancePlans(), listMaintenanceLogs()])
      setPlans(p)
      setLogs(l)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listMachinesBrief().then(setMachines).catch(() => []) }, [])

  async function openNewPlan() {
    setEditingPlan(null)
    const code = await suggestPlanCode().catch(() => '')
    setPlanForm({ ...emptyPlan(), plan_code: code })
    setPlanModal(true)
  }

  function openEditPlan(row) {
    setEditingPlan(row.id)
    setPlanForm({
      plan_code: row.plan_code,
      machine_id: row.machine_id,
      title: row.title,
      frequency_days: String(row.frequency_days),
      last_done_date: row.last_done_date || '',
      next_due_date: row.next_due_date || '',
      notes: row.notes || '',
    })
    setPlanModal(true)
  }

  function openLog(plan) {
    setLogForm({
      ...emptyLog(),
      plan_id: plan?.id || '',
      machine_id: plan?.machine_id || '',
    })
    setLogModal(true)
  }

  async function savePlan() {
    if (!planForm.plan_code?.trim() || !planForm.machine_id || !planForm.title?.trim()) {
      toast('Plan code, machine, and title required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveMaintenancePlan(planForm, editingPlan)
      toast('Plan saved.', 'success')
      setPlanModal(false)
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function submitLog() {
    if (!logForm.machine_id || !logForm.work_done?.trim()) {
      toast('Machine and work description required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveMaintenanceLog(logForm)
      toast('PM logged.', 'success')
      setLogModal(false)
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function togglePlan(row) {
    try {
      await setMaintenancePlanActive(row.id, !row.is_active)
      await load()
    } catch (e) { toast(e.message, 'error') }
  }

  function dueCell(date) {
    const n = daysUntil(date)
    const color = n != null && n < 0 ? 'var(--danger)' : n != null && n <= 14 ? 'var(--warning)' : 'var(--text-2)'
    return <span style={{ color, fontSize: 12 }}>{dueLabel(date)}</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={22} style={{ color: 'var(--primary)' }} /> Preventive maintenance
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>PM schedules and completed work logs (separate from shop downtime).</p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => openLog(null)}><ClipboardList size={16} /> Log PM</button>
            <button type="button" className="btn btn-primary" onClick={openNewPlan}><Plus size={16} /> PM plan</button>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div className="card-header"><h3 className="card-title" style={{ fontSize: 14 }}>PM plans</h3></div>
        {loading ? <div style={{ padding: 32, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : plans.filter(p => p.is_active).length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>No active PM plans.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Plan', 'Machine', 'Task', 'Next due', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {plans.filter(p => p.is_active).map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p.plan_code}</td>
                  <td style={{ padding: '10px 14px' }}>{p.machine?.machine_code}</td>
                  <td style={{ padding: '10px 14px' }}>{p.title}</td>
                  <td style={{ padding: '10px 14px' }}>{dueCell(p.next_due_date)}</td>
                  <td style={{ padding: '8px 14px' }}>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => openLog(p)}>Log</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEditPlan(p)}><Pencil size={14} /></button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => togglePlan(p)}><Power size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header"><h3 className="card-title" style={{ fontSize: 14 }}>Recent PM logs</h3></div>
        {logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>No PM work logged yet.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Date', 'Machine', 'Work done', 'By'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {logs.slice(0, 20).map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(l.work_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{l.machine?.machine_code}</td>
                  <td style={{ padding: '10px 14px' }}>{l.work_done}</td>
                  <td style={{ padding: '10px 14px' }}>{l.performed_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AppModal open={planModal} onClose={() => !saving && setPlanModal(false)} panelStyle={{ maxWidth: 520 }}>
        <div className="card-header"><h3 className="card-title">{editingPlan ? 'Edit PM plan' : 'New PM plan'}</h3><button type="button" onClick={() => setPlanModal(false)}><X size={18} /></button></div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="field-input" placeholder="Plan code *" value={planForm.plan_code} onChange={e => setPlanForm(f => ({ ...f, plan_code: e.target.value }))} />
          <select className="field-input" value={planForm.machine_id} onChange={e => setPlanForm(f => ({ ...f, machine_id: e.target.value }))}>
            <option value="">Machine *</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.name}</option>)}
          </select>
          <input className="field-input" placeholder="Title / task *" value={planForm.title} onChange={e => setPlanForm(f => ({ ...f, title: e.target.value }))} />
          <input type="number" className="field-input" placeholder="Frequency (days) *" value={planForm.frequency_days} onChange={e => setPlanForm(f => ({ ...f, frequency_days: e.target.value }))} />
          <input type="date" className="field-input" value={planForm.last_done_date} onChange={e => setPlanForm(f => ({ ...f, last_done_date: e.target.value }))} />
          <input type="date" className="field-input" value={planForm.next_due_date} onChange={e => setPlanForm(f => ({ ...f, next_due_date: e.target.value }))} />
          <textarea className="field-input" rows={2} value={planForm.notes} onChange={e => setPlanForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="modal-panel-footer" style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setPlanModal(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={savePlan} disabled={saving}><Save size={14} /> Save</button>
        </div>
      </AppModal>

      <AppModal open={logModal} onClose={() => !saving && setLogModal(false)} panelStyle={{ maxWidth: 520 }}>
        <div className="card-header"><h3 className="card-title">Log PM work</h3><button type="button" onClick={() => setLogModal(false)}><X size={18} /></button></div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select className="field-input" value={logForm.plan_id} onChange={e => {
            const plan = plans.find(p => p.id === e.target.value)
            setLogForm(f => ({ ...f, plan_id: e.target.value, machine_id: plan?.machine_id || f.machine_id }))
          }}>
            <option value="">Link to plan (optional)</option>
            {plans.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.plan_code} — {p.title}</option>)}
          </select>
          <select className="field-input" value={logForm.machine_id} onChange={e => setLogForm(f => ({ ...f, machine_id: e.target.value }))}>
            <option value="">Machine *</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code}</option>)}
          </select>
          <input type="date" className="field-input" value={logForm.work_date} onChange={e => setLogForm(f => ({ ...f, work_date: e.target.value }))} />
          <textarea className="field-input" rows={3} placeholder="Work done *" value={logForm.work_done} onChange={e => setLogForm(f => ({ ...f, work_done: e.target.value }))} />
          <input className="field-input" placeholder="Downtime (hours)" value={logForm.downtime_hours} onChange={e => setLogForm(f => ({ ...f, downtime_hours: e.target.value }))} />
          <input className="field-input" placeholder="Performed by" value={logForm.performed_by} onChange={e => setLogForm(f => ({ ...f, performed_by: e.target.value }))} />
        </div>
        <div className="modal-panel-footer" style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setLogModal(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submitLog} disabled={saving}><Save size={14} /> Save</button>
        </div>
      </AppModal>
    </div>
  )
}
