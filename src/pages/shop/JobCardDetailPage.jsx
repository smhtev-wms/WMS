import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { useWmsModuleAccess } from '../../lib/useWmsModuleAccess'
import { getJobCard, updateJobCard, updateJobOperation } from '../../lib/shopLib'
import { isUuid } from '../../lib/ordersLib'
import { JOB_STATUSES, OP_STATUSES, statusMeta, fmtDate } from '../../lib/shopConstants'
import { Loader2, ArrowLeft, Save } from 'lucide-react'

export default function JobCardDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const { canEdit } = useWmsModuleAccess('shop')

  const [loading, setLoading] = useState(true)
  const [card, setCard] = useState(null)
  const [header, setHeader] = useState({ status: 'open', priority: 'normal', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!isUuid(id)) {
      navigate('/shop/job-cards', { replace: true })
      return
    }
    setLoading(true)
    try {
      const data = await getJobCard(id)
      setCard(data)
      setHeader({ status: data.status, priority: data.priority, notes: data.notes || '' })
    } catch (e) {
      toast(e.message || 'Failed to load job card', 'error')
      navigate('/shop/job-cards')
    } finally {
      setLoading(false)
    }
  }, [id, navigate, toast])

  useEffect(() => { load() }, [load])

  async function saveHeader() {
    if (!canEdit || !card) return
    setSaving(true)
    try {
      await updateJobCard(card.id, header)
      toast('Job card updated.', 'success')
      await load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function setOpStatus(op, status) {
    if (!canEdit) return
    try {
      await updateJobOperation(op.id, {
        status,
        qty_done: status === 'done' ? card.qty_ordered : op.qty_done,
      })
      await load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (loading || !card) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
        <Loader2 size={20} className="animate-spin" /> Loading…
      </div>
    )
  }

  const jobMeta = statusMeta(JOB_STATUSES, card.status)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/shop/job-cards')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, flex: 1 }}>{card.job_number}</h1>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, color: jobMeta.color, background: jobMeta.bg }}>{jobMeta.label}</span>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={saveHeader} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save header</>}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text-3)', fontSize: 11 }}>PO</span><div>{card.po?.po_number || '—'}</div></div>
          <div><span style={{ color: 'var(--text-3)', fontSize: 11 }}>Line</span><div>L{card.po_line?.line_no} — {card.po_line?.description}</div></div>
          <div><span style={{ color: 'var(--text-3)', fontSize: 11 }}>Item</span><div>{card.item?.item_code || '—'}</div></div>
          <div><span style={{ color: 'var(--text-3)', fontSize: 11 }}>Qty</span><div>{card.qty_completed} / {card.qty_ordered}</div></div>
          <div><span style={{ color: 'var(--text-3)', fontSize: 11 }}>Due</span><div>{fmtDate(card.due_date)}</div></div>
        </div>
        {canEdit && (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <label className="field-label">Status</label>
              <select className="field-input" value={header.status} onChange={e => setHeader(h => ({ ...h, status: e.target.value }))}>
                {JOB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Priority</label>
              <select className="field-input" value={header.priority} onChange={e => setHeader(h => ({ ...h, priority: e.target.value }))}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label">Notes</label>
              <textarea className="field-input" rows={2} value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--table-border)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Operation progress</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                {['#', 'Operation', 'Status', 'Qty done', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.operations.map(op => {
                const m = statusMeta(OP_STATUSES, op.status)
                return (
                  <tr key={op.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '10px 14px' }}>{op.op_seq}</td>
                    <td style={{ padding: '10px 14px' }}>{op.operation_name}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: m.color, background: m.bg }}>{m.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{op.qty_done}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {canEdit && op.status !== 'done' && op.status !== 'skipped' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {op.status === 'pending' && (
                            <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setOpStatus(op, 'in_progress')}>Start</button>
                          )}
                          {op.status === 'in_progress' && (
                            <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setOpStatus(op, 'done')}>Complete</button>
                          )}
                          <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setOpStatus(op, 'skipped')}>Skip</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
