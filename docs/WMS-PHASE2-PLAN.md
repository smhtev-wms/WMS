# WMS Phase 2 — Quality, Dispatch & Drawing revision

**Status:** Implemented in app (migration `supabase/migrations/20260807210000_wms_phase2.sql` — apply on Supabase).

**Follows:** Phase 1 core operations (masters → stores).  
**Source:** `WMS-Module-Structure.pdf` (Quality, Dispatch, Drawing revision).

---

## Scope

| Area | Routes | Tables |
|------|--------|--------|
| Quality — inspections | `/quality/inspections` | `wms_inspections` |
| Quality — NCR | `/quality/ncr` | `wms_ncr` |
| Dispatch | `/dispatch/notes`, `/dispatch/notes/new`, `/dispatch/notes/:id` | `wms_dispatches`, `wms_dispatch_lines` |
| Drawing revision log | `/engineering/drawing-revisions` | `wms_drawing_revisions` |

**RLS:** Same as Phase 1 (`wms_can_read_masters` / `wms_is_ops_admin`).

**Integration:**
- Inspections tie to job cards (and optional job operation).
- Failed inspections can spawn NCR records.
- Dispatch lines reduce open qty on PO lines; confirming dispatch can set PO status to `dispatched` when fully shipped.
- Drawing revisions log history and optionally update `wms_items.revision`.

---

## Not in Phase 2 (later)

- File upload for inspection reports / revised drawings (use PO attachment bucket pattern later).
- Auto email to customer on dispatch.
- Full BHEL portal integration.
