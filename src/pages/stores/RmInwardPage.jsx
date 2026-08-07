import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { canManageMasters, listMaterialsBrief } from '../../lib/mastersLib'
import { listRmInward, saveRmInward, suggestInwardNo } from '../../lib/storesLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, Search, PackageOpen, X, Save, Pencil } from 'lucide-react'

const emptyForm = () => ({
  inward_no: '',
  material_id: '',
  heat_number: '',
  batch_number: '',
  supplier_name: '',
  invoice_ref: '',
  qty_received: '',
  uom: 'KG',
  received_date: new Date().toISOString().slice(0, 10),
  storage_location: '',
  notes: '',
})

export default function RmInwardPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const canEdit = canManageMasters(profile?.role)

  const [rows, setRows] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listRmInward())
    } catch (e) {
      toast(e.message || 'Failed to load inward entries', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { listMaterialsBrief().then(setMaterials).catch(() => setMaterials([])) }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.inward_no, r.heat_number, r.batch_number, r.material?.material_code, r.material?.name, r.supplier_name]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  async function openNew() {
    setEditing(null)
    let no = ''
    try { no = await suggestInwardNo() } catch { /* manual */ }
    setForm({ ...emptyForm(), inward_no: no })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      inward_no: row.inward_no,
      material_id: row.material_id,
      heat_number: row.heat_number || '',
      batch_number: row.batch_number || '',
      supplier_name: row.supplier_name || '',
      invoice_ref: row.invoice_ref || '',
      qty_received: row.qty_received,
      uom: row.uom,
      received_date: row.received_date,
      storage_location: row.storage_location || '',
      notes: row.notes || '',
    })
    setModalOpen(true)
  }

  function onMaterialPick(materialId) {
    const m = materials.find(x => x.id === materialId)
    setForm(f => ({
      ...f,
      material_id: materialId,
      uom: m?.uom || f.uom,
    }))
  }

  async function handleSave() {
    if (!form.inward_no?.trim() || !form.material_id || !form.qty_received) {
      toast('Inward no., material, and quantity are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveRmInward(form, editing)
      toast(editing ? 'Updated.' : 'Inward recorded.', 'success')
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
            <PackageOpen size={22} style={{ color: 'var(--primary)' }} /> RM inward
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Raw material receipts with heat / batch traceability.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> New inward</button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-3)' }} />
        <input className="field-input" style={{ flex: 1 }} placeholder="Search inward no., heat, material…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} shown</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No inward entries yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['Inward no.', 'Date', 'Material', 'Heat', 'Batch', 'Received', 'Balance', 'Location', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.inward_no}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.received_date)}</td>
                    <td style={{ padding: '10px 14px' }}>{row.material ? `${row.material.material_code} — ${row.material.name}` : '—'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.heat_number || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.batch_number || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.qty_received} {row.uom}</td>
                    <td style={{ padding: '10px 14px', fontWeight: Number(row.qty_balance) > 0 ? 600 : 400 }}>{row.qty_balance} {row.uom}</td>
                    <td style={{ padding: '10px 14px' }}>{row.storage_location || '—'}</td>
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

      {modalOpen && (
        <div className="modal-overlay" onClick={() => !saving && setModalOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">{editing ? 'Edit inward' : 'New RM inward'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">Inward no. *</label>
                <input className="field-input" value={form.inward_no} onChange={e => setForm(f => ({ ...f, inward_no: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Material *</label>
                <select className="field-input" value={form.material_id} onChange={e => onMaterialPick(e.target.value)}>
                  <option value="">Select</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.material_code} — {m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Heat number</label>
                  <input className="field-input" value={form.heat_number} onChange={e => setForm(f => ({ ...f, heat_number: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Batch number</label>
                  <input className="field-input" value={form.batch_number} onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Qty received *</label>
                  <input type="number" className="field-input" value={form.qty_received} onChange={e => setForm(f => ({ ...f, qty_received: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">UOM</label>
                  <input className="field-input" value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="field-label">Received date</label>
                <input type="date" className="field-input" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Supplier</label>
                <input className="field-input" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Invoice / challan ref</label>
                <input className="field-input" value={form.invoice_ref} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Storage location</label>
                <input className="field-input" value={form.storage_location} onChange={e => setForm(f => ({ ...f, storage_location: e.target.value }))} />
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
