import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listCustomersBrief, listItemsBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import {
  getPurchaseOrder,
  savePurchaseOrder,
  suggestPoNumber,
  listOpenEnquiries,
  uploadPoAttachment,
  deletePoAttachment,
  downloadPoAttachment,
  isUuid,
} from '../../lib/ordersLib'
import { PO_STATUSES } from '../../lib/orderConstants'
import { Loader2, Save, ArrowLeft, Plus, Trash2, Paperclip, History } from 'lucide-react'

const emptyLine = () => ({
  line_no: 1,
  item_id: '',
  description: '',
  drawing_number: '',
  revision: '',
  qty: 1,
  uom: 'NOS',
  unit_rate: '',
  line_delivery: '',
  notes: '',
})

const emptyHeader = () => ({
  po_number: '',
  customer_id: '',
  enquiry_id: '',
  customer_po_ref: '',
  po_date: new Date().toISOString().slice(0, 10),
  delivery_date: '',
  status: 'draft',
  currency: 'INR',
  notes: '',
})

export default function PurchaseOrderFormPage() {
  const { id } = useParams()
  const location = useLocation()
  // `/orders/purchase-orders/new` is a static route — no `:id` param, so id is undefined there.
  const isNew = location.pathname.endsWith('/purchase-orders/new') || id === 'new'
  const hasValidId = isUuid(id)
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('orders')

  const [loading, setLoading] = useState(!isNew && hasValidId)
  const [header, setHeader] = useState(emptyHeader())
  const [lines, setLines] = useState([emptyLine()])
  const [attachments, setAttachments] = useState([])
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [saving, setSaving] = useState(false)
  const [amendmentReason, setAmendmentReason] = useState('')
  const [uploading, setUploading] = useState(false)

  const loadRefs = useCallback(async () => {
    const [c, i, e] = await Promise.all([
      listCustomersBrief(),
      listItemsBrief(),
      listOpenEnquiries(),
    ])
    setCustomers(c)
    setItems(i)
    setEnquiries(e)
  }, [])

  const loadPo = useCallback(async () => {
    if (isNew) return
    if (!id || !hasValidId) {
      navigate('/orders/purchase-orders', { replace: true })
      return
    }
    setLoading(true)
    try {
      const po = await getPurchaseOrder(id)
      setHeader({
        po_number: po.po_number,
        customer_id: po.customer_id,
        enquiry_id: po.enquiry_id || '',
        customer_po_ref: po.customer_po_ref || '',
        po_date: po.po_date,
        delivery_date: po.delivery_date || '',
        status: po.status,
        currency: po.currency || 'INR',
        notes: po.notes || '',
      })
      setLines(po.lines?.length ? po.lines.map(l => ({
        line_no: l.line_no,
        item_id: l.item_id || '',
        description: l.description,
        drawing_number: l.drawing_number || '',
        revision: l.revision || '',
        qty: l.qty,
        uom: l.uom,
        unit_rate: l.unit_rate ?? '',
        line_delivery: l.line_delivery || '',
        notes: l.notes || '',
      })) : [emptyLine()])
      setAttachments(po.attachments || [])
    } catch (e) {
      toast(e.message || 'Failed to load PO', 'error')
      navigate('/orders/purchase-orders')
    } finally {
      setLoading(false)
    }
  }, [id, isNew, hasValidId, navigate, toast])

  useEffect(() => { loadRefs() }, [loadRefs])
  useEffect(() => { loadPo() }, [loadPo])

  useEffect(() => {
    if (!isNew) return
    suggestPoNumber().then(no => setHeader(h => h.po_number ? h : { ...h, po_number: no })).catch(() => {})
  }, [isNew])

  function setLine(idx, patch) {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function onItemPick(idx, itemId) {
    const item = items.find(x => x.id === itemId)
    if (!item) {
      setLine(idx, { item_id: itemId })
      return
    }
    setLine(idx, {
      item_id: itemId,
      description: item.description || item.item_code,
      drawing_number: item.drawing_number || '',
      uom: item.uom || 'NOS',
    })
  }

  function addLine() {
    setLines(prev => [...prev, { ...emptyLine(), line_no: prev.length + 1 }])
  }

  function removeLine(idx) {
    setLines(prev => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_no: i + 1 })))
  }

  async function handleSave() {
    if (!canEdit) return
    if (!header.po_number?.trim() || !header.customer_id) {
      toast('PO number and customer are required.', 'error')
      return
    }
    if (!lines.length || lines.some(l => !String(l.description).trim())) {
      toast('Each line needs a description.', 'error')
      return
    }
    if (!isNew && !amendmentReason.trim()) {
      toast('Enter an amendment reason before saving changes to an existing PO.', 'error')
      return
    }
    setSaving(true)
    try {
      const poId = await savePurchaseOrder(
        {
          header: {
            ...header,
            enquiry_id: header.enquiry_id || null,
          },
          lines,
        },
        {
          id: isNew ? null : id,
          userId: user?.id,
          amendmentReason: isNew ? null : amendmentReason,
        },
      )
      toast(isNew ? 'PO created.' : 'PO updated.', 'success')
      if (isNew) navigate(`/orders/purchase-orders/${poId}`, { replace: true })
      else {
        setAmendmentReason('')
        await loadPo()
      }
    } catch (e) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || isNew) {
      if (isNew) toast('Save the PO first, then upload attachments.', 'error')
      return
    }
    setUploading(true)
    try {
      const row = await uploadPoAttachment(id, file, user?.id)
      setAttachments(prev => [row, ...prev])
      toast('File uploaded.', 'success')
    } catch (err) {
      toast(err.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function onDeleteAttachment(row) {
    if (!window.confirm(`Delete ${row.file_name}?`)) return
    try {
      await deletePoAttachment(row)
      setAttachments(prev => prev.filter(a => a.id !== row.id))
      toast('Attachment removed.', 'success')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  async function onDownload(row) {
    try {
      const url = await downloadPoAttachment(row)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
        <Loader2 size={20} className="animate-spin" /> Loading PO…
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/orders/purchase-orders')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, flex: 1 }}>
          {isNew ? 'New purchase order' : header.po_number}
        </h1>
        {!isNew && (
          <Link to={`/orders/purchase-orders/${id}/amendments`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            <History size={16} /> Amendments
          </Link>
        )}
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>Header</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label className="field-label">PO number *</label>
            <input className="field-input" disabled={!canEdit} value={header.po_number} onChange={e => setHeader(h => ({ ...h, po_number: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Customer *</label>
            <select className="field-input" disabled={!canEdit} value={header.customer_id} onChange={e => setHeader(h => ({ ...h, customer_id: e.target.value }))}>
              <option value="">Select</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Linked enquiry</label>
            <select className="field-input" disabled={!canEdit} value={header.enquiry_id} onChange={e => setHeader(h => ({ ...h, enquiry_id: e.target.value }))}>
              <option value="">None</option>
              {enquiries.map(en => <option key={en.id} value={en.id}>{en.enquiry_no} — {en.subject}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer PO ref</label>
            <input className="field-input" disabled={!canEdit} value={header.customer_po_ref} onChange={e => setHeader(h => ({ ...h, customer_po_ref: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">PO date</label>
            <input type="date" className="field-input" disabled={!canEdit} value={header.po_date} onChange={e => setHeader(h => ({ ...h, po_date: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Delivery date</label>
            <input type="date" className="field-input" disabled={!canEdit} value={header.delivery_date} onChange={e => setHeader(h => ({ ...h, delivery_date: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" disabled={!canEdit} value={header.status} onChange={e => setHeader(h => ({ ...h, status: e.target.value }))}>
              {PO_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="field-label">Notes</label>
          <textarea className="field-input" rows={2} disabled={!canEdit} value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} />
        </div>
        {!isNew && canEdit && (
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Amendment reason (required when saving changes)</label>
            <input className="field-input" placeholder="e.g. Qty revision per customer mail dated …" value={amendmentReason} onChange={e => setAmendmentReason(e.target.value)} />
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--table-border)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Line items</h3>
          {canEdit && (
            <button type="button" className="btn btn-secondary" onClick={addLine}><Plus size={14} /> Add line</button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                {['#', 'Item', 'Description', 'Drawing', 'Rev', 'Qty', 'UOM', 'Rate', 'Line del.', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: 8 }}>{line.line_no}</td>
                  <td style={{ padding: 8, minWidth: 140 }}>
                    <select className="field-input" style={{ fontSize: 12 }} disabled={!canEdit} value={line.item_id} onChange={e => onItemPick(idx, e.target.value)}>
                      <option value="">—</option>
                      {items.map(it => <option key={it.id} value={it.id}>{it.item_code}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 8, minWidth: 160 }}>
                    <input className="field-input" style={{ fontSize: 12 }} disabled={!canEdit} value={line.description} onChange={e => setLine(idx, { description: e.target.value })} />
                  </td>
                  <td style={{ padding: 8 }}><input className="field-input" style={{ fontSize: 12, width: 90 }} disabled={!canEdit} value={line.drawing_number} onChange={e => setLine(idx, { drawing_number: e.target.value })} /></td>
                  <td style={{ padding: 8 }}><input className="field-input" style={{ fontSize: 12, width: 56 }} disabled={!canEdit} value={line.revision} onChange={e => setLine(idx, { revision: e.target.value })} /></td>
                  <td style={{ padding: 8 }}><input type="number" className="field-input" style={{ fontSize: 12, width: 72 }} disabled={!canEdit} value={line.qty} onChange={e => setLine(idx, { qty: e.target.value })} /></td>
                  <td style={{ padding: 8 }}><input className="field-input" style={{ fontSize: 12, width: 64 }} disabled={!canEdit} value={line.uom} onChange={e => setLine(idx, { uom: e.target.value })} /></td>
                  <td style={{ padding: 8 }}><input type="number" className="field-input" style={{ fontSize: 12, width: 88 }} disabled={!canEdit} value={line.unit_rate} onChange={e => setLine(idx, { unit_rate: e.target.value })} /></td>
                  <td style={{ padding: 8 }}><input type="date" className="field-input" style={{ fontSize: 12 }} disabled={!canEdit} value={line.line_delivery} onChange={e => setLine(idx, { line_delivery: e.target.value })} /></td>
                  <td style={{ padding: 8 }}>
                    {canEdit && lines.length > 1 && (
                      <button type="button" className="btn btn-secondary" style={{ padding: 4 }} onClick={() => removeLine(idx)}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Paperclip size={16} /> Drawings &amp; specs
          </h3>
          {canEdit && (
            <label className="btn btn-secondary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Uploading…' : 'Upload file'}
              <input type="file" style={{ display: 'none' }} onChange={onFileChange} disabled={uploading || isNew} />
            </label>
          )}
        </div>
        {isNew ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Save the PO first to attach files.</p>
        ) : attachments.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>No attachments yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {attachments.map(a => (
              <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--table-border)', fontSize: 13 }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => onDownload(a)}>{a.file_name}</button>
                {canEdit && (
                  <button type="button" className="btn btn-secondary" style={{ padding: 4 }} onClick={() => onDeleteAttachment(a)}><Trash2 size={14} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
