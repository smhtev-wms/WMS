import { toolingPlaceholder } from './masterConfigs'
import { Wrench } from 'lucide-react'

export default function ToolingPlaceholderPage() {
  const Icon = toolingPlaceholder.icon
  return (
    <div className="animate-fade-in card" style={{ padding: 28 }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={20} style={{ color: 'var(--accent)' }} />
        {toolingPlaceholder.title}
      </h1>
      <p className="page-subtitle" style={{ marginTop: 8 }}>{toolingPlaceholder.subtitle}</p>
      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
        See <code>docs/WMS-PHASE1-PLAN.md</code> for the full roadmap. Next operational modules after masters: Orders (RFQ / PO), Planning, Shop floor job cards, and Stores inward/issue.
      </p>
    </div>
  )
}
