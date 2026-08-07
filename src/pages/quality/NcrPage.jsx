import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listJobCardsBrief } from '../../lib/shopLib'
import { listNcr, saveNcr, suggestNcrNo } from '../../lib/qualityLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, AlertTriangle, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const DISPOSITIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'rework', label: 'Rework' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'use_as_is', label: 'Use as-is' },
  { value: 'return_vendor', label: 'Return to vendor' },
]

const emptyForm = () => ({
  ncr_no: '',
  job_card_id: '',
  raised_date: new Date().toISOString().slice(0, 10),
  description: '',
  disposition: 'pending',
  status: 'open',
  notes: '',
})

export default function NcrPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('quality')
  const [rows, setRows] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listNcr()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listJobCardsBrief().then(setJobs).catch(() => []) }, [])

  async function openNew() {
    setEditing(null)
    const no = await suggestNcrNo().catch(() => '')
    setForm({ ...emptyForm(), ncr_no: no })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      ncr_no: row.ncr_no,
      job_card_id: row.job_card_id,
      raised_date: row.raised_date,
      description: row.description,
      disposition: row.disposition,
      status: row.status,
      notes: row.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.ncr_no || !form.job_card_id || !form.description?.trim()) {
      toast('NCR no., job, and description required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveNcr(form, editing)
      toast('NCR saved.', 'success')
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
            <AlertTriangle size={22} style={{ color: 'var(--primary)' }} /> Non-conformance (NCR)
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Track quality issues and disposition.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Raise NCR</button>}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No NCRs yet.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['NCR no.', 'Date', 'Job', 'Disposition', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.ncr_no}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.raised_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{r.job?.job_number}</td>
                  <td style={{ padding: '10px 14px' }}>{DISPOSITIONS.find(d => d.value === r.disposition)?.label || r.disposition}</td>
                  <td style={{ padding: '10px 14px' }}>{r.status}</td>
                  <td style={{ padding: '8px 14px' }}>{canEdit && <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => openEdit(r)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 480 }}>
            <div className="card-header"><h3 className="card-title">{editing ? 'Edit NCR' : 'Raise NCR'}</h3><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
            <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="field-input" value={form.ncr_no} onChange={e => setForm(f => ({ ...f, ncr_no: e.target.value }))} />
              <select className="field-input" value={form.job_card_id} onChange={e => setForm(f => ({ ...f, job_card_id: e.target.value }))}>
                <option value="">Job card</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.job_number}</option>)}
              </select>
              <input type="date" className="field-input" value={form.raised_date} onChange={e => setForm(f => ({ ...f, raised_date: e.target.value }))} />
              <textarea className="field-input" rows={3} placeholder="Description *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <select className="field-input" value={form.disposition} onChange={e => setForm(f => ({ ...f, disposition: e.target.value }))}>
                {DISPOSITIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select className="field-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
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
