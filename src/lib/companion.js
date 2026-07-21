const COMPANION_STATUS_URL = 'http://127.0.0.1:65432/status'
const COMPANION_CHECK_TIMEOUT_MS = 3500

export async function fetchCompanionStatus() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), COMPANION_CHECK_TIMEOUT_MS)
  try {
    const response = await fetch(COMPANION_STATUS_URL, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    if (!response.ok) return null
    const payload = await response.json()
    return payload
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
