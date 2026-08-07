import { supabase, adminSupabase } from './supabase'

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

/** Session row only — no IP or geo lookup (Church-CMS shape, privacy-safe). */
export async function insertLoginLog({ userId, email, fullName, role, userAgent, loginType = 'trustgate' }) {
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const { browser, os } = detectBrowserInfo(ua)

  const payload = {
    user_id:    userId,
    email,
    full_name:  fullName || null,
    user_role:  role || null,
    user_agent: ua || null,
    browser,
    os,
    login_type: loginType,
  }

  const { data, error } = await supabase
    .from('login_logs')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.error('[loginLogs] insert error:', error)
    return null
  }
  return data?.id ?? null
}

export async function stampLogout(userId) {
  if (!userId) return

  const { data, error: fetchErr } = await supabase
    .from('login_logs')
    .select('id, login_at')
    .eq('user_id', userId)
    .is('logout_at', null)
    .order('login_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchErr || !data?.id) return

  const loginAtMs = data.login_at ? new Date(data.login_at).getTime() : Date.now()
  const durationSeconds = Math.max(0, Math.round((Date.now() - loginAtMs) / 1000))

  const { error } = await supabase
    .from('login_logs')
    .update({ logout_at: new Date().toISOString(), duration_seconds: durationSeconds })
    .eq('id', data.id)
    .eq('user_id', userId)

  if (error) console.error('[loginLogs] logout stamp error:', error)
}

export async function tagLoginWithDevice(userId, { deviceId, userName, location, org, designation }) {
  if (!userId) return
  for (let i = 0; i < 6; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000))
    const { data } = await supabase
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
      await supabase.from('login_logs').update(update).eq('id', data.id).eq('user_id', userId)
      return
    }
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

  if (isApproved && row.valid_upto) {
    const validUpto = new Date(row.valid_upto)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (validUpto < today) {
      return { exists: true, approved: false, status: 'expired', row, isExpired: true }
    }
  }

  const status = row.status || (isApproved ? 'approved' : 'pending')
  return { exists: true, approved: isApproved, status, row, isExpired: false }
}

/** WMS: only treat device as registered when TrustGate approval is active. */
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

export async function checkDeviceRegisteredByUser(userId) {
  if (!userId) return null
  const { data: recent } = await adminSupabase
    .from('user_devices')
    .select('org_name, user_name, location, avatar_name')
    .eq('user_id', userId)
    .order('registered_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!recent) return null
  if (recent.avatar_name) return recent
  const { data: withAvatar } = await adminSupabase
    .from('user_devices')
    .select('avatar_name')
    .eq('user_id', userId)
    .not('avatar_name', 'is', null)
    .limit(1)
    .maybeSingle()
  return { ...recent, avatar_name: withAvatar?.avatar_name || null }
}

export async function saveDevice({ deviceId, userId, orgName, userName, location, avatarName, designation }) {
  let resolvedAvatar = avatarName || null

  if (!resolvedAvatar && userId) {
    const { data: existing } = await adminSupabase
      .from('user_devices')
      .select('avatar_name')
      .eq('user_id', userId)
      .not('avatar_name', 'is', null)
      .limit(1)
      .maybeSingle()
    resolvedAvatar = existing?.avatar_name || null
  }

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
  if (resolvedAvatar) payload.avatar_name = resolvedAvatar

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

  if (userId && resolvedAvatar) {
    await adminSupabase
      .from('user_devices')
      .update({ avatar_name: resolvedAvatar })
      .eq('user_id', userId)
      .neq('device_id', deviceId)
  }
}

export async function updateLoginLogLocation(id, { city, region, country }) {
  const { error } = await adminSupabase
    .from('login_logs')
    .update({ city: city || null, region: region || null, country: country || null })
    .eq('id', id)
  if (error) throw error
}

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
