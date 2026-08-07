# WMS Phase 5 — Audit trail, RBAC & notifications

**Status:** Implemented in app (migration `supabase/migrations/20260807240000_wms_phase5.sql` — apply on Supabase).

**Follows:** Phase 4 (costing, receivables, HR-lite, executive).

---

## Scope

| Area | Routes | Tables |
|------|--------|--------|
| Audit trail | `/admin/audit-trail` | `wms_audit_log` |
| Field-level RBAC | `/admin/wms-permissions` | `wms_role_permissions` |
| Notification engine | `/notifications` | `wms_notifications` |

**RBAC modules:** masters, orders, planning, shop, stores, quality, dispatch, engineering, commercial, maintenance, insights, hr, admin.

**Notifications:** Generated from overdue tenders, calibration, PM, receivables (refresh on Notifications page).

**Audit:** Client-logged on key actions (masters save, permissions save, notification refresh); extensible via `logWmsAudit()`.

---

## Not in Phase 5

- Email/SMS delivery.
- Postgres triggers for every table change.
- Per-field column masks in UI.
