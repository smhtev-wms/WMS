import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../lib/toast'
import { getExecutiveKpis } from '../../lib/executiveLib'
import { fmtAmt } from '../../lib/orderConstants'
import { Loader2, BarChart3, RefreshCw } from 'lucide-react'

function KpiCard({ label, value, sub, onClick, alert }) {
  return (
    <button
      type="button"
      className="card hover-lift"
      onClick={onClick}
      style={{
        padding: 18,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        border: alert ? '1px solid var(--danger-border)' : undefined,
        background: alert ? 'var(--danger-subtle)' : undefined,
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color: alert ? 'var(--danger)' : 'var(--primary)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </button>
  )
}

export default function ExecutiveDashboardPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [kpi, setKpi] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setKpi(await getExecutiveKpis()) } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading && !kpi) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
  }

  const k = kpi || {}

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={22} style={{ color: 'var(--primary)' }} /> Executive dashboard
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Workshop KPIs across orders, shop, quality, and finance.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        <KpiCard label="Open purchase orders" value={k.open_pos} onClick={() => navigate('/orders/purchase-orders')} />
        <KpiCard label="Jobs in progress" value={k.jobs_in_progress} onClick={() => navigate('/shop/job-cards')} />
        <KpiCard label="Overdue PO deliveries" value={k.overdue_po_deliveries} alert={k.overdue_po_deliveries > 0} onClick={() => navigate('/orders/status')} />
        <KpiCard label="Open NCRs" value={k.open_ncrs} alert={k.open_ncrs > 0} onClick={() => navigate('/quality/ncr')} />
        <KpiCard label="Tenders due (14 days)" value={k.tenders_due_14d} onClick={() => navigate('/commercial/tenders')} />
        <KpiCard label="Calibration overdue" value={k.calibration_overdue} alert={k.calibration_overdue > 0} onClick={() => navigate('/masters/tooling')} />
        <KpiCard label="PM overdue" value={k.pm_overdue} alert={k.pm_overdue > 0} onClick={() => navigate('/maintenance')} />
        <KpiCard label="Receivables outstanding" value={fmtAmt(k.receivables_outstanding)} sub={k.receivables_overdue > 0 ? `Overdue ${fmtAmt(k.receivables_overdue)}` : undefined} alert={k.receivables_overdue > 0} onClick={() => navigate('/insights/receivables')} />
        <KpiCard label="Dispatches this month" value={k.dispatches_this_month} onClick={() => navigate('/dispatch/notes')} />
        <KpiCard
          label="Attendance today"
          value={`${k.attendance_today_pct ?? 0}%`}
          sub={`${k.attendance_present ?? 0} / ${k.attendance_active_ops ?? 0} operators`}
          onClick={() => navigate('/hr/attendance')}
        />
      </div>
    </div>
  )
}
