import { useEffect, useState } from 'react'

const BING_ARCHIVE = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN'
const CACHE_KEY = 'leave-space-bing-wallpaper'

function localDateKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  } catch {
    return null
  }
}

export function useBingWallpaper() {
  const [wallpaper, setWallpaper] = useState(() => readCache()?.url || '')

  useEffect(() => {
    let cancelled = false
    const cached = readCache()
    const today = localDateKey()

    if (cached?.date === today && cached.url) {
      setWallpaper(cached.url)
      return undefined
    }

    async function load() {
      try {
        const response = await fetch(`${BING_ARCHIVE}&_=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Bing wallpaper request failed')
        const data = await response.json()
        const image = data.images?.[0]
        if (!image?.url) throw new Error('No Bing image returned')
        const url = new URL(image.url, 'https://www.bing.com').href
        localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, url, copyright: image.copyright }))
        if (!cancelled) setWallpaper(url)
      } catch {
        if (!cancelled && cached?.url) setWallpaper(cached.url)
        if (!cancelled && !cached?.url) setWallpaper('https://bing.biturl.top/?resolution=1920&format=image')
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return wallpaper
}
