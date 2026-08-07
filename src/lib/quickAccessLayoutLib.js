/** Persisted quick-link layout on Quick Access (grouped by heading). */

export const QUICK_ACCESS_GROUP_DEFS = [
  { id: 'management', title: 'Management & insights' },
  { id: 'operations', title: 'Operations & production' },
  { id: 'commercial', title: 'Commercial' },
  { id: 'hr', title: 'HR & people' },
  { id: 'masters', title: 'Master data' },
  { id: 'finance', title: 'Finance' },
  { id: 'admin', title: 'Administration' },
]

const GROUP_IDS = new Set(QUICK_ACCESS_GROUP_DEFS.map(g => g.id))
const DEFAULT_GROUP_ORDER = QUICK_ACCESS_GROUP_DEFS.map(g => g.id)

export const QUICK_ACCESS_LAYOUT_VERSION = 4

/** @typedef {{ id: string, title: string, paths: string[] }} QuickAccessGroup */

export function quickAccessLayoutStorageKey(userId) {
  const id = userId || 'anonymous'
  return `wms-quick-access-layout:${id}`
}

const LEGACY_LAYOUT_PREFIX = 'wms-dashboard-link-order:'

function readLegacyLocalLayout(storageKey) {
  if (!storageKey.startsWith('wms-quick-access-layout:')) return null
  const legacyKey = LEGACY_LAYOUT_PREFIX + storageKey.slice('wms-quick-access-layout:'.length)
  const raw = localStorage.getItem(legacyKey)
  if (!raw) return null
  localStorage.setItem(storageKey, raw)
  localStorage.removeItem(legacyKey)
  return raw
}

export function defaultGroupIdForLink(link) {
  const path = link?.path || ''
  if (['/company-setup', '/users', '/import', '/login-logs'].includes(path)) return 'admin'
  if (path === '/accounting' || path === '/simple-accounts') return 'finance'
  if (path.startsWith('/masters/')) return 'masters'
  if (path.startsWith('/hr/')) return 'hr'
  if (path.startsWith('/commercial/') || path === '/notifications') return 'commercial'
  if (path.startsWith('/insights/') || path === '/orders/status' || path.startsWith('/orders/')) return 'management'
  if (
    path.startsWith('/shop/')
    || path.startsWith('/stores/')
    || path.startsWith('/quality/')
    || path.startsWith('/planning/')
    || path.startsWith('/dispatch/')
    || path.startsWith('/engineering/')
    || path === '/maintenance'
  ) return 'operations'
  return 'operations'
}

export function buildDefaultGroupedLayout(links) {
  const byId = Object.fromEntries(
    QUICK_ACCESS_GROUP_DEFS.map(g => [g.id, { id: g.id, title: g.title, paths: [] }]),
  )
  for (const link of links) {
    const gid = defaultGroupIdForLink(link)
    byId[gid].paths.push(link.path)
  }
  return QUICK_ACCESS_GROUP_DEFS.map(g => byId[g.id])
}

export function sortGroupsByOrder(groups, groupOrder) {
  const order = groupOrder?.length ? groupOrder : DEFAULT_GROUP_ORDER
  const rank = new Map(order.map((id, i) => [id, i]))
  return [...groups].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : 999
    const rb = rank.has(b.id) ? rank.get(b.id) : 999
    return ra - rb
  })
}

function normalizeSavedGroups(rawGroups, links) {
  const allowedPaths = new Set(links.map(l => l.path))
  const titleById = Object.fromEntries(QUICK_ACCESS_GROUP_DEFS.map(g => [g.id, g.title]))
  const seen = new Set()
  const groups = []

  for (const def of QUICK_ACCESS_GROUP_DEFS) {
    const hit = rawGroups.find(g => g?.id === def.id)
    const title = typeof hit?.title === 'string' && hit.title.trim() ? hit.title.trim() : titleById[def.id]
    const paths = []
    for (const p of hit?.paths || []) {
      if (typeof p !== 'string' || !allowedPaths.has(p) || seen.has(p)) continue
      paths.push(p)
      seen.add(p)
    }
    groups.push({ id: def.id, title, paths })
  }

  for (const link of links) {
    if (seen.has(link.path)) continue
    const gid = defaultGroupIdForLink(link)
    const g = groups.find(x => x.id === gid)
    if (g) g.paths.push(link.path)
    seen.add(link.path)
  }

  return groups
}

function migrateFlatPaths(flatPaths, links) {
  const allowed = new Set(links.map(l => l.path))
  const ordered = flatPaths.filter(p => allowed.has(p))
  const groups = buildDefaultGroupedLayout(links)
  const byPathGroup = new Map()
  for (const g of groups) {
    for (const p of g.paths) byPathGroup.set(p, g.id)
  }
  const result = QUICK_ACCESS_GROUP_DEFS.map(def => ({
    id: def.id,
    title: def.title,
    paths: [],
  }))
  const byId = Object.fromEntries(result.map(g => [g.id, g]))
  const placed = new Set()
  for (const p of ordered) {
    const gid = byPathGroup.get(p) || defaultGroupIdForLink(links.find(l => l.path === p))
    if (GROUP_IDS.has(gid) && !placed.has(p)) {
      byId[gid].paths.push(p)
      placed.add(p)
    }
  }
  for (const link of links) {
    if (placed.has(link.path)) continue
    const gid = defaultGroupIdForLink(link)
    byId[gid].paths.push(link.path)
    placed.add(link.path)
  }
  return result
}

/** v3 hiddenPaths: re-attach paths to groups and treat as disabled. */
function ensurePathsInGroups(groups, pathsToRestore, links) {
  const next = groups.map(g => ({ ...g, paths: [...g.paths] }))
  for (const p of pathsToRestore || []) {
    if (next.some(g => g.paths.includes(p))) continue
    const link = links.find(l => l.path === p)
    if (!link) continue
    const gid = defaultGroupIdForLink(link)
    const g = next.find(x => x.id === gid)
    if (g) g.paths.push(p)
  }
  return next
}

export function packQuickAccessLayout(groups, groupOrder, disabledPaths, disabledGroupIds) {
  return {
    version: QUICK_ACCESS_LAYOUT_VERSION,
    groupOrder: groupOrder?.length ? groupOrder : groups.map(g => g.id),
    groups: groups.map(g => ({ id: g.id, title: g.title, paths: [...g.paths] })),
    disabledPaths: [...(disabledPaths || [])],
    disabledGroupIds: [...(disabledGroupIds || [])],
  }
}

export function parseQuickAccessSaved(saved) {
  if (!saved) return null
  if (saved.__flat) return { groups: null, groupOrder: null, disabledPaths: [], disabledGroupIds: [], __flat: saved.__flat }
  if ((saved.version === 3 || saved.version === 4) && Array.isArray(saved.groups)) {
    return {
      groups: saved.groups,
      groupOrder: Array.isArray(saved.groupOrder) ? saved.groupOrder : null,
      disabledPaths: Array.isArray(saved.disabledPaths)
        ? saved.disabledPaths
        : (Array.isArray(saved.hiddenPaths) ? saved.hiddenPaths : []),
      disabledGroupIds: Array.isArray(saved.disabledGroupIds) ? saved.disabledGroupIds : [],
    }
  }
  if (saved.version === 2 && Array.isArray(saved.groups)) {
    return { groups: saved.groups, groupOrder: null, disabledPaths: [], disabledGroupIds: [] }
  }
  if (Array.isArray(saved)) {
    return { __flat: saved.filter(p => typeof p === 'string') }
  }
  return null
}

export function loadQuickAccessLayoutLocal(storageKey) {
  try {
    let raw = localStorage.getItem(storageKey)
    if (!raw) raw = readLegacyLocalLayout(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parseQuickAccessSaved(parsed) || parsed
  } catch {
    return null
  }
}

export function saveQuickAccessLayoutLocal(storageKey, layout) {
  try {
    const payload = layout.version
      ? layout
      : packQuickAccessLayout(
        layout.groups,
        layout.groupOrder,
        layout.disabledPaths,
        layout.disabledGroupIds,
      )
    localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function mergeQuickLinksIntoGroups(links, saved) {
  if (!saved) {
    return {
      groups: buildDefaultGroupedLayout(links),
      groupOrder: [...DEFAULT_GROUP_ORDER],
      disabledPaths: [],
      disabledGroupIds: [],
    }
  }
  let parsed = parseQuickAccessSaved(saved)
  if (!parsed && Array.isArray(saved.groups)) {
    parsed = {
      groups: saved.groups,
      groupOrder: saved.groupOrder,
      disabledPaths: saved.disabledPaths || saved.hiddenPaths || [],
      disabledGroupIds: saved.disabledGroupIds || [],
    }
  }
  if (!parsed && saved.__flat) {
    parsed = { __flat: saved.__flat, disabledPaths: [], disabledGroupIds: [] }
  }
  if (!parsed) {
    return {
      groups: buildDefaultGroupedLayout(links),
      groupOrder: [...DEFAULT_GROUP_ORDER],
      disabledPaths: [],
      disabledGroupIds: [],
    }
  }

  const disabledPaths = (parsed.disabledPaths || []).filter(p => links.some(l => l.path === p))
  const disabledGroupIds = (parsed.disabledGroupIds || []).filter(id => GROUP_IDS.has(id))

  let groups
  if (parsed.__flat) {
    groups = migrateFlatPaths(parsed.__flat, links)
  } else {
    groups = normalizeSavedGroups(parsed.groups || [], links)
  }
  groups = ensurePathsInGroups(groups, disabledPaths, links)

  const groupOrder = parsed.groupOrder?.filter(id => GROUP_IDS.has(id)) || [...DEFAULT_GROUP_ORDER]
  for (const id of DEFAULT_GROUP_ORDER) {
    if (!groupOrder.includes(id)) groupOrder.push(id)
  }

  return {
    groups: sortGroupsByOrder(groups, groupOrder),
    groupOrder,
    disabledPaths,
    disabledGroupIds,
  }
}

export function resolveGroupedLinks(
  groups,
  links,
  { includeEmpty = false, disabledPaths = [], disabledGroupIds = [] } = {},
) {
  const disabledP = new Set(disabledPaths)
  const disabledG = new Set(disabledGroupIds)
  const byPath = new Map(links.map(l => [l.path, l]))
  const resolved = groups.map(g => {
    const groupDisabled = disabledG.has(g.id)
    return {
      id: g.id,
      title: g.title,
      disabled: groupDisabled,
      links: g.paths.map(p => {
        const link = byPath.get(p)
        if (!link) return null
        return {
          ...link,
          disabled: groupDisabled || disabledP.has(p),
        }
      }).filter(Boolean),
    }
  })
  if (includeEmpty) return resolved
  return resolved.filter(g => g.links.length > 0)
}

export function moveLinkInGroups(groups, payload, targetGroupId, targetIndex) {
  const { path, fromGroupId, fromIndex } = payload
  if (!path || !GROUP_IDS.has(targetGroupId)) return groups

  const next = groups.map(g => ({ ...g, paths: [...g.paths] }))
  const fromG = next.find(g => g.id === fromGroupId)
  const toG = next.find(g => g.id === targetGroupId)
  if (!fromG || !toG) return groups

  let fromIdx = fromIndex
  if (fromIdx < 0 || fromG.paths[fromIdx] !== path) {
    fromIdx = fromG.paths.indexOf(path)
  }
  if (fromIdx < 0) return groups

  if (fromGroupId === targetGroupId) {
    const paths = fromG.paths
    const [item] = paths.splice(fromIdx, 1)
    let insertAt = targetIndex
    if (insertAt > fromIdx) insertAt -= 1
    insertAt = Math.max(0, Math.min(insertAt, paths.length))
    paths.splice(insertAt, 0, item)
    return next
  }

  fromG.paths.splice(fromIdx, 1)
  for (const g of next) {
    if (g.id !== targetGroupId) g.paths = g.paths.filter(p => p !== path)
  }
  const insertAt = Math.max(0, Math.min(targetIndex, toG.paths.length))
  toG.paths.splice(insertAt, 0, path)
  return next
}

export function reorderGroups(groups, fromIndex, toIndex) {
  return reorderByIndex(groups, fromIndex, toIndex)
}

export function updateGroupTitle(groups, groupId, title) {
  if (typeof title !== 'string') return groups
  return groups.map(g => (g.id === groupId ? { ...g, title } : g))
}

export function togglePathDisabled(disabledPaths, path) {
  const set = new Set(disabledPaths)
  if (set.has(path)) set.delete(path)
  else set.add(path)
  return [...set]
}

export function toggleGroupDisabled(disabledGroupIds, groupId) {
  const set = new Set(disabledGroupIds)
  if (set.has(groupId)) set.delete(groupId)
  else set.add(groupId)
  return [...set]
}

/** Category is disabled when flagged or every module in it is individually disabled (e.g. after Clear canvas). */
export function isCategoryDisabled(group, disabledPaths, disabledGroupIds) {
  if (disabledGroupIds.includes(group.id)) return true
  const paths = group.paths || []
  if (paths.length === 0) return false
  const disabledP = new Set(disabledPaths)
  return paths.every(p => disabledP.has(p))
}

/** Enable/disable whole category on canvas and in the organize panel. */
export function toggleCategoryDisabled(groups, groupId, disabledPaths, disabledGroupIds) {
  const group = groups.find(g => g.id === groupId)
  if (!group) return { disabledPaths, disabledGroupIds }

  const pathSet = new Set(group.paths)
  const currentlyDisabled = isCategoryDisabled(group, disabledPaths, disabledGroupIds)

  if (currentlyDisabled) {
    return {
      disabledGroupIds: disabledGroupIds.filter(id => id !== groupId),
      disabledPaths: disabledPaths.filter(p => !pathSet.has(p)),
    }
  }

  const nextDisabledPaths = new Set(disabledPaths)
  for (const p of group.paths) nextDisabledPaths.add(p)
  const nextGroupIds = disabledGroupIds.includes(groupId)
    ? disabledGroupIds
    : [...disabledGroupIds, groupId]

  return {
    disabledPaths: [...nextDisabledPaths],
    disabledGroupIds: nextGroupIds,
  }
}

export function reorderByIndex(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list
  if (fromIndex >= list.length || toIndex >= list.length) return list
  const next = [...list]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}
