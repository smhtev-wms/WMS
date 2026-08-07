import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters, listMachinesBrief, listOperatorsBrief } from '../../lib/mastersLib'
import {
  listDprEntries,
  saveDprEntry,
  listJobCardsBrief,
  listJobOperationsForCard,
} from '../../lib/shopLib'
import { fmtDate } from '../../lib/shopConstants'
import { Loader2, Plus, ClipboardCheck, X, Save } from 'lucide-react'

const emptyForm = () => ({
  report_date: new Date().toISOString().slice(0, 10),
  job_card_id: '',
  job_operation_id: '',
  operator_id: '',
  machine_id: '',
  qty_produced: '',
  qty_rejected: '0',
  hours_spent: '',
  shift: '',
  notes: '',
})

export default function DprPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [machines, setMachines] = useState([])
  const [operators, setOperators] = useState([])
  const [jobOps, setJobOps] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = new Date()
      from.setDate(from.getDate() - 30)
      setRows(await listDprEntries({ from: from.toISOString().slice(0, 10) }))
    } catch (e) {
      toast(e.message || 'Failed to load DPR', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    listJobCardsBrief().then(setJobs).catch(() => setJobs([]))
    listMachinesBrief().then(setMachines).catch(() => setMachines([]))
    listOperatorsBrief().then(setOperators).catch(() => setOperators([]))
  }, [])

  async function onJobChange(jobId) {
    setForm(f => ({ ...f, job_card_id: jobId, job_operation_id: '' }))
    if (jobId) {
      try {
        setJobOps(await listJobOperationsForCard(jobId))
      } catch {
        setJobOps([])
      }
    } else setJobOps([])
  }

  function openNew() {
    setForm(emptyForm())
    setJobOps([])
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.job_card_id || !form.report_date) {
      toast('Date and job card are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveDprEntry(form)
      toast('DPR entry saved.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardCheck size={22} style={{ color: 'var(--primary)' }} /> Daily production report (DPR)
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Last 30 days of shop output by job and operation.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add entry</button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No DPR entries yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['Date', 'Job', 'Operation', 'Operator', 'Machine', 'Produced', 'Rejected', 'Hours'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.report_date)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.job?.job_number}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {row.job_operation ? `Op ${row.job_operation.op_seq}: ${row.job_operation.operation_name}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{row.operator?.full_name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.machine?.machine_code || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.qty_produced}</td>
                    <td style={{ padding: '10px 14px' }}>{row.qty_rejected}</td>
                    <td style={{ padding: '10px 14px' }}>{row.hours_spent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => !saving && setModalOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">DPR entry</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">Report date *</label>
                <input type="date" className="field-input" value={form.report_date} onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Job card *</label>
                <select className="field-input" value={form.job_card_id} onChange={e => onJobChange(e.target.value)}>
                  <option value="">Select</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.job_number}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Operation</label>
                <select className="field-input" value={form.job_operation_id} onChange={e => setForm(f => ({ ...f, job_operation_id: e.target.value }))}>
                  <option value="">—</option>
                  {jobOps.map(op => <option key={op.id} value={op.id}>Op {op.op_seq}: {op.operation_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Operator</label>
                  <select className="field-input" value={form.operator_id} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))}>
                    <option value="">—</option>
                    {operators.map(o => <option key={o.id} value={o.id}>{o.employee_code} — {o.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Machine</label>
                  <select className="field-input" value={form.machine_id} onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))}>
                    <option value="">—</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Qty produced</label>
                  <input type="number" className="field-input" value={form.qty_produced} onChange={e => setForm(f => ({ ...f, qty_produced: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Qty rejected</label>
                  <input type="number" className="field-input" value={form.qty_rejected} onChange={e => setForm(f => ({ ...f, qty_rejected: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Hours</label>
                  <input type="number" className="field-input" value={form.hours_spent} onChange={e => setForm(f => ({ ...f, hours_spent: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="field-label">Shift</label>
                <input className="field-input" placeholder="A / B / General" value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea className="field-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
