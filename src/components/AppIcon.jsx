import { memo, useState } from 'react'
import { faviconUrl } from '../data/apps'

function WebIcon({ app, mini = false }) {
  const [failed, setFailed] = useState(false)
  const src = faviconUrl(app.url)

  return (
    <span
      className={mini ? 'mini-app-icon' : 'app-icon'}
      style={{ '--app-color': app.color || '#56677e', '--app-ink': app.darkText ? '#1b2430' : '#fff' }}
    >
      {!failed && src ? (
        <img src={src} alt="" draggable="false" onError={() => setFailed(true)} />
      ) : (
        <span className="app-monogram">{app.mono || app.name?.slice(0, 1)}</span>
      )}
    </span>
  )
}

function FolderIcon({ folder }) {
  return (
    <span className="app-icon folder-icon">
      <span className="folder-icon-grid">
        {folder.items.slice(0, 4).map((app) => <WebIcon app={app} mini key={app.id} />)}
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
