import { supabase } from './supabase'
import { isUuid } from './ordersLib'

export async function listDrawingRevisions() {
  const { data, error } = await supabase
    .from('wms_drawing_revisions')
    .select('*')
    .order('effective_date', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const itemIds = [...new Set(rows.map(r => r.item_id))]
  const { data: items } = await supabase
    .from('wms_items')
    .select('id, item_code, description, drawing_number, revision')
    .in('id', itemIds)
  const itemById = Object.fromEntries((items || []).map(i => [i.id, i]))
  return rows.map(r => ({ ...r, item: itemById[r.item_id] }))
}

export async function saveDrawingRevision(payload, userId) {
  if (!isUuid(payload.item_id)) throw new Error('Item is required.')
  const row = {
    item_id: payload.item_id,
    previous_revision: payload.previous_revision,
    new_revision: payload.new_revision,
    effective_date: payload.effective_date,
    change_reason: payload.change_reason,
    customer_ref: payload.customer_ref || null,
    apply_to_item: !!payload.apply_to_item,
    created_by: userId || null,
  }
  const { data, error } = await supabase.from('wms_drawing_revisions').insert(row).select('*').single()
  if (error) throw error

  if (row.apply_to_item) {
    await supabase.from('wms_items').update({
      revision: row.new_revision,
      updated_at: new Date().toISOString(),
    }).eq('id', row.item_id)
  }
  return data
}
