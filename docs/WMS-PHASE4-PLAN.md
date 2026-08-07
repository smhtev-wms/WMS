# WMS Phase 4 — Costing, receivables, HR-lite & executive view

**Status:** Implemented in app (migration `supabase/migrations/20260807230000_wms_phase4.sql` — apply on Supabase).

**Follows:** Phase 3 (tooling, tenders, PM, correspondence).

---

## Scope

| Area | Routes | Tables / data |
|------|--------|----------------|
| Job costing | `/insights/job-costing` | `wms_job_cost_entries`; roll-up from DPR + PO lines |
| Payment ageing | `/insights/receivables` | `wms_customer_receivables` |
| HR-lite (attendance) | `/hr/attendance` | `wms_attendance`; `wms_operators.hourly_rate` |
| Executive dashboard | `/insights/executive` | Aggregates across WMS modules |

**RLS:** Same as prior phases.

---

## Not in Phase 4

- GL posting to Accounts module.
- Payroll calculation.
- Full BI / custom report builder.
