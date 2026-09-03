import { useEffect, useRef, useState } from 'react'

const engines = {
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=' },
}

function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function ClockSearch() {
  const [time, setTime] = useState(formatTime)
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [engineKey, setEngineKey] = useState(() => localStorage.getItem('leave-space-search-engine') || 'bing')
  const inputRef = useRef(null)
  const shellRef = useRef(null)
  const closeTimer = useRef()
  const engine = engines[engineKey] || engines.bing

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatTime()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const reveal = (focus = false) => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
    if (focus) window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 180)
  }

  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => {
      if (!shellRef.current?.matches(':hover') && !shellRef.current?.contains(document.activeElement)) {
        setOpen(false)
        setMenuOpen(false)
      }
    }, 120)
  }

  const chooseEngine = (key) => {
    setEngineKey(key)
    localStorage.setItem('leave-space-search-engine', key)
    setMenuOpen(false)
    inputRef.current?.focus()
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
            {Object.entries(engines).map(([key, value]) => (
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
