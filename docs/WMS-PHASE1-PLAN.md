# WMS Phase 1 — Machine Shop (BHEL & Allied)

**Product:** Workshop Management System for a machine shop executing jobs for BHEL units and allied vendors.  
**Source:** `WMS-Module-Structure.pdf` + current codebase audit (Aug 2026).

---

## Goals

1. Replace Church CMS leftovers in navigation with **operational WMS** modules.
2. Deliver **Phase 1 — Core Operations** from the PDF: Master Data → Orders → Planning → Shop Floor → Basic Inventory.
3. Keep existing **Foundation (0.x)** and **Finance** modules; integrate costing later (Phase 4).

---

## Current baseline

| Area | Status |
|------|--------|
| 0.1 Login, 0.2 Company, 0.3 Users | Live |
| Finance (GL + Simple Accounts) | Live |
| Login Details | Live |
| `MachinesPage`, `JobsPage`, `InventoryPage` | Stubs, **not routed** |
| Church CMS pages (members, receipts, events) | In repo, **not routed** — do not extend |
| Workshop Supabase tables | **None** (greenfield) |

---

## Phase 1 delivery plan

### Sprint A — Master Data (this implementation)

**Database:** `wms_customers`, `wms_items`, `wms_materials`, `wms_machines`, `wms_operators`, `wms_subcontractors` + RLS for admin roles.

**UI routes:** `/masters/*`

| PDF | Module | Route | Sprint A |
|-----|--------|-------|----------|
| 1.1 | Customer Master | `/masters/customers` | ✅ CRUD |
| 1.2 | Item/Part Master | `/masters/items` | ✅ CRUD |
| 1.3 | Material Master | `/masters/materials` | ✅ CRUD |
| 1.4 | Machine Master | `/masters/machines` | ✅ CRUD |
| 1.5 | Operator Master | `/masters/operators` | ✅ CRUD |
| 1.6 | Subcontractor Master | `/masters/subcontractors` | ✅ CRUD |
| 1.7 | Tooling & Gauge Master | `/masters/tooling` | Sprint B |

**Navigation:** Sidebar group **MASTER DATA** (admin). Dashboard quick links for admins.

---

### Sprint B — Orders (PDF §2) ✅ implemented

| Module | Route (proposed) |
|--------|------------------|
| 2.1 Enquiry / RFQ | `/orders/enquiries` |
| 2.2 PO Entry + attachments | `/orders/purchase-orders`, `/orders/purchase-orders/new`, `/orders/purchase-orders/:id` |
| 2.3 PO Amendments | `/orders/purchase-orders/:id/amendments` |
| 2.4 Order lifecycle dashboard | `/orders/status` |

**Migration:** `supabase/migrations/20260807160000_wms_orders.sql` (tables + `wms-po-attachments` bucket).

**Depends on:** Customers, Items. Apply master + orders migrations on live Supabase before use.

---

### Sprint C — Planning (PDF §3) ✅ implemented

| Module | Route |
|--------|-------|
| 3.1 Route / process sheet | `/planning/route-sheets`, `/planning/route-sheets/new`, `/planning/route-sheets/:id` |
| 3.2 Machine scheduling | `/planning/schedule` |
| 3.3 Production plan vs delivery | `/planning/production-plan` |

**Migration:** `supabase/migrations/20260807180000_wms_planning.sql`

**Depends on:** Items, Machines, PO lines. Release route sheets before linking operations in schedule.

---

### Sprint D — Shop floor (PDF §6) ✅ implemented

| Module | Route |
|--------|-------|
| 6.1 Job cards | `/shop/job-cards` |
| 6.2 Operation progress | `/shop/job-cards/:id` |
| 6.3 DPR | `/shop/dpr` |
| 6.4 Downtime log | `/shop/downtime` |

**Migration:** `supabase/migrations/20260807190000_wms_shop_floor.sql`

**Depends on:** Open PO lines; optional released route sheet copies operations onto new job cards.

---

### Sprint E — Basic inventory (PDF §4.1–4.2) ✅ implemented

| Module | Route |
|--------|-------|
| 4.1 RM inward (heat/batch) | `/stores/rm-inward` |
| 4.2 Material issue | `/stores/material-issue` |

**Migration:** `supabase/migrations/20260807200000_wms_stores.sql`

**Depends on:** Material master, job cards / PO lines for issue reference. `qty_balance` on inward lots decreases on each issue.

Optional in Phase 1: WIP (4.3) — not implemented.

---

## Data model principles

- **Codes are unique** per master (`customer_code`, `item_code`, etc.).
- **BHEL context:** `customer_type` = `bhel` | `allied` | `other`; optional `bhel_vendor_code` on customer.
- **Items** link to drawing no. + revision; optional default customer.
- **Soft deactivate** via `is_active` (no hard delete on masters in use).
- **RLS:** `super_admin`, `admin`, `admin1` read/write; `user` read-only (future); enforced in Postgres.

---

## Technical conventions

- Pages under `src/pages/masters/` and `src/lib/mastersLib.js`.
- Migrations under `supabase/migrations/`.
- Reuse existing layout (`AppLayout`), tokens (`--accent`, `.card`, `.field-input`), `useToast`, `useAuth`.
- Legacy CMS pages remain unmounted until explicitly removed.

---

## Success criteria (Sprint A)

- [ ] Migration applied on Supabase project used by production.
- [ ] All six master screens load, list, create, edit, deactivate.
- [ ] Sidebar shows **MASTER DATA**; routes registered in `App.jsx`.
- [ ] No IP/church-specific copy on new screens.

---

## After Phase 1

- **Phase 2 (PDF):** Quality, Dispatch, Drawing revision — see [`WMS-PHASE2-PLAN.md`](WMS-PHASE2-PLAN.md) ✅ implemented in app (apply migration `20260807210000_wms_phase2.sql` on Supabase).
- **Phase 3:** Tender alerts, tooling depth, maintenance, correspondence.
- **Phase 4:** Job costing, payment ageing, HR-lite, executive dashboards.
- **Phase 5:** Audit trail, field-level RBAC, notification engine.
