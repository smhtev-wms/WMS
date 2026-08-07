# WMS Phase 3 — Commercial support & tooling depth

**Status:** Implemented in app (migration `supabase/migrations/20260807220000_wms_phase3.sql` — apply on Supabase).

**Follows:** Phase 2 (quality, dispatch, drawing revision).  
**Source:** `WMS-Module-Structure.pdf` — §1.7 tooling, tender tracking, PM maintenance, correspondence.

---

## Scope

| Area | Routes | Tables |
|------|--------|--------|
| Tooling & gauges (§1.7) | `/masters/tooling` | `wms_tooling` |
| Tender / portal alerts | `/commercial/tenders` | `wms_tenders` |
| Preventive maintenance | `/maintenance` | `wms_maintenance_plans`, `wms_maintenance_logs` |
| Correspondence log | `/commercial/correspondence` | `wms_correspondence` |

**RLS:** Same as Phase 1 (`wms_can_read_masters` / `wms_is_ops_admin`).

**Integration:**
- Tooling links optional machine; calibration due derived from last cal + interval.
- Tenders link optional customer; list highlights submission due within 14 days.
- Maintenance plans drive next due on machines; logs record completed PM.
- Correspondence links customer and optional PO.

---

## Not in Phase 3 (later)

- BHEL portal API sync.
- Email reminders / notification engine (Phase 5).
- Gauge calibration certificates upload.
