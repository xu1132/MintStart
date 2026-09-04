import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SEARCH_ENGINE, normalizeSearchEngine, SEARCH_ENGINES } from '../data/searchEngines'

const OPEN_DELAY = 110
const CLOSE_DELAY = 240

function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const SEARCH_ENGINE_STORAGE = 'leave-space-search-engine'

function getLocalSearchEngine() {
  return normalizeSearchEngine(localStorage.getItem(SEARCH_ENGINE_STORAGE) || DEFAULT_SEARCH_ENGINE)
}

export function ClockSearch({ onActiveChange, onEngineChange, preferredEngine = null, resetVersion }) {
  const [time, setTime] = useState(formatTime)
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [engineKey, setEngineKey] = useState(getLocalSearchEngine)
  const inputRef = useRef(null)
  const shellRef = useRef(null)
  const openTimer = useRef()
  const closeTimer = useRef()
  const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE]

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatTime()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }, [])

  useEffect(() => {
    onActiveChange?.(open)
  }, [onActiveChange, open])

  useEffect(() => {
    setEngineKey(preferredEngine ? normalizeSearchEngine(preferredEngine) : getLocalSearchEngine())
  }, [preferredEngine])

  useEffect(() => () => onActiveChange?.(false), [onActiveChange])

  useEffect(() => {
    if (!resetVersion) return

    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setMenuOpen(false)
    setOpen(false)

    if (shellRef.current?.contains(document.activeElement)) {
      document.activeElement?.blur()
    }
  }, [resetVersion])

  const reveal = (focus = false) => {
    window.clearTimeout(closeTimer.current)
    if (focus) {
      window.clearTimeout(openTimer.current)
      setOpen(true)
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 160)
      return
    }

    if (open) return
    window.clearTimeout(openTimer.current)
    openTimer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY)
  }

  const scheduleClose = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      const shell = shellRef.current
      const shouldClose = !shell?.contains(document.activeElement)
      if (!shell?.matches(':hover') && shouldClose) {
        setOpen(false)
        setMenuOpen(false)
        if (shell?.contains(document.activeElement)) document.activeElement?.blur()
      }
    }, CLOSE_DELAY)
  }

  const chooseEngine = (key) => {
    setEngineKey(key)
    if (!preferredEngine) localStorage.setItem(SEARCH_ENGINE_STORAGE, key)
    onEngineChange?.(key)
    setMenuOpen(false)
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0)
  }

  const submit = (event) => {
    event.preventDefault()
    const query = new FormData(event.currentTarget).get('query')?.trim()
    if (!query) return inputRef.current?.focus()
    const looksLikeUrl = /^(https?:\/\/|www\.)/i.test(query) || /^[\w-]+\.[a-z]{2,}(\/.*)?$/i.test(query)
    const destination = looksLikeUrl
      ? (query.startsWith('http') ? query : `https://${query}`)
      : `${engine.url}${encodeURIComponent(query)}`
    window.open(destination, '_blank', 'noopener')
  }

  return (
    <section
      ref={shellRef}
      className={`clock-shell${open ? ' active' : ''}`}
      aria-label="时间与搜索"
      onPointerEnter={() => reveal(false)}
      onPointerLeave={scheduleClose}
    >
      <button className="clock" type="button" aria-expanded={open} onClick={() => reveal(true)}>
        {time}
      </button>

      <form className="search-form" role="search" onSubmit={submit}>
        <div className="engine-picker">
          <button className="engine-toggle" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            <span className={`engine-mark ${engineKey}`} aria-hidden="true" />
            <span>{engine.name}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
          </button>
          <div className={`engine-menu${menuOpen ? ' open' : ''}`} role="menu">
            {Object.entries(SEARCH_ENGINES).map(([key, value]) => (
              <button key={key} type="button" role="menuitem" onClick={() => chooseEngine(key)}>
                <span className={`engine-mark ${key}`} />{value.name}
              </button>
            ))}
          </div>
        </div>
        <span className="search-divider" aria-hidden="true" />
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 5 5" /></svg>
        <input ref={inputRef} name="query" type="search" placeholder="搜索，或输入网址" autoComplete="off" onFocus={() => reveal(false)} onBlur={scheduleClose} />
        <button type="submit" aria-label="开始搜索">↵</button>
      </form>
    </section>
  )
}
