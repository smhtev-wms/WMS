import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters } from '../../lib/mastersLib'
import { listJobCardsBrief, listJobOperationsForCard } from '../../lib/shopLib'
import { listInspections, saveInspection, suggestInspectionNo } from '../../lib/qualityLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, ClipboardCheck, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const RESULTS = [
  { value: 'pass', label: 'Pass', color: '#16a34a', bg: '#dcfce7' },
  { value: 'fail', label: 'Fail', color: '#dc2626', bg: '#fee2e2' },
  { value: 'conditional', label: 'Conditional', color: '#d97706', bg: '#ffedd5' },
]

const emptyForm = () => ({
  inspection_no: '',
  job_card_id: '',
  job_operation_id: '',
  inspection_date: new Date().toISOString().slice(0, 10),
  inspector_name: '',
  result: 'pass',
  qty_inspected: '',
  qty_accepted: '',
  qty_rejected: '0',
  notes: '',
})

export default function InspectionsPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)
  const [rows, setRows] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobOps, setJobOps] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listInspections()) } catch (e) { toast(e.message, 'error'); setRows([]) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listJobCardsBrief().then(setJobs).catch(() => []) }, [])

  async function onJobChange(jobId) {
    setForm(f => ({ ...f, job_card_id: jobId, job_operation_id: '' }))
    setJobOps(jobId ? await listJobOperationsForCard(jobId) : [])
  }

  async function openNew() {
    const no = await suggestInspectionNo().catch(() => '')
    setForm({ ...emptyForm(), inspection_no: no })
    setJobOps([])
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.inspection_no || !form.job_card_id) {
      toast('Inspection no. and job card required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveInspection(form)
      toast('Inspection saved.', 'success')
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
            <ClipboardCheck size={22} style={{ color: 'var(--primary)' }} /> Quality inspections
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>In-process and final inspection records.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> New inspection</button>}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No inspections yet.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                {['No.', 'Date', 'Job', 'Result', 'Inspected', 'Accepted', 'Rejected'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const m = RESULTS.find(x => x.value === r.result) || RESULTS[0]
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{r.inspection_no}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(r.inspection_date)}</td>
                    <td style={{ padding: '10px 14px' }}>{r.job?.job_number}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, color: m.color, background: m.bg, padding: '3px 8px', borderRadius: 6 }}>{m.label}</span></td>
                    <td style={{ padding: '10px 14px' }}>{r.qty_inspected}</td>
                    <td style={{ padding: '10px 14px' }}>{r.qty_accepted}</td>
                    <td style={{ padding: '10px 14px' }}>{r.qty_rejected}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 480 }}>
            <div className="card-header"><h3 className="card-title">New inspection</h3><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
            <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="field-input" placeholder="Inspection no." value={form.inspection_no} onChange={e => setForm(f => ({ ...f, inspection_no: e.target.value }))} />
              <select className="field-input" value={form.job_card_id} onChange={e => onJobChange(e.target.value)}>
                <option value="">Job card</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.job_number}</option>)}
              </select>
              <select className="field-input" value={form.job_operation_id} onChange={e => setForm(f => ({ ...f, job_operation_id: e.target.value }))}>
                <option value="">Operation (optional)</option>
                {jobOps.map(o => <option key={o.id} value={o.id}>Op {o.op_seq}: {o.operation_name}</option>)}
              </select>
              <input type="date" className="field-input" value={form.inspection_date} onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))} />
              <input className="field-input" placeholder="Inspector" value={form.inspector_name} onChange={e => setForm(f => ({ ...f, inspector_name: e.target.value }))} />
              <select className="field-input" value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
                {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input type="number" className="field-input" placeholder="Inspected" value={form.qty_inspected} onChange={e => setForm(f => ({ ...f, qty_inspected: e.target.value }))} />
                <input type="number" className="field-input" placeholder="Accepted" value={form.qty_accepted} onChange={e => setForm(f => ({ ...f, qty_accepted: e.target.value }))} />
                <input type="number" className="field-input" placeholder="Rejected" value={form.qty_rejected} onChange={e => setForm(f => ({ ...f, qty_rejected: e.target.value }))} />
              </div>
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
