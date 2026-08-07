import { supabase } from './supabase'

export const OPS_ADMIN_ROLES = ['super_admin', 'admin', 'admin1']
export const MASTER_READ_ROLES = ['super_admin', 'admin', 'admin1', 'user', 'demo']

export function canManageMasters(role) {
  return OPS_ADMIN_ROLES.includes(role)
}

export async function listMaster(table, { orderBy = 'created_at', ascending = false, activeOnly = false } = {}) {
  let q = supabase.from(table).select('*').order(orderBy, { ascending })
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function saveMaster(table, payload, id) {
  const row = { ...payload, updated_at: new Date().toISOString() }
  if (id) {
    const { data, error } = await supabase.from(table).update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from(table).insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function setMasterActive(table, id, isActive) {
  const { error } = await supabase
    .from(table)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function listCustomersBrief() {
  const { data, error } = await supabase
    .from('wms_customers')
    .select('id, customer_code, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data || []
}

export async function listItemsBrief() {
  const { data, error } = await supabase
    .from('wms_items')
    .select('id, item_code, description, drawing_number, uom, revision')
    .eq('is_active', true)
    .order('item_code')
  if (error) throw error
  return data || []
}

export async function listMachinesBrief() {
  const { data, error } = await supabase
    .from('wms_machines')
    .select('id, machine_code, name, machine_type')
    .eq('is_active', true)
    .order('machine_code')
  if (error) throw error
  return data || []
}

export async function listSubcontractorsBrief() {
  const { data, error } = await supabase
    .from('wms_subcontractors')
    .select('id, vendor_code, name, process_type')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data || []
}

export async function listOperatorsBrief() {
  const { data, error } = await supabase
    .from('wms_operators')
    .select('id, employee_code, full_name')
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return data || []
}

export async function listMaterialsBrief() {
  const { data, error } = await supabase
    .from('wms_materials')
    .select('id, material_code, name, grade, uom')
    .eq('is_active', true)
    .order('material_code')
  if (error) throw error
  return data || []
}
