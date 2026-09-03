import { useCallback, useEffect, useState } from 'react'
import { ClockSearch } from './components/ClockSearch'
import { Launchpad } from './components/Launchpad'
import { loadApps } from './data/apps'
import { useBingWallpaper } from './hooks/useBingWallpaper'
import { mergeApps, renameFolder } from './utils/desktop'

const DESKTOP_STORAGE = 'leave-space-desktop-apps'

export default function App() {
  const wallpaper = useBingWallpaper()
  const [launchpadOpen, setLaunchpadOpen] = useState(false)
  const [items, setItems] = useState(() => loadApps(DESKTOP_STORAGE))

  useEffect(() => {
    localStorage.setItem(DESKTOP_STORAGE, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    document.body.classList.toggle('launcher-open', launchpadOpen)
    return () => document.body.classList.remove('launcher-open')
  }, [launchpadOpen])

  const merge = useCallback((sourceId, targetId) => {
    setItems((current) => mergeApps(current, sourceId, targetId))
  }, [])

  const rename = useCallback((folderId, name) => {
    setItems((current) => renameFolder(current, folderId, name))
  }, [])

  return (
    <>
      <div
        className={`wallpaper${wallpaper ? ' ready' : ''}`}
        style={wallpaper ? { backgroundImage: `url("${wallpaper}")` } : undefined}
        aria-hidden="true"
      />
      <div className="shade" aria-hidden="true" />

      <main
        className="start-page"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setLaunchpadOpen(true)
        }}
      >
        <ClockSearch />
      </main>

      <Launchpad
        open={launchpadOpen}
        items={items}
        onClose={() => setLaunchpadOpen(false)}
        onMerge={merge}
        onRenameFolder={rename}
      />
      <p className="sr-only" aria-live="polite">{wallpaper ? '今日 Bing 壁纸已加载' : '正在加载今日壁纸'}</p>
    </>
  )
}
