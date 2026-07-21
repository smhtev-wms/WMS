import { useAuth } from '../lib/AuthContext'
import { LayoutDashboard } from 'lucide-react'

export default function DashboardPage() {
  const { session, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--card-border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Authenticating…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, flexDirection: 'column', gap: 12 }}>
        <LayoutDashboard size={44} color="var(--text-3)" />
        <p style={{ color: 'var(--text-3)' }}>Please log in to view the dashboard.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 32 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
        paddingBottom: 20,
        borderBottom: '1px solid var(--card-border)',
      }}>
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, lineHeight: 1.2 }}>
            <LayoutDashboard size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            Dashboard
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' }}>
            This dashboard has been refreshed with new content.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px 22px' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-1)' }}>New Dashboard Content</h3>
        <p style={{ margin: '10px 0 0', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.7 }}>
          The previous finance cards have been removed. This page now shows the refreshed dashboard view.
        </p>
      </div>
    </div>
  )
}
