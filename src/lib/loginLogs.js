import { supabase, adminSupabase } from './supabase'

const GEO_CACHE_KEY  = 'church_cms_geo_v3'        // v3 — ipinfo token
const GPS_TTL_MS     = 30 * 24 * 60 * 60 * 1000  // GPS result: 30 days
const IP_TTL_MS      =      24 * 60 * 60 * 1000  // IP result:   1 day
const ACTIVE_LOGIN_LOG_KEY = 'church_cms_active_login_log_id'

// Pre-fetch started on login page mount so result is ready before sign-in
let _warmPromise = null

function readGeoCache() {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    const ttl = (obj.source === 'gps' || obj.source === 'manual') ? GPS_TTL_MS : IP_TTL_MS
    if (Date.now() - obj.cachedAt > ttl) { localStorage.removeItem(GEO_CACHE_KEY); return null }
    return obj
  } catch { return null }
}

function writeGeoCache(loc) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ...loc, cachedAt: Date.now() })) } catch { /* ignore */ }
}

function getActiveLoginLogId() {
  try { return localStorage.getItem(ACTIVE_LOGIN_LOG_KEY) || null } catch { return null }
}

function setActiveLoginLogId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_LOGIN_LOG_KEY, id)
    else localStorage.removeItem(ACTIVE_LOGIN_LOG_KEY)
  } catch { /* ignore */ }
}

/* GPS → Nominatim reverse geocode. Browser remembers permission; prompt appears once. */
async function fetchByGPS() {
  if (!navigator?.geolocation) return null
  const coords = await new Promise(resolve =>
    navigator.geolocation.getCurrentPosition(p => resolve(p.coords), () => resolve(null), { timeout: 7000, maximumAge: 60000 })
  )
  if (!coords) return null
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
      { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
    )
    clearTimeout(t)
    if (!res.ok) return null
    const { address: a = {} } = await res.json()
    return {
      source:    'gps',
      ipAddress: null,
      city:      a.city || a.town || a.village || a.county || null,
      region:    a.state || null,
      country:   a.country || null,
    }
  } catch { return null }
}

/* Single IP lookup with 4 s timeout */
async function ipFetch(url, map) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 4000)
  try {
    const res = await fetch(url, { signal: c.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const d = await res.json()
    const r = map(d)
    return r?.city || r?.region ? { source: 'ip', ...r } : null
  } catch { clearTimeout(t); return null }
}

/* Run all IP providers in parallel — take whichever resolves first with valid data */
async function fetchByIP() {
  const IPINFO_TOKEN = 'e2bd6cd58f0cd7'
  const race = Promise.any([
    // ipinfo.io with auth token — primary, best database
    ipFetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`, d =>
      d.ip ? { ipAddress: d.ip, city: d.city || null, region: d.region || null, country: d.country || null } : null),
    ipFetch('https://get.geojs.io/v1/ip/geo.json', d => ({ ipAddress: d.ip || null, city: d.city || null, region: d.region || null, country: d.country || null })),
    ipFetch('https://ipapi.co/json/',               d => ({ ipAddress: d.ip || null, city: d.city || null, region: d.region || null, country: d.country_name || null })),
  ]).catch(() => null)
  return race
}

/* Call on login page mount — starts GPS + IP in parallel while the user
   types credentials. Result is ready (or nearly so) by sign-in time. */
export function warmGeoLocation() {
  if (readGeoCache()) return           // already have fresh data
  if (_warmPromise) return             // already running
  _warmPromise = _resolveGeo().then(loc => { _warmPromise = null; return loc })
}

async function _resolveGeo() {
  const [gps, ip] = await Promise.all([fetchByGPS(), fetchByIP()])
  const loc = gps || ip || {}
  if (loc.city || loc.region || loc.country) writeGeoCache(loc)
  return loc
}

/* Returns cached location, or waits for the warm-up promise, or resolves fresh. */
export async function fetchGeoLocation() {
  const cached = readGeoCache()
  if (cached) return cached

  // If warmGeoLocation() was called on page mount, await that promise
  if (_warmPromise) {
    const loc = await Promise.race([_warmPromise, new Promise(r => setTimeout(() => r(null), 3000))])
    if (loc?.city || loc?.region) return loc
  }

  return await _resolveGeo()
}

function detectBrowserInfo(ua = '') {
  const browser = ua.includes('Edge/') ? 'Edge'
    : ua.includes('OPR/') || ua.includes('Opera') ? 'Opera'
    : ua.includes('Chrome/') && !ua.includes('Chromium') ? 'Chrome'
    : ua.includes('Safari/') && !ua.includes('Chrome/') ? 'Safari'
    : ua.includes('Firefox/') ? 'Firefox'
    : ua.includes('Chromium') ? 'Chromium'
    : ua.includes('MSIE') || ua.includes('Trident/') ? 'Internet Explorer'
    : 'Unknown'

  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Android') ? 'Android'
    : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
    : ua.includes('Mac OS') ? 'macOS'
    : ua.includes('Linux') ? 'Linux'
    : null

  return { browser, os }
}

/* Insert a new login row */
export async function insertLoginLog({ userId, email, fullName, role, ipAddress, city, region, country, userAgent, loginType, location, deviceId, designation, org, browser, os, deviceName }) {
  const computedLocation = location || ([city, region].filter(Boolean).join(', ') || null)
  const uaInfo = detectBrowserInfo(userAgent || '')
  const payload = {
    user_id:         userId,
    email,
    full_name:       fullName  || null,
    user_role:       role      || null,
    designation:     designation || null,
    ip_address:      ipAddress || null,
    city:            city      || null,
    region:          region || null,
    country:         country || null,
    user_agent:      userAgent || null,
    browser:         browser || uaInfo.browser,
    os:              os || uaInfo.os,
    duration_seconds: null,
    device_id:       deviceId || null,
    user_name:       deviceName || null,
    location:        computedLocation,
    org:             org || null,
    login_type:      loginType || 'trustgate',
  }

  let { data, error } = await supabase
    .from('login_logs')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.error('[loginLogs] insert error (anon):', error)
    const fallback = await adminSupabase
      .from('login_logs')
      .insert(payload)
      .select('id')
      .single()

    if (fallback.error) {
      console.error('[loginLogs] insert error (service):', fallback.error)
      return null
    }

    data = fallback.data
  }

  if (data?.id) {
    setActiveLoginLogId(data.id)
  }

  return data?.id ?? null
}

/* Stamp logout_at on the specific login row created for this browser session.
   If that row is not available, fall back to any still-open rows for the user. */
export async function stampLogout(userId) {
  if (!userId) return

  const activeLoginId = getActiveLoginLogId()
  const nowIso = new Date().toISOString()

  if (activeLoginId) {
    const loginAt = await supabase
      .from('login_logs')
      .select('login_at')
      .eq('id', activeLoginId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!loginAt.error && loginAt.data?.login_at) {
      const loginAtMs = new Date(loginAt.data.login_at).getTime()
      const durationSeconds = Math.max(0, Math.round((Date.now() - loginAtMs) / 1000))
      const { error } = await supabase
        .from('login_logs')
        .update({ logout_at: nowIso, duration_seconds: durationSeconds })
        .eq('id', activeLoginId)
        .eq('user_id', userId)

      if (!error) {
        setActiveLoginLogId(null)
        return
      }

      console.warn('[loginLogs] direct logout stamp failed, trying fallback:', error.message)
    }
  }

  const { data, error: fetchErr } = await adminSupabase
    .from('login_logs')
    .select('id, login_at')
    .eq('user_id', userId)
    .is('logout_at', null)
    .order('login_at', { ascending: false })

  if (fetchErr) {
    console.error('[loginLogs] logout stamp fetch error:', fetchErr)
    return
  }

  const rows = data || []
  if (!rows.length) {
    setActiveLoginLogId(null)
    return
  }

  const updates = []
  for (const row of rows) {
    const loginAtMs = row.login_at ? new Date(row.login_at).getTime() : Date.now()
    const durationSeconds = Math.max(0, Math.round((Date.now() - loginAtMs) / 1000))
    updates.push(
      adminSupabase
        .from('login_logs')
        .update({ logout_at: nowIso, duration_seconds: durationSeconds })
        .eq('id', row.id)
    )
  }

  const results = await Promise.all(updates)
  const failed = results.filter(r => r.error)
  if (failed.length) {
    console.error('[loginLogs] logout stamp update error:', failed[0].error)
  } else {
    setActiveLoginLogId(null)
  }
}

// ── Device registration ───────────────────────────────────────────────────────

function _setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`
}

function _getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? m[1] : null
}

// Persists in both localStorage AND a 1-year cookie so the ID survives
// cache clears (cookies are only wiped when the user explicitly clears
// "Cookies and site data", not just "Cached images and files").
export function getOrCreateDeviceId() {
  const LS_KEY  = 'church_cms_device_id'
  const CK_NAME = 'cms_did'
  try {
    let id = localStorage.getItem(LS_KEY) || _getCookie(CK_NAME)
    if (!id) id = crypto.randomUUID()
    localStorage.setItem(LS_KEY, id)
    _setCookie(CK_NAME, id, 365)
    return id
  } catch {
    return _getCookie(CK_NAME) || crypto.randomUUID()
  }
}

function normalizeDeviceStatus(row) {
  if (!row) return { exists: false, approved: false, status: 'pending', row: null }
  
  let isApproved = row.approved === true || row.status === 'approved'
  
  // Check if approval has expired
  if (isApproved && row.valid_upto) {
    const validUpto = new Date(row.valid_upto)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (validUpto < today) {
      isApproved = false
      // Update status to reflect expiry
      return { exists: true, approved: false, status: 'expired', row, isExpired: true }
    }
  }
  
  const status = row.status || (isApproved ? 'approved' : 'pending')
  return { exists: true, approved: isApproved, status, row, isExpired: false }
}

export async function checkDeviceRegistered(deviceId) {
  if (!deviceId) return null
  const { data, error } = await supabase
    .from('user_devices')
    .select('id, org_name, user_name, device_name, location, designation, approved, status, valid_upto')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error || !data) return null
  const result = normalizeDeviceStatus(data)
  return result.approved ? data : null
}

export async function getDeviceRegistrationStatus(deviceId) {
  if (!deviceId) return normalizeDeviceStatus(null)
  const { data, error } = await supabase
    .from('user_devices')
    .select('id, org_name, user_name, device_name, location, designation, approved, status, valid_upto, requested_at, approved_at, approved_by')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error || !data) return normalizeDeviceStatus(null)
  return normalizeDeviceStatus(data)
}

export async function requestDeviceApproval({ deviceId, userId, orgName, deviceName, location, avatarName, designation }) {
  if (!deviceId) return null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://reblyjkgkyjxwnolljkf.supabase.co'
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || ''
  if (!anonKey) {
    throw new Error('Supabase anonymous key is not configured.')
  }

  try {
    const checkUrl = `${supabaseUrl}/rest/v1/user_devices?device_id=eq.${encodeURIComponent(deviceId)}&select=id,approved,status`
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    })

    if (!checkResponse.ok) {
      const body = await checkResponse.text()
      throw new Error(`Device lookup failed: ${checkResponse.status} ${body}`)
    }

    const existingData = await checkResponse.json()
    const existing = Array.isArray(existingData) && existingData.length ? existingData[0] : null
    if (existing?.approved) {
      return existing
    }

    const payload = {
      device_id: deviceId,
      user_id: userId || null,
      org_name: orgName || null,
      user_name: deviceName || null,
      device_name: deviceName || null,
      location: location || null,
      designation: designation || null,
      approved: false,
      status: 'pending',
      requested_at: new Date().toISOString(),
      approved_at: null,
      approved_by: null,
      valid_upto: null,
    }

    if (existing) {
      return existing
    }

    const baseUrl = `${supabaseUrl}/rest/v1/user_devices`
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    if (!response.ok) {
      throw new Error(`Approval request failed: ${response.status} ${responseText}`)
    }

    const data = responseText ? JSON.parse(responseText) : null
    return Array.isArray(data) ? data[0] : data
  } catch (error) {
    console.error('[requestDeviceApproval] Error:', error?.message || error)
    throw error
  }
}

export async function updateDeviceApproval({ id, approved, approvedBy, validUpto }) {
  const payload = {
    approved,
    status: approved ? 'approved' : 'rejected',
    approved_by: approvedBy || null,
    approved_at: approved ? new Date().toISOString() : null,
    valid_upto: validUpto || null,
  }

  const { data, error } = await supabase
    .from('user_devices')
    .update(payload)
    .eq('id', id)
    .select('id, device_id, approved, status, valid_upto')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateDeviceInfo({ id, deviceName, location }) {
  const payload = {}
  if (deviceName !== undefined) payload.device_name = deviceName || null
  if (location !== undefined) payload.location = location || null
  if (!Object.keys(payload).length) return null

  const { data, error } = await supabase
    .from('user_devices')
    .update(payload)
    .eq('id', id)
    .select('id, device_name, location')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listDevicesForAdmin() {
  const { data, error } = await supabase
    .from('user_devices')
    .select('id, device_id, user_id, org_name, user_name, device_name, location, designation, registered_at, approved, approved_by, approved_at, status, requested_at, valid_upto')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Fallback lookup by user_id — used when the device_id was lost (cache/cookie
// cleared). If the user previously registered on any device, reuse that info
// and silently re-associate the new device_id.
export async function checkDeviceRegisteredByUser(userId) {
  if (!userId) return null
  // Prefer the most-recent row that has avatar_name set; fall back to overall most-recent
  const { data: recent } = await adminSupabase
    .from('user_devices')
    .select('org_name, user_name, location, designation')
    .eq('user_id', userId)
    .order('registered_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return recent || null
}

export async function saveDevice({ deviceId, userId, orgName, userName, location, avatarName, designation }) {
  const payload = {
    device_id: deviceId,
    user_id: userId,
    org_name: orgName,
    user_name: userName || null,
    device_name: userName || null,
    location: location || null,
    designation: designation || null,
    approved: false,
    status: 'pending',
    requested_at: new Date().toISOString(),
    approved_at: null,
    approved_by: null,
    valid_upto: null,
  }

  const { data: existing } = await supabase
    .from('user_devices')
    .select('id, approved, status')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (existing?.approved) {
    payload.approved = true
    payload.status = 'approved'
  }

  const { error } = await supabase
    .from('user_devices')
    .upsert(payload, { onConflict: 'device_id' })
  if (error) throw error

  if (userId) {
    const updatePayload = {}
    if (designation != null) updatePayload.designation = designation
    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from('user_devices')
        .update(updatePayload)
        .eq('user_id', userId)
        .neq('device_id', deviceId)
    }
  }
}

/* Tag the most recent untagged login log for this user with device details.
   Retries up to 6×1 s to handle fire-and-forget insert timing. */
export async function tagLoginWithDevice(userId, { deviceId, userName, location, org, designation }) {
  if (!userId) return
  for (let i = 0; i < 6; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000))
    const { data } = await adminSupabase
      .from('login_logs')
      .select('id')
      .eq('user_id', userId)
      .is('device_id', null)
      .order('login_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.id) {
      const update = { device_id: deviceId, user_name: userName, location, org }
      if (designation != null) update.designation = designation
      await adminSupabase
        .from('login_logs')
        .update(update)
        .eq('id', data.id)
      return
    }
  }
}

// ── Location manual override ──────────────────────────────────────────────────

/* Manually correct location for a log row, and overwrite the local geo cache
   so the next login on this device uses the corrected value. */
export async function updateLoginLogLocation(id, { city, region, country }) {
  const { error } = await adminSupabase
    .from('login_logs')
    .update({ city: city || null, region: region || null, country: country || null })
    .eq('id', id)
  if (error) throw error
  // Persist correction into geo cache so future logins on this device are accurate
  writeGeoCache({ source: 'manual', ipAddress: null, city: city || null, region: region || null, country: country || null })
}

/* Admin read — paginated, filterable */
export async function getLoginLogs({ limit = 50, offset = 0, email = '', role = '' } = {}) {
  let q = supabase
    .from('login_logs')
    .select('*', { count: 'exact' })
    .order('login_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (email) q = q.ilike('email', `%${email}%`)
  if (role)  q = q.eq('user_role', role)

  const { data, count, error } = await q
  if (error) {
    console.error('[loginLogs] getLoginLogs error:', error)
    throw error
  }
  return { data: data || [], count: count || 0 }
}
