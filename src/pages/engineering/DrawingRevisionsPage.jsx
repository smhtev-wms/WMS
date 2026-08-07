import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters, listItemsBrief } from '../../lib/mastersLib'
import { listDrawingRevisions, saveDrawingRevision } from '../../lib/engineeringLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, FileDiff, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  item_id: '',
  previous_revision: '',
  new_revision: '',
  effective_date: new Date().toISOString().slice(0, 10),
  change_reason: '',
  customer_ref: '',
  apply_to_item: true,
})

export default function DrawingRevisionsPage() {
  const { profile, user } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)
  const [rows, setRows] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listDrawingRevisions()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listItemsBrief().then(setItems).catch(() => []) }, [])

  function onItemPick(itemId) {
    const item = items.find(i => i.id === itemId)
    setForm(f => ({
      ...f,
      item_id: itemId,
      previous_revision: item?.revision || f.previous_revision || '0',
    }))
  }

  function openNew() {
    setForm(emptyForm())
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.item_id || !form.new_revision?.trim() || !form.change_reason?.trim()) {
      toast('Item, new revision, and reason are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveDrawingRevision(form, user?.id)
      toast('Revision logged.', 'success')
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
            <FileDiff size={22} style={{ color: 'var(--primary)' }} /> Drawing revisions
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Revision history and item master updates.</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Log revision</button>}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No revision history yet.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Effective', 'Item', 'Drawing', 'From', 'To', 'Reason', 'Customer ref'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.effective_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{r.item?.item_code}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{r.item?.drawing_number || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{r.previous_revision}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.new_revision}</td>
                  <td style={{ padding: '10px 14px' }}>{r.change_reason}</td>
                  <td style={{ padding: '10px 14px' }}>{r.customer_ref || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 480 }}>
            <div className="card-header"><h3 className="card-title">Log drawing revision</h3><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
            <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select className="field-input" value={form.item_id} onChange={e => onItemPick(e.target.value)}>
                <option value="">Item *</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.item_code} — {i.description}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="field-input" placeholder="Previous rev" value={form.previous_revision} onChange={e => setForm(f => ({ ...f, previous_revision: e.target.value }))} />
                <input className="field-input" placeholder="New rev *" value={form.new_revision} onChange={e => setForm(f => ({ ...f, new_revision: e.target.value }))} />
              </div>
              <input type="date" className="field-input" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} />
              <textarea className="field-input" rows={2} placeholder="Change reason *" value={form.change_reason} onChange={e => setForm(f => ({ ...f, change_reason: e.target.value }))} />
              <input className="field-input" placeholder="Customer / ECN ref" value={form.customer_ref} onChange={e => setForm(f => ({ ...f, customer_ref: e.target.value }))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.apply_to_item} onChange={e => setForm(f => ({ ...f, apply_to_item: e.target.checked }))} />
                Update item master revision
              </label>
            </div>
            <div className="modal-panel-footer" style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={14} /> Save</button>
            </div>
      </AppModal>
    </div>
  )
}
