import { nameFromUrl, normalizeAppUrl } from '../utils/desktop'

const MICROLINK_API = 'https://api.microlink.io'
const METADATA_TIMEOUT_MS = 2000

export async function resolveSiteMetadata(rawUrl, { signal } = {}) {
  const url = normalizeAppUrl(rawUrl)
  const fallback = { title: nameFromUrl(url), icon: '' }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  try {
    const endpoint = new URL(MICROLINK_API)
    endpoint.searchParams.set('url', url)
    const response = await fetch(endpoint, { signal: controller.signal })
    if (!response.ok) return fallback

    const payload = await response.json()
    return {
      title: payload.data?.title?.trim() || fallback.title,
      icon: payload.data?.logo?.url || '',
    }
  } catch (error) {
    if (signal?.aborted) throw error
    return fallback
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
