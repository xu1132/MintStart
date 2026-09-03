import { useEffect, useState } from 'react'

const BING_ARCHIVE = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN'
const BING_FALLBACK_API = 'https://bing.biturl.top/?resolution=UHD&format=json&index=0&mkt=zh-CN'
const CACHE_KEY = 'leave-space-bing-wallpaper'

function localDateKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function fallbackWallpaper(date) {
  return `https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN&date=${date}`
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  } catch {
    return null
  }
}

export function useBingWallpaper() {
  const [wallpaper, setWallpaper] = useState(() => {
    const cached = readCache()
    const today = localDateKey()
    return cached?.date === today && cached.url ? cached.url : fallbackWallpaper(today)
  })

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
        try {
          const response = await fetch(`${BING_FALLBACK_API}&_=${Date.now()}`, { cache: 'no-store' })
          if (!response.ok) throw new Error('Fallback wallpaper request failed')
          const image = await response.json()
          if (!image.url) throw new Error('No fallback image returned')
          localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, url: image.url, copyright: image.copyright }))
          if (!cancelled) setWallpaper(image.url)
        } catch {
          const fallback = fallbackWallpaper(today)
          localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, url: fallback }))
          if (!cancelled) setWallpaper(fallback)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return wallpaper
}
