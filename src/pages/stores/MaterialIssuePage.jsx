import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listJobCardsBrief } from '../../lib/shopLib'
import { listPoLinesForPlanning } from '../../lib/planningLib'
import {
  listMaterialIssues,
  createMaterialIssue,
  suggestIssueNo,
  listInwardLotsWithBalance,
} from '../../lib/storesLib'
import { fmtDate } from '../../lib/orderConstants'
import { Loader2, Plus, ArrowDownToLine, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const emptyForm = () => ({
  issue_no: '',
  inward_id: '',
  job_card_id: '',
  po_line_id: '',
  qty_issued: '',
  issued_date: new Date().toISOString().slice(0, 10),
  issued_to: '',
  notes: '',
})

export default function MaterialIssuePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('stores')

  const [rows, setRows] = useState([])
  const [lots, setLots] = useState([])
  const [jobs, setJobs] = useState([])
  const [poLines, setPoLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [selectedLot, setSelectedLot] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listMaterialIssues())
    } catch (e) {
      toast(e.message || 'Failed to load issues', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function openNew() {
    try {
      const [lotList, no, jobList, lines] = await Promise.all([
        listInwardLotsWithBalance(),
        suggestIssueNo(),
        listJobCardsBrief(),
        listPoLinesForPlanning(),
      ])
      setLots(lotList)
      setJobs(jobList)
      setPoLines(lines)
      const first = lotList[0]
      setSelectedLot(first || null)
      setForm({
        ...emptyForm(),
        issue_no: no,
        inward_id: first?.id || '',
      })
      setModalOpen(true)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  function onLotChange(inwardId) {
    const lot = lots.find(l => l.id === inwardId)
    setSelectedLot(lot || null)
    setForm(f => ({ ...f, inward_id: inwardId }))
  }

  async function handleSave() {
    if (!form.issue_no?.trim() || !form.inward_id || !form.qty_issued) {
      toast('Issue no., lot, and quantity are required.', 'error')
      return
    }
    if (!form.job_card_id && !form.po_line_id) {
      toast('Link to a job card or PO line.', 'error')
      return
    }
    setSaving(true)
    try {
      await createMaterialIssue({
        ...form,
        uom: selectedLot?.uom,
      })
      toast('Material issued.', 'success')
      setModalOpen(false)
      await load()
    } catch (e) {
      toast(e.message || 'Issue failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowDownToLine size={22} style={{ color: 'var(--primary)' }} /> Material issue
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Issue RM from heat/batch lots to jobs or PO lines.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> Issue material</button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No material issues yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['Issue no.', 'Date', 'Material', 'Inward / heat', 'Qty', 'Job', 'PO line', 'Issued to'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.issue_no}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.issued_date)}</td>
                    <td style={{ padding: '10px 14px' }}>{row.material?.material_code || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>
                      {row.inward?.inward_no}
                      {row.inward?.heat_number && <span style={{ color: 'var(--text-3)' }}> / {row.inward.heat_number}</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{row.qty_issued} {row.uom}</td>
                    <td style={{ padding: '10px 14px' }}>{row.job?.job_number || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {row.po_line ? `L${row.po_line.line_no}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{row.issued_to || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 520 }}>
            <div className="card-header">
              <h3 className="card-title">Issue material</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-panel-scroll custom-scrollbar" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lots.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>No inward lots with balance. Record RM inward first.</p>
              ) : (
                <>
                  <div>
                    <label className="field-label">Issue no. *</label>
                    <input className="field-input" value={form.issue_no} onChange={e => setForm(f => ({ ...f, issue_no: e.target.value }))} />
                  </div>
                  <div>
                    <label className="field-label">Inward lot *</label>
                    <select className="field-input" value={form.inward_id} onChange={e => onLotChange(e.target.value)}>
                      {lots.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                    {selectedLot && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                        Available: {selectedLot.qty_balance} {selectedLot.uom}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="field-label">Qty to issue *</label>
                    <input type="number" className="field-input" value={form.qty_issued} onChange={e => setForm(f => ({ ...f, qty_issued: e.target.value }))} />
                  </div>
                  <div>
                    <label className="field-label">Job card</label>
                    <select className="field-input" value={form.job_card_id} onChange={e => setForm(f => ({ ...f, job_card_id: e.target.value }))}>
                      <option value="">—</option>
                      {jobs.map(j => <option key={j.id} value={j.id}>{j.job_number}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">PO line (if no job)</label>
                    <select className="field-input" value={form.po_line_id} onChange={e => setForm(f => ({ ...f, po_line_id: e.target.value }))}>
                      <option value="">—</option>
                      {poLines.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Issued date</label>
                    <input type="date" className="field-input" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="field-label">Issued to (operator / dept)</label>
                    <input className="field-input" value={form.issued_to} onChange={e => setForm(f => ({ ...f, issued_to: e.target.value }))} />
                  </div>
                  <div>
                    <label className="field-label">Notes</label>
                    <textarea className="field-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-panel-footer" style={{ padding: '0 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              {lots.length > 0 && (
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Issue</>}
                </button>
              )}
            </div>
      </AppModal>
    </div>
  )
}
