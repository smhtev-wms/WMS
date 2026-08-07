import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listItemsBrief, listMachinesBrief, listSubcontractorsBrief } from '../../lib/mastersLib'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { getRouteSheet, saveRouteSheet, suggestRouteSheetCode } from '../../lib/planningLib'
import { isUuid } from '../../lib/ordersLib'
import { ROUTE_SHEET_STATUSES } from '../../lib/planningConstants'
import { Loader2, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react'

const emptyOp = () => ({
  op_seq: 1,
  operation_name: '',
  machine_id: '',
  subcontractor_id: '',
  setup_minutes: 0,
  cycle_minutes: 0,
  inspection_required: false,
  notes: '',
})

const emptyHeader = () => ({
  sheet_code: '',
  item_id: '',
  revision: '0',
  status: 'draft',
  notes: '',
})

export default function RouteSheetFormPage() {
  const { id } = useParams()
  const location = useLocation()
  const isNew = location.pathname.endsWith('/route-sheets/new') || id === 'new'
  const hasValidId = isUuid(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('planning')

  const [loading, setLoading] = useState(!isNew && hasValidId)
  const [header, setHeader] = useState(emptyHeader())
  const [operations, setOperations] = useState([emptyOp()])
  const [items, setItems] = useState([])
  const [machines, setMachines] = useState([])
  const [subcontractors, setSubcontractors] = useState([])
  const [saving, setSaving] = useState(false)

  const loadRefs = useCallback(async () => {
    const [i, m, s] = await Promise.all([listItemsBrief(), listMachinesBrief(), listSubcontractorsBrief()])
    setItems(i)
    setMachines(m)
    setSubcontractors(s)
  }, [])

  const loadSheet = useCallback(async () => {
    if (isNew) return
    if (!id || !hasValidId) {
      navigate('/planning/route-sheets', { replace: true })
      return
    }
    setLoading(true)
    try {
      const sheet = await getRouteSheet(id)
      setHeader({
        sheet_code: sheet.sheet_code,
        item_id: sheet.item_id,
        revision: sheet.revision,
        status: sheet.status,
        notes: sheet.notes || '',
      })
      setOperations(sheet.operations?.length ? sheet.operations.map(op => ({
        op_seq: op.op_seq,
        operation_name: op.operation_name,
        machine_id: op.machine_id || '',
        subcontractor_id: op.subcontractor_id || '',
        setup_minutes: op.setup_minutes,
        cycle_minutes: op.cycle_minutes,
        inspection_required: op.inspection_required,
        notes: op.notes || '',
      })) : [emptyOp()])
    } catch (e) {
      toast(e.message || 'Failed to load route sheet', 'error')
      navigate('/planning/route-sheets')
    } finally {
      setLoading(false)
    }
  }, [id, isNew, hasValidId, navigate, toast])

  useEffect(() => { loadRefs() }, [loadRefs])
  useEffect(() => { loadSheet() }, [loadSheet])

  function onItemChange(itemId) {
    const item = items.find(x => x.id === itemId)
    setHeader(h => ({
      ...h,
      item_id: itemId,
      revision: item?.revision || h.revision || '0',
    }))
    if (isNew && item) {
      suggestRouteSheetCode(item.item_code, item.revision || '0').then(code => {
        setHeader(h => (h.sheet_code ? h : { ...h, sheet_code: code }))
      }).catch(() => {})
    }
  }

  function setOp(idx, patch) {
    setOperations(prev => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)))
  }

  function addOp() {
    setOperations(prev => [...prev, { ...emptyOp(), op_seq: prev.length + 1 }])
  }

  function removeOp(idx) {
    setOperations(prev => prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, op_seq: i + 1 })))
  }

  async function handleSave() {
    if (!canEdit) return
    if (!header.sheet_code?.trim() || !header.item_id) {
      toast('Sheet code and item are required.', 'error')
      return
    }
    if (!operations.length || operations.some(o => !String(o.operation_name).trim())) {
      toast('Each operation needs a name.', 'error')
      return
    }
    setSaving(true)
    try {
      const sheetId = await saveRouteSheet({ header, operations }, isNew ? null : id)
      toast(isNew ? 'Route sheet created.' : 'Route sheet updated.', 'success')
      if (isNew) navigate(`/planning/route-sheets/${sheetId}`, { replace: true })
      else await loadSheet()
    } catch (e) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
        <Loader2 size={20} className="animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/planning/route-sheets')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, flex: 1 }}>
          {isNew ? 'New route sheet' : header.sheet_code}
        </h1>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label className="field-label">Sheet code *</label>
            <input className="field-input" disabled={!canEdit} value={header.sheet_code} onChange={e => setHeader(h => ({ ...h, sheet_code: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Item *</label>
            <select className="field-input" disabled={!canEdit} value={header.item_id} onChange={e => onItemChange(e.target.value)}>
              <option value="">Select item</option>
              {items.map(it => <option key={it.id} value={it.id}>{it.item_code} — {it.description}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Revision</label>
            <input className="field-input" disabled={!canEdit} value={header.revision} onChange={e => setHeader(h => ({ ...h, revision: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" disabled={!canEdit} value={header.status} onChange={e => setHeader(h => ({ ...h, status: e.target.value }))}>
              {ROUTE_SHEET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="field-label">Notes</label>
          <textarea className="field-input" rows={2} disabled={!canEdit} value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} />
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Operations</h3>
          {canEdit && <button type="button" className="btn btn-secondary" onClick={addOp}><Plus size={14} /> Add op</button>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                {['#', 'Operation', 'Machine', 'Subcontractor', 'Setup min', 'Cycle min', 'Insp.', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operations.map((op, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: 8 }}>{op.op_seq}</td>
                  <td style={{ padding: 8, minWidth: 140 }}>
                    <input className="field-input" style={{ fontSize: 12 }} disabled={!canEdit} value={op.operation_name} onChange={e => setOp(idx, { operation_name: e.target.value })} />
                  </td>
                  <td style={{ padding: 8, minWidth: 120 }}>
                    <select className="field-input" style={{ fontSize: 12 }} disabled={!canEdit} value={op.machine_id} onChange={e => setOp(idx, { machine_id: e.target.value })}>
                      <option value="">—</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 8, minWidth: 120 }}>
                    <select className="field-input" style={{ fontSize: 12 }} disabled={!canEdit} value={op.subcontractor_id} onChange={e => setOp(idx, { subcontractor_id: e.target.value })}>
                      <option value="">—</option>
                      {subcontractors.map(s => <option key={s.id} value={s.id}>{s.vendor_code}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 8 }}><input type="number" className="field-input" style={{ width: 72, fontSize: 12 }} disabled={!canEdit} value={op.setup_minutes} onChange={e => setOp(idx, { setup_minutes: e.target.value })} /></td>
                  <td style={{ padding: 8 }}><input type="number" className="field-input" style={{ width: 72, fontSize: 12 }} disabled={!canEdit} value={op.cycle_minutes} onChange={e => setOp(idx, { cycle_minutes: e.target.value })} /></td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <input type="checkbox" disabled={!canEdit} checked={op.inspection_required} onChange={e => setOp(idx, { inspection_required: e.target.checked })} />
                  </td>
                  <td style={{ padding: 8 }}>
                    {canEdit && operations.length > 1 && (
                      <button type="button" className="btn btn-secondary" style={{ padding: 4 }} onClick={() => removeOp(idx)}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
