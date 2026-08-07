import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters, listCustomersBrief } from '../../lib/mastersLib'
import { listEnquiries, saveEnquiry, suggestEnquiryNo } from '../../lib/ordersLib'
import { ENQUIRY_STATUSES, statusMeta, fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, Pencil, Search, X, Save, MessageSquare } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = {
  enquiry_no: '',
  customer_id: '',
  enquiry_date: new Date().toISOString().slice(0, 10),
  response_due: '',
  status: 'open',
  subject: '',
  reference: '',
  notes: '',
}

export default function EnquiriesPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)

  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listEnquiries())
    } catch (e) {
      toast(e.message || 'Failed to load enquiries', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listCustomersBrief().then(setCustomers).catch(() => []) }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.enquiry_no, r.subject, r.reference, r.customer?.name, r.customer?.customer_code]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  async function openNew() {
    setEditing(null)
    let no = ''
    try { no = await suggestEnquiryNo() } catch { /* manual */ }
    setForm({ ...emptyForm, enquiry_no: no })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      enquiry_no: row.enquiry_no,
      customer_id: row.customer_id,
      enquiry_date: row.enquiry_date,
      response_due: row.response_due || '',
      status: row.status,
      subject: row.subject,
      reference: row.reference || '',
      notes: row.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.enquiry_no?.trim() || !form.customer_id || !form.subject?.trim()) {
      toast('Enquiry no., customer, and subject are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        response_due: form.response_due || null,
        reference: form.reference || null,
        notes: form.notes || null,
      }
      await saveEnquiry(payload, editing)
      toast(editing ? 'Enquiry updated.' : 'Enquiry created.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function StatusBadge({ status }) {
    const m = statusMeta(ENQUIRY_STATUSES, status)
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>
        {m.label}
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={22} style={{ color: 'var(--primary)' }} /> Enquiries / RFQ
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Track customer enquiries before PO release.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New enquiry
          </button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-3)' }} />
        <input className="field-input" style={{ flex: 1 }} placeholder="Search enquiry no., subject, customer…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} shown</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No enquiries yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--table-border)' }}>
                  {['Enquiry no.', 'Date', 'Customer', 'Subject', 'Due', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.enquiry_no}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.enquiry_date)}</td>
                    <td style={{ padding: '10px 14px' }}>{row.customer?.name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.subject}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.response_due)}</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: '8px 14px' }}>
                      {canEdit && (
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEdit(row)}><Pencil size={14} /></button>
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
              <h3 className="card-title">{editing ? 'Edit enquiry' : 'New enquiry'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-panel-scroll custom-scrollbar" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">Enquiry no. *</label>
                <input className="field-input" value={form.enquiry_no} onChange={e => setForm(f => ({ ...f, enquiry_no: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Customer *</label>
                <select className="field-input" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Enquiry date</label>
                  <input type="date" className="field-input" value={form.enquiry_date} onChange={e => setForm(f => ({ ...f, enquiry_date: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Response due</label>
                  <input type="date" className="field-input" value={form.response_due} onChange={e => setForm(f => ({ ...f, response_due: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="field-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {ENQUIRY_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Subject *</label>
                <input className="field-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Customer reference</label>
                <input className="field-input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea className="field-input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
