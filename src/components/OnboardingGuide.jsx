import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'mintstart-onboarding-done'
// 步骤 2 时钟展开后，停留多少毫秒自动进入下一步
const CLOCK_HOVER_ADVANCE_MS = 2400
// 步骤 3 点击空白后，抽屉动画完成再进入下一步
const LAUNCHPAD_ADVANCE_DELAY = 650

/**
 * 新手引导：首次访问自动弹出，操作式引导。
 * 每步引导用户真实操作（hover 时钟 / 点击空白），完成动作后自动或手动进入下一步。
 */
export function OnboardingGuide({ launchpadOpen, onOpenLaunchpad }) {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [anchor, setAnchor] = useState(null)
  const [clockHovered, setClockHovered] = useState(false) // 步骤2: 时钟已展开
  const [dotSpot, setDotSpot] = useState(null) // 步骤3: 闪光点位置
  const advanceTimer = useRef(0)
  const launcherHandledRef = useRef(false)

  const steps = useMemo(() => [
    {
      title: '欢迎使用薄荷起始页',
      body: '一个属于你的轻量新标签页。接下来我会带你亲手试一遍核心操作，大约 30 秒。',
      selector: '.clock',
      mode: 'info',
    },
    {
      title: '把鼠标移到时钟上',
      body: '不用点击——只要把鼠标移过去，搜索框就会展开。试试看，展开后会自动进入下一步。',
      selector: '.clock-shell',
      mode: 'hover-clock',
      pad: 34,
    },
    {
      title: '点击页面空白处',
      body: '注意看屏幕中间那个闪光点，点击它——那是打开你快捷方式抽屉的入口。',
      selector: '.start-page',
      mode: 'click-blank',
      target: 'dot',
    },
    {
      title: '你的快捷方式抽屉',
      body: '这里展示你的常用站点。点击“＋”可以添加网址，拖拽图标可排序、拖到一起可建文件夹。',
      selector: '.launcher-pages',
      mode: 'launchpad-apps',
      pad: 12,
    },
    {
      title: '账户与云端同步',
      body: '右上角账户菜单可注册登录，登录后快捷方式自动同步到云端，任何设备打开都一致。',
      selector: '.account-area',
      mode: 'info',
    },
  ], [])

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  // ---- 完成态：一次性记录 ----
  const finish = useCallback(() => {
    setVisible(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
  }, [])

  // ---- 推进：下一步 / 跳过 / 完成 ----
  const advance = useCallback(() => {
    if (stepIndex >= steps.length - 1) { finish(); return }
    setStepIndex((index) => index + 1)
    setClockHovered(false)
    setAnchor(null)
    launcherHandledRef.current = false
  }, [finish, stepIndex, steps.length])

  const goNext = useCallback(() => {
    const current = steps[stepIndex]
    if (!current) return
    // 步骤 3：点击“下一步”等价于替用户打开抽屉
    if (current.mode === 'click-blank') onOpenLaunchpad?.()
    advance()
  }, [advance, onOpenLaunchpad, stepIndex, steps])

  // ---- 首次访问自动弹 ----
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const timer = window.setTimeout(() => setVisible(true), 700)
    return () => window.clearTimeout(timer)
  }, [])

  // ---- 计算高亮框 / 闪光点位置 ----
  useEffect(() => {
    if (!visible || !step) return
    let cancelled = false

    const locate = () => {
      if (step.mode === 'click-blank') {
        // 空白闪光点：放在时钟与底部气泡之间的空白区（避开卡片与时钟）
        const clockEl = document.querySelector('.clock-shell')
        const cardEl = document.querySelector('.onboarding-card')
        const vw = window.innerWidth
        const clockBottom = clockEl ? clockEl.getBoundingClientRect().bottom : 180
        const cardTop = cardEl ? cardEl.getBoundingClientRect().top : window.innerHeight - 140
        const y = Math.max(clockBottom + 50, Math.round((clockBottom + cardTop) / 2))
        setAnchor(null)
        setDotSpot({ x: Math.round(vw / 2), y: Math.min(y, cardTop - 60) })
        return
      }
      setDotSpot(null)
      if (step.mode === 'launchpad-apps' && !launchpadOpen) return
      const el = document.querySelector(step.selector)
      if (!el) { setAnchor(null); return }
      const rect = el.getBoundingClientRect()
      const pad = step.pad || 8
      setAnchor({
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      })
    }

    const delay = step.mode === 'launchpad-apps' ? 500 : step.mode === 'click-blank' ? 0 : 150
    const timer = window.setTimeout(() => { if (!cancelled) locate() }, delay)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [visible, stepIndex, launchpadOpen, step])

  // ---- 步骤2：轮询时钟是否已展开（hover 生效）→ 展开后停留自动下一步 ----
  useEffect(() => {
    if (!visible || step?.mode !== 'hover-clock') return undefined
    let expandedAt = 0
    const poll = window.setInterval(() => {
      const shell = document.querySelector('.clock-shell')
      const expanded = Boolean(shell?.classList.contains('active'))
      if (expanded) {
        setClockHovered(true)
        if (!expandedAt) expandedAt = Date.now()
        // 展开后停留 CLOCK_HOVER_ADVANCE_MS 自动进入下一步
        if (Date.now() - expandedAt >= CLOCK_HOVER_ADVANCE_MS) advance()
      } else {
        expandedAt = 0
        setClockHovered(false)
      }
    }, 250)
    return () => { window.clearInterval(poll); setClockHovered(false) }
  }, [visible, step, advance])

  // ---- 步骤3：监听抽屉打开 → 自动进入下一步 ----
  useEffect(() => {
    if (!visible || step?.mode !== 'click-blank') return undefined
    if (launchpadOpen && !launcherHandledRef.current) {
      launcherHandledRef.current = true
      const timer = window.setTimeout(advance, LAUNCHPAD_ADVANCE_DELAY)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [visible, step, launchpadOpen, advance])

  // ---- 清理 ----
  useEffect(() => () => window.clearTimeout(advanceTimer.current), [])

  if (!visible || !step) return null

  const hintButton = step.mode === 'hover-clock'
    ? (clockHovered ? '看到了吗？即将进入下一步…' : '移过去看看，或点这里继续')
    : step.mode === 'click-blank'
      ? '我找不到闪光点，帮我打开'
      : (isLast ? '完成，开始使用' : '下一步')

  // 步骤 3：遮罩放行空白点击（把中央区域挖掉，让事件落到 start-page）
  const clickThrough = step.mode === 'click-blank'

  return (
    <div className={`onboarding${clickThrough ? ' click-through' : ''}`} role="dialog" aria-modal="true" aria-label={step.title} data-mode={step.mode}>
      {!clickThrough && (
        <svg className="onboarding-mask" aria-hidden="true">
          <defs>
            <mask id="ob-mask">
              <rect width="100%" height="100%" fill="white" />
              {anchor && (
                <rect
                  x={anchor.left} y={anchor.top}
                  width={anchor.width} height={anchor.height}
                  rx={Math.min(22, anchor.height / 3)}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(5,8,16,0.66)" mask="url(#ob-mask)" pointerEvents="none" />
        </svg>
      )}

      {/* 步骤3：遮罩本身不拦截事件，中央闪光点引导点击，事件穿透到 start-page */}
      {clickThrough && (
        <>
          <svg className="onboarding-mask" aria-hidden="true">
            <rect width="100%" height="100%" fill="rgba(5,8,16,0.4)" />
          </svg>
          {dotSpot && (
            <div
              className="onboarding-dot"
              style={{ left: dotSpot.x, top: dotSpot.y }}
              aria-hidden="true"
            >
              <span className="onboarding-dot-ring" />
              <span className="onboarding-dot-core" />
            </div>
          )}
        </>
      )}

      {/* 高亮框 */}
      {anchor && !clickThrough && (
        <div
          className="onboarding-highlight"
          style={{ top: anchor.top - 3, left: anchor.left - 3, width: anchor.width + 6, height: anchor.height + 6 }}
        />
      )}

      {/* 进度点 */}
      <div className="onboarding-dots">
        {steps.map((item, index) => (
          <span key={item.title} className={index === stepIndex ? 'on' : ''} />
        ))}
      </div>

      {/* 气泡 */}
      <div className="onboarding-card">
        <span className="launcher-kicker">MINTSTART GUIDE · {stepIndex + 1}/{steps.length}</span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={finish}>跳过</button>
          <button type="button" className="onboarding-next" onClick={goNext}>
            {hintButton}
          </button>
        </div>
      </div>
    </div>
  )
}
