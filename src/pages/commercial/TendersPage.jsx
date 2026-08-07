import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listCustomersBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listTenders, saveTender, suggestTenderNo } from '../../lib/tendersLib'
import { TENDER_STATUSES, statusMeta, dueLabel, daysUntil } from '../../lib/phase3Constants'
import { fmtDate, fmtAmt } from '../../lib/orderConstants'
import { Loader2, Plus, Megaphone, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  tender_no: '',
  title: '',
  customer_id: '',
  portal_ref: '',
  published_date: '',
  submission_due: '',
  status: 'open',
  estimated_value: '',
  notes: '',
})

export default function TendersPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('commercial')
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listTenders()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listCustomersBrief().then(setCustomers).catch(() => []) }, [])

  async function openNew() {
    setEditing(null)
    const no = await suggestTenderNo().catch(() => '')
    setForm({ ...emptyForm(), tender_no: no, submission_due: new Date().toISOString().slice(0, 10) })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      tender_no: row.tender_no,
      title: row.title,
      customer_id: row.customer_id || '',
      portal_ref: row.portal_ref || '',
      published_date: row.published_date || '',
      submission_due: row.submission_due,
      status: row.status,
      estimated_value: row.estimated_value ?? '',
      notes: row.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.tender_no?.trim() || !form.title?.trim() || !form.submission_due) {
      toast('Tender no., title, and submission due are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveTender(form, editing)
      toast('Saved.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  function dueCell(row) {
    if (!['open', 'submitted'].includes(row.status)) return fmtDate(row.submission_due)
    const n = daysUntil(row.submission_due)
    const color = n != null && n < 0 ? 'var(--danger)' : n != null && n <= 14 ? 'var(--warning)' : 'var(--text-2)'
    return <span style={{ color }}>{dueLabel(row.submission_due)}</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Megaphone size={22} style={{ color: 'var(--primary)' }} /> Tender alerts
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>BHEL / GEM tenders and submission deadlines.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add tender</button>}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No tenders logged.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Tender no.', 'Title', 'Customer', 'Submit by', 'Status', 'Value', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const st = statusMeta(TENDER_STATUSES, r.status)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.tender_no}</td>
                    <td style={{ padding: '10px 14px' }}>{r.title}</td>
                    <td style={{ padding: '10px 14px' }}>{r.customer?.customer_code || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{dueCell(r)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{fmtAmt(r.estimated_value)}</td>
                    <td style={{ padding: '8px 14px' }}>{canEdit && <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => openEdit(r)}>Edit</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 520 }}>
        <div className="card-header"><h3 className="card-title">{editing ? 'Edit tender' : 'New tender'}</h3><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="field-input" placeholder="Tender no. *" value={form.tender_no} onChange={e => setForm(f => ({ ...f, tender_no: e.target.value }))} />
          <input className="field-input" placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <select className="field-input" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
            <option value="">Customer (optional)</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
          </select>
          <input className="field-input" placeholder="Portal / GEM ref" value={form.portal_ref} onChange={e => setForm(f => ({ ...f, portal_ref: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="date" className="field-input" value={form.published_date} onChange={e => setForm(f => ({ ...f, published_date: e.target.value }))} />
            <input type="date" className="field-input" value={form.submission_due} onChange={e => setForm(f => ({ ...f, submission_due: e.target.value }))} />
          </div>
          <select className="field-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {TENDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" className="field-input" placeholder="Estimated value (₹)" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} />
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
