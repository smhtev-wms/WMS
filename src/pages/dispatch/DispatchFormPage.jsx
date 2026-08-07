import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import {
  getDispatch,
  saveDispatch,
  suggestDispatchNo,
  getPoOptionsForDispatch,
  loadPoLinesForDispatch,
} from '../../lib/dispatchLib'
import { isUuid } from '../../lib/ordersLib'
import { Loader2, Save, ArrowLeft } from 'lucide-react'

const emptyHeader = () => ({
  dispatch_no: '',
  po_id: '',
  customer_id: '',
  dispatch_date: new Date().toISOString().slice(0, 10),
  vehicle_no: '',
  lr_number: '',
  transporter: '',
  destination: '',
  status: 'draft',
  notes: '',
})

export default function DispatchFormPage() {
  const { id } = useParams()
  const location = useLocation()
  const isNew = location.pathname.endsWith('/dispatch/notes/new') || id === 'new'
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('dispatch')

  const [loading, setLoading] = useState(!isNew)
  const [header, setHeader] = useState(emptyHeader())
  const [poOptions, setPoOptions] = useState([])
  const [poLines, setPoLines] = useState([])
  const [lineQtys, setLineQtys] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { getPoOptionsForDispatch().then(setPoOptions).catch(() => []) }, [])

  const loadDispatch = useCallback(async () => {
    if (isNew) return
    if (!isUuid(id)) { navigate('/dispatch/notes', { replace: true }); return }
    setLoading(true)
    try {
      const d = await getDispatch(id)
      setHeader({
        dispatch_no: d.dispatch_no,
        po_id: d.po_id,
        customer_id: d.customer_id,
        dispatch_date: d.dispatch_date,
        vehicle_no: d.vehicle_no || '',
        lr_number: d.lr_number || '',
        transporter: d.transporter || '',
        destination: d.destination || '',
        status: d.status,
        notes: d.notes || '',
      })
      setPoLines(d.po_lines || [])
      const qtys = {}
      for (const l of d.lines || []) qtys[l.po_line_id] = l.qty_dispatched
      setLineQtys(qtys)
    } catch (e) {
      toast(e.message, 'error')
      navigate('/dispatch/notes')
    } finally { setLoading(false) }
  }, [id, isNew, navigate, toast])

  useEffect(() => { loadDispatch() }, [loadDispatch])

  useEffect(() => {
    if (!isNew) return
    suggestDispatchNo().then(no => setHeader(h => h.dispatch_no ? h : { ...h, dispatch_no: no })).catch(() => {})
  }, [isNew])

  async function onPoChange(poId) {
    const po = poOptions.find(p => p.id === poId)
    setHeader(h => ({ ...h, po_id: poId, customer_id: po?.customer_id || '' }))
    if (!poId) { setPoLines([]); setLineQtys({}); return }
    const { lines } = await loadPoLinesForDispatch(poId)
    setPoLines(lines)
    setLineQtys({})
  }

  async function handleSave() {
    if (!header.dispatch_no || !header.po_id || !header.customer_id) {
      toast('DC no., PO, and customer required.', 'error')
      return
    }
    setSaving(true)
    try {
      const dispatchId = await saveDispatch({ header, lineQtys }, isNew ? null : id)
      toast(isNew ? 'Dispatch created.' : 'Dispatch updated.', 'success')
      if (isNew) navigate(`/dispatch/notes/${dispatchId}`, { replace: true })
      else await loadDispatch()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/dispatch/notes')}><ArrowLeft size={16} /> Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, flex: 1 }}>{isNew ? 'New dispatch' : header.dispatch_no}</h1>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Save</>}
          </button>
        )}
      </div>
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <div><label className="field-label">DC no.</label><input className="field-input" disabled={!canEdit} value={header.dispatch_no} onChange={e => setHeader(h => ({ ...h, dispatch_no: e.target.value }))} /></div>
          <div>
            <label className="field-label">PO</label>
            <select className="field-input" disabled={!canEdit || !isNew} value={header.po_id} onChange={e => onPoChange(e.target.value)}>
              <option value="">Select</option>
              {poOptions.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
            </select>
          </div>
          <div><label className="field-label">Dispatch date</label><input type="date" className="field-input" disabled={!canEdit} value={header.dispatch_date} onChange={e => setHeader(h => ({ ...h, dispatch_date: e.target.value }))} /></div>
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" disabled={!canEdit} value={header.status} onChange={e => setHeader(h => ({ ...h, status: e.target.value }))}>
              <option value="draft">Draft</option>
              <option value="dispatched">Dispatched</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div><label className="field-label">Vehicle no.</label><input className="field-input" disabled={!canEdit} value={header.vehicle_no} onChange={e => setHeader(h => ({ ...h, vehicle_no: e.target.value }))} /></div>
          <div><label className="field-label">LR number</label><input className="field-input" disabled={!canEdit} value={header.lr_number} onChange={e => setHeader(h => ({ ...h, lr_number: e.target.value }))} /></div>
          <div><label className="field-label">Transporter</label><input className="field-input" disabled={!canEdit} value={header.transporter} onChange={e => setHeader(h => ({ ...h, transporter: e.target.value }))} /></div>
          <div><label className="field-label">Destination</label><input className="field-input" disabled={!canEdit} value={header.destination} onChange={e => setHeader(h => ({ ...h, destination: e.target.value }))} /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="field-label">Notes</label><textarea className="field-input" rows={2} disabled={!canEdit} value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} /></div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--table-border)' }}><h3 style={{ margin: 0, fontSize: 14 }}>Dispatch quantities</h3></div>
        {poLines.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Select a PO to load lines.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--table-header-bg)' }}>
              {['Line', 'Description', 'PO qty', 'Already dispatched', 'Remaining', 'This dispatch'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {poLines.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '10px 14px' }}>L{l.line_no}</td>
                  <td style={{ padding: '10px 14px' }}>{l.description}</td>
                  <td style={{ padding: '10px 14px' }}>{l.qty}</td>
                  <td style={{ padding: '10px 14px' }}>{l.qty_already_dispatched}</td>
                  <td style={{ padding: '10px 14px' }}>{l.qty_remaining}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="number" className="field-input" style={{ width: 100 }} disabled={!canEdit} value={lineQtys[l.id] ?? ''} onChange={e => setLineQtys(q => ({ ...q, [l.id]: e.target.value }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
