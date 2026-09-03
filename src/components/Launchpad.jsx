import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createDesktopApp, nameFromUrl, normalizeAppUrl } from '../utils/desktop'
import { resolveSiteMetadata } from '../services/siteMetadata'
import { AppIcon } from './AppIcon'

function mergeCollisionDetection(args) {
  const withoutActive = (collisions) => collisions.filter(({ id }) => id !== args.active.id)
  if (args.pointerCoordinates) return withoutActive(pointerWithin(args))
  return withoutActive(closestCenter(args))
}

const AppTile = memo(function AppTile({ item, index, onOpen, onContextMenu, fallbackIsOver }) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: item.id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: item.id })
  const setNodeRef = useCallback((node) => {
    setDragRef(node)
    setDropRef(node)
  }, [setDragRef, setDropRef])

  return (
    <button
      ref={setNodeRef}
      className={`app-tile${isDragging ? ' drag-origin' : ''}${(isOver || fallbackIsOver) && !isDragging ? ' drop-target merge-ready' : ''}`}
      style={{ '--index': index }}
      type="button"
      data-app-tile
      data-id={item.id}
      aria-label={item.type === 'folder' ? `打开文件夹 ${item.name}` : `打开 ${item.name}`}
      onClick={() => onOpen(item)}
      onContextMenu={(event) => onContextMenu(event, item)}
      {...attributes}
      {...listeners}
    >
      <AppIcon item={item} />
      <span className="app-name">{item.name}</span>
    </button>
  )
})

function AddAppTile({ index, onClick }) {
  return (
    <button
      className="app-tile add-app-tile"
      style={{ '--index': index }}
      type="button"
      data-app-tile
      aria-label="添加网页快捷入口"
      onClick={onClick}
    >
      <span className="app-icon add-app-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
      </span>
      <span className="app-name">添加</span>
    </button>
  )
}

function FolderModal({ folder, onClose, onRename, onDissolve }) {
  const [draftName, setDraftName] = useState(folder?.name || '')

  useEffect(() => setDraftName(folder?.name || ''), [folder?.id, folder?.name])
  if (!folder) return null

  const commitName = () => {
    const nextName = draftName.trim()
    if (nextName) onRename(folder.id, nextName)
    else setDraftName(folder.name)
  }

  return (
    <div className="folder-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="folder-modal" role="dialog" aria-modal="true" aria-labelledby="folder-title">
        <div className="folder-head">
          <div className="folder-title-block">
            <span className="launcher-kicker">FOLDER</span>
            <form
              className="folder-title-form"
              onSubmit={(event) => { event.preventDefault(); commitName(); event.currentTarget.elements.name.blur() }}
            >
              <input
                id="folder-title"
                name="name"
                value={draftName}
                maxLength={24}
                aria-label="文件夹名称"
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={commitName}
              />
              <span className="rename-hint">点击名称重命名</span>
            </form>
          </div>
          <div className="folder-actions">
            <button
              className="folder-dissolve"
              type="button"
              onClick={() => {
                onDissolve(folder.id)
                onClose()
              }}
            >
              解散文件夹
            </button>
            <button className="launcher-close" type="button" aria-label="关闭文件夹" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="folder-grid">
          {folder.items.map((app, index) => (
            <button
              className="app-tile"
              style={{ '--index': index }}
              type="button"
              key={app.id}
              onClick={() => app.url && window.open(app.url, '_blank', 'noopener')}
            >
              <AppIcon item={app} />
              <span className="app-name">{app.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function AppFormModal({ item, onClose, onSave }) {
  const isEditing = Boolean(item)
  const [url, setUrl] = useState(item?.url || '')
  const [name, setName] = useState(item?.name || '')
  const [icon, setIcon] = useState(item?.icon || '')
  const [error, setError] = useState('')
  const [resolving, setResolving] = useState(false)
  const requestRef = useRef(null)

  useEffect(() => () => requestRef.current?.abort(), [])

  const preview = useMemo(() => {
    try {
      const normalizedUrl = normalizeAppUrl(url)
      return {
        id: 'new-app-preview',
        name: name.trim() || nameFromUrl(normalizedUrl),
        url: normalizedUrl,
        icon: icon.trim() || undefined,
        color: '#526984',
      }
    } catch {
      return { id: 'new-app-preview', name: name.trim() || '新 App', url: '', icon: icon.trim() || undefined, color: '#526984' }
    }
  }, [icon, name, url])

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    let normalizedUrl
    try {
      normalizedUrl = normalizeAppUrl(url)
    } catch (validationError) {
      setError(validationError.message)
      return
    }

    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setResolving(true)

    try {
      const metadata = await resolveSiteMetadata(normalizedUrl, { signal: controller.signal })
      onSave(createDesktopApp({
        url: normalizedUrl,
        name,
        icon,
        title: metadata.title,
        resolvedIcon: metadata.icon,
      }, isEditing ? () => item.id : undefined))
      onClose()
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError('暂时无法读取网站信息，请稍后再试')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="folder-backdrop add-app-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="add-app-modal" role="dialog" aria-modal="true" aria-labelledby="app-form-title">
        <header className="add-app-head">
          <div>
            <span className="launcher-kicker">{isEditing ? 'EDIT SHORTCUT' : 'NEW SHORTCUT'}</span>
            <h2 id="app-form-title">{isEditing ? '编辑网页' : '添加网页'}</h2>
          </div>
          <button className="launcher-close" type="button" aria-label="关闭添加窗口" onClick={onClose}>×</button>
        </header>

        <form className="add-app-form" onSubmit={submit}>
          <div className="add-app-preview" aria-hidden="true">
            <AppIcon item={preview} />
            <span>{preview.name}</span>
          </div>

          <div className="add-app-fields">
            <label>
              <span>网址</span>
              <input
                autoFocus
                inputMode="url"
                placeholder="example.com"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
            <label>
              <span>名称 <i>可选</i></span>
              <input maxLength={40} placeholder="留空自动读取网页标题" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>图标地址 <i>可选</i></span>
              <input inputMode="url" placeholder="留空自动读取网站图标" value={icon} onChange={(event) => setIcon(event.target.value)} />
            </label>
          </div>

          <div className="add-app-actions">
            <span className={`add-app-status${error ? ' error' : ''}`}>{error || '名称和图标留空时，会自动读取网站信息'}</span>
            <button type="submit" disabled={resolving}>{resolving ? '正在读取…' : isEditing ? '保存修改' : '添加 App'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function Launchpad({ open, items, onClose, onMerge, onRenameFolder, onDissolveFolder, onAddApp, onEditApp }) {
  const [folderId, setFolderId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingAppId, setEditingAppId] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [fallbackOverId, setFallbackOverId] = useState(null)
  const gridRef = useRef(null)
  const previousPositions = useRef(new Map())
  const suppressClickUntil = useRef(0)
  const fallbackOverRef = useRef(null)
  const activeItem = items.find((item) => item.id === activeId)
  const openFolder = items.find((item) => item.id === folderId && item.type === 'folder')
  const editingApp = items.find((item) => item.id === editingAppId && item.type !== 'folder')
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    if (!open) {
      setFolderId(null)
      setAddOpen(false)
      setEditingAppId(null)
      setContextMenu(null)
      setActiveId(null)
      setFallbackOverId(null)
      fallbackOverRef.current = null
    }
  }, [open])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || !open) return
      if (editingAppId) setEditingAppId(null)
      else if (addOpen) setAddOpen(false)
      else if (contextMenu) setContextMenu(null)
      else if (folderId) setFolderId(null)
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [addOpen, contextMenu, editingAppId, folderId, onClose, open])

  useLayoutEffect(() => {
    if (!previousPositions.current.size || !gridRef.current) return
    gridRef.current.querySelectorAll('[data-id]').forEach((tile) => {
      const previous = previousPositions.current.get(tile.dataset.id)
      if (!previous) return
      const current = tile.getBoundingClientRect()
      const x = previous.left - current.left
      const y = previous.top - current.top
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return
      tile.animate(
        [{ transform: `translate3d(${x}px, ${y}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: 330, easing: 'cubic-bezier(.22,1,.36,1)' },
      )
    })
    previousPositions.current.clear()
  }, [items])

  const capturePositions = () => {
    previousPositions.current = new Map(
      [...(gridRef.current?.querySelectorAll('[data-id]') || [])]
        .map((tile) => [tile.dataset.id, tile.getBoundingClientRect()]),
    )
  }

  const openItem = useCallback((item) => {
    if (Date.now() < suppressClickUntil.current) return
    if (item.type === 'folder') setFolderId(item.id)
    else if (item.url) window.open(item.url, '_blank', 'noopener')
  }, [])

  const openContextMenu = (event, item) => {
    event.preventDefault()
    if (item.type === 'folder') {
      setFolderId(item.id)
      return
    }

    const width = 178
    setContextMenu({
      itemId: item.id,
      x: Math.min(event.clientX, window.innerWidth - width - 12),
      y: Math.min(event.clientY, window.innerHeight - 58),
    })
  }

  const handleLauncherPointerDown = (event) => {
    if (event.target.closest('[data-app-tile], .folder-modal, .add-app-modal, .app-context-menu')) return
    if (contextMenu) setContextMenu(null)
    else onClose()
  }

  const updateFallbackOver = (event) => {
    if (!activeId) return
    const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-id]')
    const nextId = tile?.dataset.id && tile.dataset.id !== activeId ? tile.dataset.id : null
    if (nextId === fallbackOverRef.current) return
    fallbackOverRef.current = nextId
    setFallbackOverId(nextId)
  }

  const clearFallbackOver = () => {
    fallbackOverRef.current = null
    setFallbackOverId(null)
  }

  const finishDrag = ({ active, over }) => {
    const targetId = over?.id || fallbackOverRef.current
    setActiveId(null)
    clearFallbackOver()
    suppressClickUntil.current = Date.now() + 320
    if (!targetId || active.id === targetId) return
    capturePositions()
    onMerge(active.id, targetId)
    navigator.vibrate?.(10)
  }

  return (
    <section
      className={`launcher${open ? ' show opening' : ''}`}
      aria-label="应用快捷入口"
      aria-hidden={!open}
      onPointerDown={handleLauncherPointerDown}
      onPointerMoveCapture={updateFallbackOver}
    >
      <div className="launcher-stage">
        <DndContext
          sensors={sensors}
          collisionDetection={mergeCollisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
          autoScroll={false}
          onDragStart={({ active }) => {
            suppressClickUntil.current = Date.now() + 260
            clearFallbackOver()
            setActiveId(active.id)
          }}
          onDragEnd={finishDrag}
          onDragCancel={() => {
            setActiveId(null)
            clearFallbackOver()
          }}
        >
          <div className="app-grid" id="app-grid" ref={gridRef}>
            <AddAppTile index={0} onClick={() => setAddOpen(true)} />
            {items.map((item, index) => (
              <AppTile
                key={item.id}
                item={item}
                index={index + 1}
                onOpen={openItem}
                onContextMenu={openContextMenu}
                fallbackIsOver={fallbackOverId === item.id}
              />
            ))}
          </div>
          {createPortal(
            <DragOverlay adjustScale={false} dropAnimation={null}>
              {activeItem ? (
                <div className="app-tile app-drag-overlay" aria-hidden="true">
                  <AppIcon item={activeItem} />
                  <span className="app-name">{activeItem.name}</span>
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      </div>
      <FolderModal
        folder={openFolder}
        onClose={() => setFolderId(null)}
        onRename={onRenameFolder}
        onDissolve={onDissolveFolder}
      />
      {contextMenu && (
        <div className="app-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setEditingAppId(contextMenu.itemId)
              setContextMenu(null)
            }}
          >
            编辑 App
          </button>
        </div>
      )}
      {addOpen && <AppFormModal onClose={() => setAddOpen(false)} onSave={onAddApp} />}
      {editingApp && <AppFormModal item={editingApp} onClose={() => setEditingAppId(null)} onSave={onEditApp} />}
    </section>
  )
}
