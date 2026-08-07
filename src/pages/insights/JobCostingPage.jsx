import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listJobCostRollup, listCostEntries, saveCostEntry, deleteCostEntry } from '../../lib/jobCostingLib'
import { fmtAmt } from '../../lib/orderConstants'
import { Loader2, IndianRupee, Plus, X, Save, Trash2 } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

const COST_TYPES = [
  { value: 'material', label: 'Material' },
  { value: 'labor', label: 'Labor (manual)' },
  { value: 'subcontract', label: 'Subcontract' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'other', label: 'Other' },
]

const emptyEntry = (jobCardId) => ({
  job_card_id: jobCardId,
  cost_type: 'subcontract',
  description: '',
  amount: '',
  cost_date: new Date().toISOString().slice(0, 10),
  reference: '',
})

export default function JobCostingPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('insights')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailJob, setDetailJob] = useState(null)
  const [entries, setEntries] = useState([])
  const [entryModal, setEntryModal] = useState(false)
  const [entryForm, setEntryForm] = useState(emptyEntry(''))
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listJobCostRollup()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function openDetail(row) {
    setDetailJob(row)
    try { setEntries(await listCostEntries(row.job.id)) } catch (e) { toast(e.message, 'error') }
  }

  function openAddEntry() {
    if (!detailJob) return
    setEntryForm(emptyEntry(detailJob.job.id))
    setEntryModal(true)
  }

  async function saveEntry() {
    if (!entryForm.description?.trim() || entryForm.amount === '') {
      toast('Description and amount required.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveCostEntry(entryForm)
      toast('Cost entry added.', 'success')
      setEntryModal(false)
      await load()
      if (detailJob) setEntries(await listCostEntries(detailJob.job.id))
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function removeEntry(id) {
    if (!window.confirm('Delete this cost entry?')) return
    try {
      await deleteCostEntry(id)
      await load()
      if (detailJob) setEntries(await listCostEntries(detailJob.job.id))
    } catch (e) { toast(e.message, 'error') }
  }

  function marginColor(pct) {
    if (pct == null) return 'var(--text-3)'
    if (pct < 0) return 'var(--danger)'
    if (pct < 15) return 'var(--warning)'
    return 'var(--success)'
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <IndianRupee size={22} style={{ color: 'var(--primary)' }} /> Job costing
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
          Revenue from PO lines vs DPR labor (operator hourly rate) and manual cost entries.
        </p>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No active job cards.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--table-header-bg)' }}>
                {['Job', 'PO', 'Revenue', 'Material', 'Labor', 'Other', 'Total cost', 'Margin', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.job.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>
                      <button type="button" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => navigate(`/shop/job-cards/${r.job.id}`)}>
                        {r.job.job_number}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{r.po?.po_number || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtAmt(r.revenue)}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtAmt(r.material)}</td>
                    <td style={{ padding: '10px 14px' }} title={`DPR: ${fmtAmt(r.labor_dpr)}`}>{fmtAmt(r.labor)}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtAmt(r.subcontract + r.overhead + r.other)}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtAmt(r.total_cost)}</td>
                    <td style={{ padding: '10px 14px', color: marginColor(r.margin_pct), fontWeight: 600 }}>
                      {r.margin_pct != null ? `${r.margin_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => openDetail(r)}>Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailJob && (
        <div className="card" style={{ marginTop: 20, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Cost entries — {detailJob.job.job_number}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {canEdit && <button type="button" className="btn btn-primary" onClick={openAddEntry}><Plus size={14} /> Add entry</button>}
              <button type="button" className="btn btn-secondary" onClick={() => setDetailJob(null)}>Close</button>
            </div>
          </div>
          {entries.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>No manual entries (labor from DPR is included in the table above).</p>
          ) : (
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--table-header-bg)' }}>
                {['Date', 'Type', 'Description', 'Amount', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '8px 12px' }}>{e.cost_date}</td>
                    <td style={{ padding: '8px 12px' }}>{e.cost_type}</td>
                    <td style={{ padding: '8px 12px' }}>{e.description}</td>
                    <td style={{ padding: '8px 12px' }}>{fmtAmt(e.amount)}</td>
                    <td style={{ padding: '8px 12px' }}>{canEdit && <button type="button" className="btn btn-secondary" style={{ padding: 6 }} onClick={() => removeEntry(e.id)}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AppModal open={entryModal} onClose={() => !saving && setEntryModal(false)} panelStyle={{ maxWidth: 480 }}>
        <div className="card-header"><h3 className="card-title">Add cost entry</h3><button type="button" onClick={() => setEntryModal(false)}><X size={18} /></button></div>
        <div className="modal-panel-scroll custom-scrollbar" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select className="field-input" value={entryForm.cost_type} onChange={e => setEntryForm(f => ({ ...f, cost_type: e.target.value }))}>
            {COST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className="field-input" placeholder="Description *" value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} />
          <input type="number" className="field-input" placeholder="Amount (₹) *" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} />
          <input type="date" className="field-input" value={entryForm.cost_date} onChange={e => setEntryForm(f => ({ ...f, cost_date: e.target.value }))} />
          <input className="field-input" placeholder="Reference" value={entryForm.reference} onChange={e => setEntryForm(f => ({ ...f, reference: e.target.value }))} />
        </div>
        <div className="modal-panel-footer" style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setEntryModal(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={saveEntry} disabled={saving}><Save size={14} /> Save</button>
        </div>
      </AppModal>
    </div>
  )
}
