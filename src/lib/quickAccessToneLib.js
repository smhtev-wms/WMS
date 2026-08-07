/** Tile accent palette — assigned in display order in resolveGroupedLinks (not per-path hash). */
export const QUICK_ACCESS_TILE_TONES = [
  'blue',
  'violet',
  'green',
  'amber',
  'rose',
  'teal',
  'orange',
  'indigo',
  'cyan',
  'pink',
  'lime',
  'fuchsia',
  'sky',
  'slate',
]

/** @deprecated Use resolveGroupedLinks tone assignment instead. */
export function toneForQuickAccessPath(path) {
  const p = path || ''
  let hash = 0
  for (let i = 0; i < p.length; i += 1) {
    hash = (hash * 31 + p.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % QUICK_ACCESS_TILE_TONES.length
  return QUICK_ACCESS_TILE_TONES[idx]
}

export function withQuickAccessTones(links) {
  return links.map(link => ({
    ...link,
    tone: toneForQuickAccessPath(link.path),
  }))
}
