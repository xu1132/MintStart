import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { faviconUrl } from '../data/apps'

const ICON_LOAD_TIMEOUT_MS = 2000

function WebIcon({ app, mini = false }) {
  const sources = useMemo(
    () => [...new Set([app.icon, faviconUrl(app.url)].filter(Boolean))],
    [app.icon, app.url],
  )
  const [sourceIndex, setSourceIndex] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const timeoutRef = useRef(0)
  const src = timedOut ? undefined : sources[sourceIndex]

  useEffect(() => {
    setSourceIndex(0)
    setTimedOut(false)
    window.clearTimeout(timeoutRef.current)
    if (sources.length) {
      timeoutRef.current = window.setTimeout(() => setTimedOut(true), ICON_LOAD_TIMEOUT_MS)
    }
    return () => window.clearTimeout(timeoutRef.current)
  }, [app.icon, app.url, sources.length])

  return (
    <span
      className={mini ? 'mini-app-icon' : 'app-icon'}
      style={{ '--app-color': app.color || '#56677e', '--app-ink': app.darkText ? '#1b2430' : '#fff' }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable="false"
          onLoad={() => window.clearTimeout(timeoutRef.current)}
          onError={() => setSourceIndex((index) => index + 1)}
        />
      ) : (
        <span className="app-monogram">{app.mono || app.name?.slice(0, 1)}</span>
      )}
    </span>
  )
}

function FolderIcon({ folder }) {
  const previewItems = folder.items.slice(0, 4)
  const isPair = previewItems.length === 2

  return (
    <span className="app-icon folder-icon">
      <span className={`folder-icon-grid${isPair ? ' count-2' : ''}`}>
        {isPair
          ? previewItems.map((app) => <WebIcon app={app} mini key={app.id} />)
          : Array.from({ length: 4 }, (_, index) => {
              const app = previewItems[index]
              return app
                ? <WebIcon app={app} mini key={app.id} />
                : <span className="mini-app-icon mini-app-placeholder" aria-hidden="true" key={`empty-${index}`} />
            })}
      </span>
      <i className="folder-count">{folder.items.length}</i>
    </span>
  )
}

function AppIconComponent({ item, mini = false }) {
  if (item.type === 'folder' && !mini) return <FolderIcon folder={item} />
  return <WebIcon app={item} mini={mini} />
}

export const AppIcon = memo(AppIconComponent)
