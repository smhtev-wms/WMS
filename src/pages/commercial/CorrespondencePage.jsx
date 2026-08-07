import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listCustomersBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listCorrespondence, saveCorrespondence, suggestCorrNo, listPoBriefForCorr } from '../../lib/correspondenceLib'
import { CORR_CHANNELS, CORR_DIRECTIONS, CORR_STATUSES, statusMeta, dueLabel, daysUntil } from '../../lib/phase3Constants'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, Mail, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  corr_no: '',
  direction: 'outbound',
  customer_id: '',
  po_id: '',
  subject: '',
  corr_date: new Date().toISOString().slice(0, 10),
  reference_no: '',
  channel: 'letter',
  summary: '',
  follow_up_date: '',
  status: 'open',
})

export default function CorrespondencePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('commercial')
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listCorrespondence()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    listCustomersBrief().then(setCustomers).catch(() => [])
    listPoBriefForCorr().then(setPos).catch(() => [])
  }, [])

  async function openNew() {
    setEditing(null)
    const no = await suggestCorrNo().catch(() => '')
    setForm({ ...emptyForm(), corr_no: no })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      corr_no: row.corr_no,
      direction: row.direction,
      customer_id: row.customer_id || '',
      po_id: row.po_id || '',
      subject: row.subject,
      corr_date: row.corr_date,
      reference_no: row.reference_no || '',
      channel: row.channel,
      summary: row.summary || '',
      follow_up_date: row.follow_up_date || '',
      status: row.status,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.corr_no?.trim() || !form.subject?.trim()) {
      toast('Correspondence no. and subject required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveCorrespondence(form, editing)
      toast('Saved.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  function followCell(row) {
    if (!row.follow_up_date || row.status === 'closed') return '—'
    const n = daysUntil(row.follow_up_date)
    const color = n != null && n < 0 ? 'var(--danger)' : n != null && n <= 7 ? 'var(--warning)' : 'var(--text-2)'
    return <span style={{ color, fontSize: 12 }}>{dueLabel(row.follow_up_date, { overdueLabel: 'Follow-up overdue' })}</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={22} style={{ color: 'var(--primary)' }} /> Correspondence
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Letters, emails, and portal messages with customers.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Log entry</button>}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No correspondence logged.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['No.', 'Date', 'Dir.', 'Subject', 'Customer', 'PO', 'Follow-up', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const st = statusMeta(CORR_STATUSES, r.status)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.corr_no}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(r.corr_date)}</td>
                    <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{r.direction}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.subject}
                      <div><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span></div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{r.customer?.customer_code || '—'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{r.po?.po_number || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{followCell(r)}</td>
                    <td style={{ padding: '8px 14px' }}>{canEdit && <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => openEdit(r)}>Edit</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 520 }}>
        <div className="card-header"><h3 className="card-title">{editing ? 'Edit entry' : 'New correspondence'}</h3><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="field-input" placeholder="Correspondence no. *" value={form.corr_no} onChange={e => setForm(f => ({ ...f, corr_no: e.target.value }))} />
          <select className="field-input" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
            {CORR_DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <input className="field-input" placeholder="Subject *" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
          <select className="field-input" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
            <option value="">Customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
          </select>
          <select className="field-input" value={form.po_id} onChange={e => setForm(f => ({ ...f, po_id: e.target.value }))}>
            <option value="">PO (optional)</option>
            {pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="date" className="field-input" value={form.corr_date} onChange={e => setForm(f => ({ ...f, corr_date: e.target.value }))} />
            <input type="date" className="field-input" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} />
          </div>
          <select className="field-input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            {CORR_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input className="field-input" placeholder="Their ref / letter no." value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} />
          <textarea className="field-input" rows={3} placeholder="Summary" value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
          <select className="field-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {CORR_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="modal-panel-footer" style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={14} /> Save</button>
        </div>
      </AppModal>
    </div>
  )
}
