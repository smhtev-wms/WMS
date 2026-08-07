import { supabase } from './supabase'
import { OPS_ADMIN_ROLES, MASTER_READ_ROLES } from './mastersLib'

export const WMS_MODULES = [
  { key: 'masters', label: 'Master data' },
  { key: 'orders', label: 'Orders' },
  { key: 'planning', label: 'Planning' },
  { key: 'shop', label: 'Shop floor' },
  { key: 'stores', label: 'Stores' },
  { key: 'quality', label: 'Quality' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'insights', label: 'Insights / costing' },
  { key: 'hr', label: 'HR-lite' },
  { key: 'admin', label: 'Admin / compliance' },
]

export const WMS_ROLES = ['super_admin', 'admin1', 'admin', 'user', 'demo']

let matrixCache = null
let matrixLoadedAt = 0
const CACHE_MS = 60_000

function defaultRead(role) {
  return MASTER_READ_ROLES.includes(role)
}

function defaultWrite(role) {
  return OPS_ADMIN_ROLES.includes(role)
}

function key(role, module) {
  return `${role}:${module}`
}

export async function loadWmsPermissionMatrix(force = false) {
  const now = Date.now()
  if (!force && matrixCache && now - matrixLoadedAt < CACHE_MS) return matrixCache

  const { data, error } = await supabase.from('wms_role_permissions').select('*')
  if (error) throw error

  const map = new Map()
  for (const row of data || []) {
    map.set(key(row.role, row.module), { can_read: row.can_read, can_write: row.can_write })
  }
  matrixCache = map
  matrixLoadedAt = now
  return map
}

export function invalidateWmsPermissionCache() {
  matrixCache = null
  matrixLoadedAt = 0
}

export function canWmsRead(role, module, matrix = matrixCache) {
  if (!role) return false
  const hit = matrix?.get(key(role, module))
  if (hit) return Boolean(hit.can_read)
  return defaultRead(role)
}

export function canWmsWrite(role, module, matrix = matrixCache) {
  if (!role) return false
  const hit = matrix?.get(key(role, module))
  if (hit) return Boolean(hit.can_write)
  return defaultWrite(role)
}

/** Backward-compatible admin write check (masters module). */
export function canManageWms(role, module = 'masters', matrix = matrixCache) {
  return canWmsWrite(role, module, matrix)
}

export async function listRolePermissions() {
  const { data, error } = await supabase.from('wms_role_permissions').select('*').order('role').order('module')
  if (error) throw error
  return data || []
}

export async function saveRolePermission({ role, module, can_read, can_write }) {
  const { data, error } = await supabase
    .from('wms_role_permissions')
    .upsert({
      role,
      module,
      can_read,
      can_write,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'role,module' })
    .select('*')
    .single()
  if (error) throw error
  invalidateWmsPermissionCache()
  return data
}
