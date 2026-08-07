import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listCustomersBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listReceivables, saveReceivable, suggestInvoiceNo, receivablesAgeingSummary, RECEIVABLE_STATUSES } from '../../lib/receivablesLib'
import { statusMeta, dueLabel, daysUntil } from '../../lib/phase3Constants'
import { fmtAmt } from '../../lib/orderConstants'
import { Loader2, Plus, CreditCard, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  invoice_no: '',
  customer_id: '',
  po_id: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  gross_amount: '',
  amount_received: '0',
  status: 'open',
  notes: '',
})

export default function ReceivablesPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('insights')
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listReceivables()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listCustomersBrief().then(setCustomers).catch(() => []) }, [])

  const ageing = receivablesAgeingSummary(rows)

  async function openNew() {
    setEditing(null)
    const no = await suggestInvoiceNo().catch(() => '')
    const due = new Date()
    due.setDate(due.getDate() + 30)
    setForm({ ...emptyForm(), invoice_no: no, due_date: due.toISOString().slice(0, 10) })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      invoice_no: row.invoice_no,
      customer_id: row.customer_id,
      po_id: row.po_id || '',
      invoice_date: row.invoice_date,
      due_date: row.due_date,
      gross_amount: row.gross_amount,
      amount_received: row.amount_received,
      status: row.status,
      notes: row.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.invoice_no?.trim() || !form.customer_id || !form.due_date || form.gross_amount === '') {
      toast('Invoice no., customer, due date, and amount required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveReceivable(form, editing)
      toast('Saved.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  function dueCell(row) {
    if (row.status === 'paid' || row.status === 'written_off') return '—'
    const n = daysUntil(row.due_date)
    const color = n != null && n < 0 ? 'var(--danger)' : n != null && n <= 30 ? 'var(--warning)' : 'var(--text-2)'
    return <span style={{ color, fontSize: 12 }}>{dueLabel(row.due_date)}</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={22} style={{ color: 'var(--primary)' }} /> Payment ageing
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Customer invoices and outstanding balances.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add invoice</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total outstanding', value: fmtAmt(ageing.total_outstanding) },
          { label: 'Overdue', value: fmtAmt(ageing.overdue), warn: ageing.overdue > 0 },
          { label: 'Due ≤ 30 days', value: fmtAmt(ageing.current) },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.warn ? 'var(--danger)' : 'var(--primary)' }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No receivables recorded.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Invoice', 'Customer', 'Due', 'Gross', 'Received', 'Outstanding', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const st = statusMeta(RECEIVABLE_STATUSES, r.status)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.invoice_no}</td>
                    <td style={{ padding: '10px 14px' }}>{r.customer?.customer_code}</td>
                    <td style={{ padding: '10px 14px' }}>{dueCell(r)}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtAmt(r.gross_amount)}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtAmt(r.amount_received)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{fmtAmt(r.outstanding)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '8px 14px' }}>{canEdit && <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => openEdit(r)}>Edit</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 520 }}>
        <div className="card-header"><h3 className="card-title">{editing ? 'Edit invoice' : 'New invoice'}</h3><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="field-input" placeholder="Invoice no. *" value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} />
          <select className="field-input" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
            <option value="">Customer *</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="date" className="field-input" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
            <input type="date" className="field-input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <input type="number" className="field-input" placeholder="Gross amount *" value={form.gross_amount} onChange={e => setForm(f => ({ ...f, gross_amount: e.target.value }))} />
          <input type="number" className="field-input" placeholder="Amount received" value={form.amount_received} onChange={e => setForm(f => ({ ...f, amount_received: e.target.value }))} />
          <select className="field-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {RECEIVABLE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
