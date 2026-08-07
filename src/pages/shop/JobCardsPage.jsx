import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { listJobCards, createJobCard, suggestJobNumber, listPoLinesForPlanning } from '../../lib/shopLib'
import { JOB_STATUSES, statusMeta, fmtDate } from '../../lib/shopConstants'
import { Loader2, Plus, Search, Briefcase, X, Save } from 'lucide-react'
import AppModal from '../../components/ui/AppModal'

export default function JobCardsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('shop')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [poLines, setPoLines] = useState([])
  const [form, setForm] = useState({ po_line_id: '', job_number: '', priority: 'normal', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listJobCards())
    } catch (e) {
      toast(e.message || 'Failed to load job cards', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.job_number, r.po?.po_number, r.po_line?.description]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  async function openNew() {
    try {
      const [lines, no] = await Promise.all([
        listPoLinesForPlanning(),
        suggestJobNumber(),
      ])
      const withoutJob = []
      const existingLineIds = new Set(rows.map(r => r.po_line_id))
      for (const l of lines) {
        if (!existingLineIds.has(l.id)) withoutJob.push(l)
      }
      setPoLines(withoutJob)
      setForm({ po_line_id: withoutJob[0]?.id || '', job_number: no, priority: 'normal', notes: '' })
      setModalOpen(true)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  async function handleCreate() {
    if (!form.po_line_id || !form.job_number?.trim()) {
      toast('PO line and job number are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const id = await createJobCard(form)
      toast('Job card created.', 'success')
      setModalOpen(false)
      navigate(`/shop/job-cards/${id}`)
    } catch (e) {
      toast(e.message || 'Create failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function StatusBadge({ status }) {
    const m = statusMeta(JOB_STATUSES, status)
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>{m.label}</span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Briefcase size={22} style={{ color: 'var(--primary)' }} /> Job cards
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Shop work orders from open PO lines.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> New job card</button>
        )}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-3)' }} />
        <input className="field-input" style={{ flex: 1 }} placeholder="Search job no., PO…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} shown</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No job cards yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['Job no.', 'PO / line', 'Qty', 'Done', 'Due', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--table-border)', cursor: 'pointer' }} onClick={() => navigate(`/shop/job-cards/${row.id}`)}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.job_number}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {row.po?.po_number} / L{row.po_line?.line_no}
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.po_line?.description}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{row.qty_ordered}</td>
                    <td style={{ padding: '10px 14px' }}>{row.qty_completed}</td>
                    <td style={{ padding: '10px 14px' }}>{fmtDate(row.due_date)}</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} panelStyle={{ maxWidth: 480 }}>
            <div className="card-header">
              <h3 className="card-title">New job card</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-panel-scroll custom-scrollbar" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {poLines.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>No open PO lines without a job card. Create a PO first.</p>
              ) : (
                <>
                  <div>
                    <label className="field-label">PO line *</label>
                    <select className="field-input" value={form.po_line_id} onChange={e => setForm(f => ({ ...f, po_line_id: e.target.value }))}>
                      {poLines.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Job number *</label>
                    <input className="field-input" value={form.job_number} onChange={e => setForm(f => ({ ...f, job_number: e.target.value }))} />
                  </div>
                  <div>
                    <label className="field-label">Priority</label>
                    <select className="field-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
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
              {poLines.length > 0 && (
                <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Save size={14} /> Create</>}
                </button>
              )}
            </div>
      </AppModal>
    </div>
  )
}
