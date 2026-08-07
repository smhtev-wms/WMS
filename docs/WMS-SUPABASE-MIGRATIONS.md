# WMS — Supabase migrations (apply in order)

Run each file in the **Supabase SQL editor** (or `supabase db push`) on your **production** project before using the matching app features.

| Order | Migration file | Phase |
|------|----------------|-------|
| 1 | `20260807140000_wms_master_data.sql` | 1 — Masters |
| 2 | `20260807160000_wms_orders.sql` | 1 — Orders |
| 3 | `20260807180000_wms_planning.sql` | 1 — Planning |
| 4 | `20260807190000_wms_shop_floor.sql` | 1 — Shop |
| 5 | `20260807200000_wms_stores.sql` | 1 — Stores |
| 6 | `20260807210000_wms_phase2.sql` | 2 — Quality, dispatch, drawings |
| 7 | `20260807220000_wms_phase3.sql` | 3 — Tooling, tenders, PM, correspondence |
| 8 | `20260807230000_wms_phase4.sql` | 4 — Costing, receivables, attendance |
| 9 | `20260807240000_wms_phase5.sql` | 5 — Audit, RBAC, notifications |
| 10 | `20260808120000_profiles_wms_quick_access.sql` | Quick Access layout on `profiles` |

After applying, sign in as an admin and use **Commercial → Notifications → Refresh alerts** once to populate system notifications.

**Job costing:** set **Operators → Hourly rate (₹)** on each operator for accurate DPR labor cost.
