import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppIcon } from './AppIcon'

const DRAG_THRESHOLD = 7
const MERGE_DWELL = 240
const DROP_DURATION = 180

const AppTile = memo(function AppTile({ item, index, onOpen, onDragStart }) {
  return (
    <button
      className="app-tile"
      style={{ '--index': index }}
      type="button"
      data-app-tile
      data-id={item.id}
      aria-label={item.type === 'folder' ? `打开文件夹 ${item.name}` : `打开 ${item.name}`}
      onClick={() => onOpen(item)}
      onPointerDown={(event) => onDragStart(event, item.id)}
    >
      <AppIcon item={item} />
      <span className="app-name">{item.name}</span>
    </button>
  )
})

function FolderModal({ folder, onClose, onRename }) {
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
          <button className="launcher-close" type="button" aria-label="关闭文件夹" onClick={onClose}>×</button>
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

export function Launchpad({ open, items, onClose, onMerge, onRenameFolder }) {
  const [folderId, setFolderId] = useState(null)
  const suppressClickUntil = useRef(0)
  const gridRef = useRef(null)
  const previousPositions = useRef(new Map())
  const openFolder = items.find((item) => item.id === folderId && item.type === 'folder')

  useEffect(() => {
    if (!open) setFolderId(null)
  }, [open])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || !open) return
      if (folderId) setFolderId(null)
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [folderId, onClose, open])

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
    const positions = new Map()
    gridRef.current?.querySelectorAll('[data-id]').forEach((tile) => {
      positions.set(tile.dataset.id, tile.getBoundingClientRect())
    })
    previousPositions.current = positions
  }

  const openItem = useCallback((item) => {
    if (Date.now() < suppressClickUntil.current) return
    if (item.type === 'folder') setFolderId(item.id)
    else if (item.url) window.open(item.url, '_blank', 'noopener')
  }, [])

  const beginDrag = useCallback((pointerEvent, sourceId) => {
    if (pointerEvent.button !== 0) return
    const source = pointerEvent.currentTarget
    const sourceRect = source.getBoundingClientRect()
    const pointerId = pointerEvent.pointerId
    const startX = pointerEvent.clientX
    const startY = pointerEvent.clientY
    let dragging = false
    let ghost = null
    let target = null
    let targetTimer = 0
    let animationFrame = 0
    let nextX = 0
    let nextY = 0
    let clientX = pointerEvent.clientX
    let clientY = pointerEvent.clientY

    source.setPointerCapture(pointerId)

    const createGhost = () => {
      ghost = source.cloneNode(true)
      ghost.removeAttribute('data-id')
      ghost.removeAttribute('data-app-tile')
      ghost.className = 'app-tile app-drag-ghost'
      Object.assign(ghost.style, {
        left: `${sourceRect.left}px`,
        top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
      })
      document.body.appendChild(ghost)
      source.classList.add('drag-origin')
      requestAnimationFrame(() => ghost?.classList.add('lifted'))
    }

    const clearTarget = () => {
      window.clearTimeout(targetTimer)
      target?.classList.remove('drop-target', 'merge-ready', 'accepting')
      target = null
    }

    const setTarget = (nextTarget) => {
      if (target === nextTarget) return
      clearTarget()
      if (!nextTarget) return
      target = nextTarget
      target.classList.add('drop-target')
      targetTimer = window.setTimeout(() => {
        target?.classList.add('merge-ready')
        navigator.vibrate?.(10)
      }, MERGE_DWELL)
    }

    const paint = () => {
      animationFrame = 0
      if (!ghost) return
      ghost.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(1.08)`
      const hovered = document.elementFromPoint(clientX, clientY)?.closest('[data-app-tile]')
      setTarget(hovered && hovered !== source && hovered.closest('#app-grid') ? hovered : null)
    }

    const onMove = (event) => {
      nextX = event.clientX - startX
      nextY = event.clientY - startY
      clientX = event.clientX
      clientY = event.clientY
      if (!dragging && Math.hypot(nextX, nextY) < DRAG_THRESHOLD) return
      if (!dragging) {
        dragging = true
        createGhost()
      }
      if (!animationFrame) animationFrame = requestAnimationFrame(paint)
    }

    const cleanup = () => {
      source.classList.remove('drag-origin')
      ghost?.remove()
      ghost = null
    }

    const finish = () => {
      cancelAnimationFrame(animationFrame)
      source.removeEventListener('pointermove', onMove)
      source.removeEventListener('pointerup', finish)
      source.removeEventListener('pointercancel', finish)
      source.releasePointerCapture?.(pointerId)
      if (!dragging) return

      suppressClickUntil.current = Date.now() + 320
      const targetElement = target
      const targetId = targetElement?.dataset.id
      window.clearTimeout(targetTimer)

      if (targetElement && targetId && ghost) {
        const targetRect = targetElement.getBoundingClientRect()
        const destinationX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2)
        const destinationY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2)
        targetElement.classList.add('accepting')
        ghost.classList.add('dropping')
        ghost.style.transform = `translate3d(${destinationX}px, ${destinationY}px, 0) scale(.34)`
        ghost.style.opacity = '0'
        capturePositions()
        window.setTimeout(() => {
          clearTarget()
          cleanup()
          onMerge(sourceId, targetId)
        }, DROP_DURATION)
      } else if (ghost) {
        clearTarget()
        ghost.classList.add('returning')
        ghost.style.transform = 'translate3d(0, 0, 0) scale(1)'
        ghost.style.opacity = '0'
        window.setTimeout(cleanup, DROP_DURATION)
      } else {
        clearTarget()
        cleanup()
      }
    }

    source.addEventListener('pointermove', onMove)
    source.addEventListener('pointerup', finish)
    source.addEventListener('pointercancel', finish)
  }, [onMerge])

  return (
    <section
      className={`launcher${open ? ' show opening' : ''}`}
      aria-label="应用快捷入口"
      aria-hidden={!open}
      onPointerDown={(event) => !event.target.closest('[data-app-tile], .folder-modal') && onClose()}
    >
      <div className="launcher-stage">
        <div className="app-grid" id="app-grid" ref={gridRef}>
          {items.map((item, index) => (
            <AppTile key={item.id} item={item} index={index} onOpen={openItem} onDragStart={beginDrag} />
          ))}
        </div>
        <div className="page-indicator" aria-hidden="true"><span className="active" /><span /></div>
      </div>
      <FolderModal
        folder={openFolder}
        onClose={() => setFolderId(null)}
        onRename={onRenameFolder}
      />
    </section>
  )
}
