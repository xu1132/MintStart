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

const PAGE_ROWS = 3
const PAGE_COLUMNS = 5
const PAGE_CAPACITY = PAGE_COLUMNS * PAGE_ROWS
const PAGE_SWITCH_EASING = 'cubic-bezier(.4,0,.2,1)'
const PAGE_SWITCH_TRANSITION = `transform 300ms ${PAGE_SWITCH_EASING}`
const PAGE_INDICATOR_STEP = 17
// 两页之间保留"走不通"的留白段：越过 FULL_FRACTION 才翻页，
// 因此纯位移最多到 (FULL - RESIST)/2，永远到不了整页——没卡住一说。
const PAGE_COMMIT_FULL_FRACTION = 0.24
const PAGE_COMMIT_RESIST_FRACTION = 0.09
const PAGE_COMMIT_VELOCITY = 0.32 // px/ms，甩动加速度门槛，与 iOS/macOS 一致手感

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// 档位式橡皮筋映射：小幅跟手 1:1，过零界后位移衰减封顶，
// 手指怎样都到不了下一页（两页之间始终留一段走不通的空白）。
function rubberBandToward(absRaw, width) {
  const full = width * PAGE_COMMIT_FULL_FRACTION
  const resist = width * PAGE_COMMIT_RESIST_FRACTION
  if (absRaw <= full) return absRaw
  return clamp(full + (absRaw - full) * 0.24, full, full + resist)
}

// 硬边界外的橡皮筋（首/末页外侧）：阻尼大、行程短
function rubberBandOverscroll(absRaw) {
  if (absRaw <= 10) return absRaw
  return Math.min(10 + (absRaw - 10) * 0.22, 76)
}

// 松手/停顿时判定：投影过零界 → 下一页；快速甩动 → 也放行；否则弹回
function resolvePageStep({ raw, velocity, width, canPrev, canNext }) {
  const commit = Math.max(60, width * PAGE_COMMIT_FULL_FRACTION)
  const projected = Math.abs(raw + velocity * 80)
  const fling = Math.abs(velocity) > PAGE_COMMIT_VELOCITY
  if (raw < 0) return (projected > commit || fling) && canNext ? 1 : 0
  return (projected > commit || fling) && canPrev ? -1 : 0
}

function panOffsetFor(raw, base, pageCount, width) {
  const atStart = base <= 0
  const atEnd = base >= pageCount - 1
  if (raw < 0) return atEnd ? -rubberBandOverscroll(-raw) : -rubberBandToward(-raw, width)
  return atStart ? rubberBandOverscroll(raw) : rubberBandToward(raw, width)
}

function pageTransform(page, offset = 0) {
  return `translate3d(calc(${-page * 100}% + ${offset}px), 0, 0)`
}

function indicatorTransform(progress) {
  return `translate3d(${progress * PAGE_INDICATOR_STEP - 6.5}px, 0, 0)`
}

function freezeTrack(track, page) {
  const width = track.clientWidth || 1
  const transform = window.getComputedStyle(track).transform
  let currentX = -page * width

  if (transform && transform !== 'none') {
    try {
      currentX = new window.DOMMatrixReadOnly(transform).m41
    } catch {
      const values = transform.match(/matrix(?:3d)?\((.+)\)/)?.[1]?.split(',').map(Number)
      if (values?.length === 6) currentX = values[4]
      else if (values?.length === 16) currentX = values[12]
    }
  }

  track.style.transition = 'none'
  track.style.transform = `translate3d(${currentX}px, 0, 0)`
  return currentX + page * width
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

function AppFormModal({ item, onClose, onSave, onResolve }) {
  const isEditing = Boolean(item)
  const [url, setUrl] = useState(item?.url || '')
  const [name, setName] = useState(item?.name || '')
  const [icon, setIcon] = useState(item?.icon || '')
  const [error, setError] = useState('')

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

  const submit = (event) => {
    event.preventDefault()
    setError('')

    let normalizedUrl
    try {
      normalizedUrl = normalizeAppUrl(url)
    } catch (validationError) {
      setError(validationError.message)
      return
    }

    const app = createDesktopApp(
      { url: normalizedUrl, name, icon },
      isEditing ? () => item.id : undefined,
    )
    onSave(app)
    onClose()

    // 后台补全网页标题与图标，不阻塞添加流程
    const needName = !name.trim()
    const needIcon = !icon.trim()
    if (!needName && !needIcon) return
    resolveSiteMetadata(normalizedUrl)
      .then((metadata) => {
        const patch = {}
        if (needName && metadata.title && metadata.title !== app.name) {
          patch.name = metadata.title.slice(0, 40)
          patch.mono = patch.name.slice(0, 1).toUpperCase()
        }
        if (needIcon && metadata.icon) patch.icon = metadata.icon
        if (Object.keys(patch).length) onResolve?.({ ...app, ...patch })
      })
      .catch(() => {})
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
            <span className={`add-app-status${error ? ' error' : ''}`}>{error || '立即添加，名称和图标留空时稍后自动补全'}</span>
            <button type="submit">{isEditing ? '保存修改' : '添加 App'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function Launchpad({ open, items, onClose, onMerge, onRenameFolder, onDissolveFolder, onAddApp, onEditApp, onDeleteApp }) {
  const [folderId, setFolderId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingAppId, setEditingAppId] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [fallbackOverId, setFallbackOverId] = useState(null)
  const capacity = PAGE_CAPACITY
  const [page, setPage] = useState(0)
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const indicatorRef = useRef(null)
  const previousPositions = useRef(new Map())
  const suppressClickUntil = useRef(0)
  const fallbackOverRef = useRef(null)
  const panRef = useRef(null)
  const pageRef = useRef(0)
  const wheelGesture = useRef(null)
  const trackFrame = useRef(0)
  const pendingTrackPosition = useRef(null)
  const activeItem = items.find((item) => item.id === activeId)
  const openFolder = items.find((item) => item.id === folderId && item.type === 'folder')
  const editingApp = items.find((item) => item.id === editingAppId && item.type !== 'folder')

  const pageCount = useMemo(() => Math.max(1, Math.ceil((items.length + 1) / capacity)), [capacity, items.length])
  const pageCountRef = useRef(pageCount)
  pageCountRef.current = pageCount
  pageRef.current = page

  const pages = useMemo(() => {
    const flat = [{ id: '__add__' }, ...items]
    const result = []
    for (let index = 0; index < flat.length; index += capacity) {
      result.push(flat.slice(index, index + capacity))
    }
    return result.length ? result : [[]]
  }, [capacity, items])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const cancelTrackFrame = useCallback(() => {
    if (trackFrame.current) window.cancelAnimationFrame(trackFrame.current)
    trackFrame.current = 0
    pendingTrackPosition.current = null
  }, [])

  const drawTrack = useCallback((base, offset = 0, transition = 'none') => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = transition
    track.style.transform = pageTransform(base, offset)

    const indicator = indicatorRef.current
    if (indicator) {
      const width = track.clientWidth || 1
      const progress = clamp(base - offset / width, 0, pageCountRef.current - 1)
      indicator.style.transition = transition
      indicator.style.transform = indicatorTransform(progress)
    }
  }, [])

  const scheduleTrack = useCallback((base, offset) => {
    pendingTrackPosition.current = { base, offset }
    if (trackFrame.current) return
    trackFrame.current = window.requestAnimationFrame(() => {
      trackFrame.current = 0
      const pending = pendingTrackPosition.current
      pendingTrackPosition.current = null
      if (pending) drawTrack(pending.base, pending.offset)
    })
  }, [drawTrack])

  const settlePage = useCallback((next, velocity = 0) => {
    const target = clamp(next, 0, pageCountRef.current - 1)
    const track = trackRef.current
    cancelTrackFrame()
    panRef.current = null

    if (wheelGesture.current?.timer) window.clearTimeout(wheelGesture.current.timer)
    wheelGesture.current = null

    if (track) {
      const width = track.clientWidth || 1
      const distanceToTarget = Math.abs(freezeTrack(track, target))
      const distanceRatio = clamp(distanceToTarget / width, 0, 1)
      const duration = Math.round(clamp(210 + distanceRatio * 100 - Math.abs(velocity) * 45, 170, 310))
      // 页面与指示器使用同一时长、同一缓动直接落位。
      track.getBoundingClientRect()
      drawTrack(target, 0, `transform ${duration}ms ${PAGE_SWITCH_EASING}`)
    }

    pageRef.current = target
    setPage(target)
  }, [cancelTrackFrame, drawTrack])

  useEffect(() => {
    if (page > pageCount - 1) settlePage(pageCount - 1)
  }, [page, pageCount, settlePage])

  const resetPan = useCallback((targetPage = pageRef.current) => {
    panRef.current = null
    cancelTrackFrame()
    drawTrack(targetPage, 0, PAGE_SWITCH_TRANSITION)
  }, [cancelTrackFrame, drawTrack])

  useEffect(() => () => {
    cancelTrackFrame()
    if (wheelGesture.current?.timer) window.clearTimeout(wheelGesture.current.timer)
  }, [cancelTrackFrame])

  useEffect(() => {
    if (!open) {
      setFolderId(null)
      setAddOpen(false)
      setEditingAppId(null)
      setContextMenu(null)
      setActiveId(null)
      setFallbackOverId(null)
      setPage(0)
      pageRef.current = 0
      fallbackOverRef.current = null
      resetPan(0)
    }
  }, [open, resetPan])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!open) return
      if (event.key === 'Escape') {
        if (editingAppId) setEditingAppId(null)
        else if (addOpen) setAddOpen(false)
        else if (contextMenu) setContextMenu(null)
        else if (folderId) setFolderId(null)
        else onClose()
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (folderId || addOpen || editingAppId || contextMenu) return
        event.preventDefault()
        settlePage(pageRef.current + (event.key === 'ArrowRight' ? 1 : -1))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [addOpen, contextMenu, editingAppId, folderId, onClose, open, settlePage])

  // 横向滚轮（触控板双指横滑）跟手翻页：手指持续跟动，停顿后吸附
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const onWheel = (event) => {
      if (!open || folderId || addOpen || editingAppId || contextMenu) return
      if (event.target.closest('.folder-modal, .add-app-modal, .folder-backdrop')) return
      if (Math.abs(event.deltaX) < 1 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 0.8) return
      event.preventDefault()
      const track = trackRef.current
      if (!track) return
      const width = track.clientWidth || 1
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1
      const delta = event.deltaX * factor
      let gesture = wheelGesture.current
      if (!gesture) {
        const base = pageRef.current
        gesture = {
          base,
          startOffset: freezeTrack(track, base),
          acc: 0,
          samples: [],
          timer: 0,
        }
      }
      window.clearTimeout(gesture.timer)
      gesture.acc = clamp(gesture.acc + delta, -width * 1.08, width * 1.08)
      const now = performance.now()
      gesture.samples.push({ value: gesture.acc, time: now })
      while (gesture.samples.length > 2 && now - gesture.samples[0].time > 90) gesture.samples.shift()
      // 自然滚动：手指向左滑 deltaX>0，内容应向左（取 raw = startOffset - acc）
      const offset = panOffsetFor(
        gesture.startOffset - gesture.acc,
        gesture.base,
        pageCountRef.current,
        width,
      )
      scheduleTrack(gesture.base, offset)
      gesture.timer = window.setTimeout(() => {
        const first = gesture.samples[0]
        const last = gesture.samples[gesture.samples.length - 1]
        const elapsed = last && first ? last.time - first.time : 0
        const velocity = elapsed > 12 ? (last.value - first.value) / elapsed : 0
        const step = resolvePageStep({
          raw: gesture.startOffset - gesture.acc,
          velocity: -velocity,
          width,
          canPrev: gesture.base > 0,
          canNext: gesture.base < pageCountRef.current - 1,
        })
        settlePage(gesture.base + step, -velocity)
      }, 96)
      wheelGesture.current = gesture
    }
    section.addEventListener('wheel', onWheel, { passive: false })
    return () => section.removeEventListener('wheel', onWheel)
  }, [addOpen, contextMenu, editingAppId, folderId, open, scheduleTrack, settlePage])

  // 位置补间动画：同一页内的移动才做 FLIP，跨页跳过
  const pageLocalRect = (tile) => {
    const rect = tile.getBoundingClientRect()
    const pageRect = tile.closest('[data-page]')?.getBoundingClientRect()
    return pageRect
      ? { x: rect.left - pageRect.left, y: rect.top - pageRect.top }
      : { x: rect.left, y: rect.top }
  }

  useLayoutEffect(() => {
    if (!previousPositions.current.size || !trackRef.current) return
    trackRef.current.querySelectorAll('[data-id]').forEach((tile) => {
      const previous = previousPositions.current.get(tile.dataset.id)
      if (!previous) return
      const pageEl = tile.closest('[data-page]')
      if (previous.page !== Number(pageEl?.dataset.page)) return
      const current = pageLocalRect(tile)
      const x = previous.x - current.x
      const y = previous.y - current.y
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return
      tile.animate(
        [{ transform: `translate3d(${x}px, ${y}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: 330, easing: 'cubic-bezier(.22,1,.36,1)' },
      )
    })
    previousPositions.current.clear()
  }, [items])

  const capturePositions = () => {
    const map = new Map()
    trackRef.current?.querySelectorAll('[data-id]').forEach((tile) => {
      const local = pageLocalRect(tile)
      const pageEl = tile.closest('[data-page]')
      map.set(tile.dataset.id, { x: local.x, y: local.y, page: Number(pageEl?.dataset.page) })
    })
    previousPositions.current = map
  }

  const openItem = useCallback((item) => {
    if (Date.now() < suppressClickUntil.current) return
    if (item.type === 'folder') setFolderId(item.id)
    else if (item.url) window.open(item.url, '_blank', 'noopener')
  }, [])

  const openContextMenu = useCallback((event, item) => {
    event.preventDefault()
    if (item.type === 'folder') {
      setFolderId(item.id)
      return
    }

    const width = 178
    setContextMenu({
      itemId: item.id,
      x: Math.min(event.clientX, window.innerWidth - width - 12),
      y: Math.min(event.clientY, window.innerHeight - 100),
    })
  }, [])

  const handlePointerDown = (event) => {
    if (event.target.closest('.folder-backdrop, .folder-modal, .add-app-modal, .app-context-menu, .launcher-dots')) return
    const beginPan = (fromTile) => {
      cancelTrackFrame()
      if (wheelGesture.current?.timer) window.clearTimeout(wheelGesture.current.timer)
      wheelGesture.current = null
      const base = pageRef.current
      const startOffset = trackRef.current ? freezeTrack(trackRef.current, base) : 0
      const now = performance.now()
      panRef.current = {
        x0: event.clientX,
        y0: event.clientY,
        base,
        startOffset,
        mode: null,
        fromTile,
        t0: now,
        trail: [{ x: event.clientX, t: now }],
      }
    }

    if (event.target.closest('[data-app-tile]')) {
      // 鼠标在图标上按下是拖拽；触摸则允许快速横滑翻页（长按仍由 dnd 接管为拖拽）
      if (event.pointerType !== 'touch') return
      if (contextMenu) return
      beginPan(true)
      return
    }
    if (contextMenu) {
      setContextMenu(null)
      return
    }
    // 空白处：可能是点击关闭，也可能是横向滑动翻页的开始
    beginPan(false)
  }

  const handlePointerMove = (event) => {
    if (activeId) return
    const pan = panRef.current
    if (!pan) return
    const coalesced = event.nativeEvent?.getCoalescedEvents?.()
    const point = coalesced?.[coalesced.length - 1] || event
    const dx = point.clientX - pan.x0
    const dy = point.clientY - pan.y0
    if (pan.mode === null) {
      if (Math.hypot(dx, dy) < 7) return
      const horizontal = Math.abs(dx) > Math.abs(dy)
      if (pan.fromTile && !horizontal) {
        panRef.current = null
        return
      }
      // 从图标上起的触摸滑动，只有快速横滑才算翻页手势，慢拖交给 dnd
      if (pan.fromTile && performance.now() - pan.t0 > 150) {
        panRef.current = null
        return
      }
      pan.mode = horizontal ? 'pan' : 'ignore'
      if (pan.mode === 'ignore') {
        panRef.current = null
        return
      }
      if (!pan.captured) {
        try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* noop */ }
        pan.captured = true
      }
    }
    pan.trail.push({ x: point.clientX, t: performance.now() })
    if (pan.trail.length > 10) pan.trail.shift()
    const track = trackRef.current
    if (!track) return
    const width = track.clientWidth || 1
    // 档位式橡皮筋：小幅灵活跟手，过零界后越走越慢、永远走不到下一页
    const offset = panOffsetFor(pan.startOffset + dx, pan.base, pageCountRef.current, width)
    scheduleTrack(pan.base, offset)
  }

  const handlePointerUp = (event) => {
    const pan = panRef.current
    if (!pan) return
    if (pan.mode === 'pan') {
      const dx = event.clientX - pan.x0
      const width = trackRef.current?.clientWidth || 1
      // 用最近一小段轨迹的速度做松手判定：轻推投影过零界或快速甩动即翻页，否则弹回原位
      let velocity = 0
      const trail = pan.trail
      if (trail.length >= 2) {
        const first = trail[0]
        const last = trail[trail.length - 1]
        if (last.t - first.t > 16) velocity = (last.x - first.x) / (last.t - first.t)
      }
      const step = resolvePageStep({
        raw: pan.startOffset + dx,
        velocity,
        width,
        canPrev: pan.base > 0,
        canNext: pan.base < pageCountRef.current - 1,
      })
      settlePage(pan.base + step, velocity)
      return
    }
    if (pan.mode === null && !pan.fromTile) onClose() // 空白处轻点关闭
    panRef.current = null
  }

  const updateFallbackOver = (event) => {
    if (!activeId) return
    const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-id]')
    if (!tile) {
      // 指针悬在空白处：清掉之前的高亮，避免翻页后误合并到旧页图标
      if (fallbackOverRef.current !== null) {
        fallbackOverRef.current = null
        setFallbackOverId(null)
      }
      // 拖到左右边缘的空白区域自动翻页
      const rect = event.currentTarget.getBoundingClientRect()
      const edge = 72
      const currentPage = pageRef.current
      if (currentPage > 0 && event.clientX < rect.left + edge) {
        settlePage(currentPage - 1)
        return
      }
      if (currentPage < pageCountRef.current - 1 && event.clientX > rect.right - edge) {
        settlePage(currentPage + 1)
        return
      }
      return
    }
    const nextId = tile.dataset.id !== activeId ? tile.dataset.id : null
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

  const trackStyle = {
    transform: pageTransform(page),
  }

  return (
    <section
      ref={sectionRef}
      className={`launcher${open ? ' show opening' : ''}`}
      aria-label="应用快捷入口"
      aria-hidden={!open}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => resetPan()}
    >
      <div className="launcher-stage">
        <DndContext
          sensors={sensors}
          collisionDetection={mergeCollisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
          autoScroll={false}
          onDragStart={({ active }) => {
            suppressClickUntil.current = Date.now() + 260
            clearFallbackOver()
            resetPan()
            setActiveId(active.id)
          }}
          onDragEnd={finishDrag}
          onDragCancel={() => {
            setActiveId(null)
            clearFallbackOver()
            resetPan()
          }}
        >
          <div className="launcher-pages" ref={trackRef} style={trackStyle}>
            {pages.map((entries, pageIndex) => (
              <div key={pageIndex} className="app-grid app-page" data-page={pageIndex}>
                {entries.map((entry, index) => entry.id === '__add__'
                  ? <AddAppTile key={entry.id} index={index} onClick={() => setAddOpen(true)} />
                  : (
                    <AppTile
                      key={entry.id}
                      item={entry}
                      index={index}
                      onOpen={openItem}
                      onContextMenu={openContextMenu}
                      fallbackIsOver={fallbackOverId === entry.id}
                    />
                  ))}
              </div>
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
        {pageCount > 1 && (
          <div className="launcher-dots" role="tablist" aria-label="应用页面">
            <span
              ref={indicatorRef}
              className="dot-pill"
              aria-hidden="true"
              style={{ transform: indicatorTransform(page) }}
            />
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === page}
                aria-label={`第 ${index + 1} 页`}
                className={index === page ? 'active' : ''}
                onClick={() => settlePage(index)}
              />
            ))}
          </div>
        )}
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
          <button
            className="danger"
            type="button"
            role="menuitem"
            onClick={() => {
              onDeleteApp(contextMenu.itemId)
              setContextMenu(null)
            }}
          >
            删除 App
          </button>
        </div>
      )}
      {addOpen && <AppFormModal onClose={() => setAddOpen(false)} onSave={onAddApp} onResolve={onEditApp} />}
      {editingApp && <AppFormModal item={editingApp} onClose={() => setEditingAppId(null)} onSave={onEditApp} onResolve={onEditApp} />}
    </section>
  )
}
