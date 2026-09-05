import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'mintstart-onboarding-done'
const CLOCK_OPEN_ADVANCE_MS = 1100
const LAUNCHPAD_ADVANCE_DELAY = 420

function onboardingCompleted() {
  try { return Boolean(localStorage.getItem(STORAGE_KEY)) } catch { return false }
}

/**
 * 首次访问的新手引导。真实交互由页面组件上报，不再通过轮询 DOM 猜测状态。
 */
export function OnboardingGuide({
  launchpadOpen,
  searchActive,
  accountMenuOpen,
  onOpenLaunchpad,
  onCloseLaunchpad,
  onOpenHomepageGuide,
}) {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [anchor, setAnchor] = useState(null)
  const [dotSpot, setDotSpot] = useState(null)
  const [accountVisited, setAccountVisited] = useState(false)
  const cardRef = useRef(null)

  const steps = useMemo(() => [
    {
      title: '欢迎使用薄荷起始页',
      body: '一个属于你的轻量新标签页。接下来亲手试一遍核心操作，大约 30 秒。',
      selector: '.clock',
      mode: 'welcome',
    },
    {
      title: '唤出搜索框',
      body: '把鼠标移到时钟上；在触屏设备上，轻点时钟也可以。搜索框展开后会自动继续。',
      selector: '.clock-shell',
      mode: 'clock',
      pad: 34,
    },
    {
      title: '打开快捷方式',
      body: '点击屏幕中间的闪光点，打开你的快捷方式抽屉。',
      mode: 'launchpad-trigger',
    },
    {
      title: '使用快捷方式抽屉',
      body: '这里的控件都可以直接操作：点“＋”添加网址，拖动图标可以整理或合并成文件夹。试用后继续。',
      selector: '.launcher-pages',
      mode: 'launchpad',
      pad: 12,
    },
    {
      title: '账户与云端同步',
      body: '点击右上角的账户入口，查看登录、同步和更多选项。打开菜单后，引导会自动继续。',
      selector: '.account-area',
      mode: 'account',
      pad: 10,
    },
    {
      title: '设为浏览器主页',
      body: '最后，你可以把薄荷起始页设为浏览器主页。点击下方按钮，查看与你的浏览器对应的完整设置方法。',
      mode: 'homepage',
    },
  ], [])

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const letsPageInteract = step?.mode === 'clock' || step?.mode === 'launchpad' || step?.mode === 'account'
  const needsTargetHole = step?.mode === 'clock' && Boolean(anchor)
  const blocksWholePage = step?.mode === 'welcome'
    || step?.mode === 'launchpad-trigger'
    || step?.mode === 'homepage'
    || (step?.mode === 'clock' && !anchor)

  const finish = useCallback(() => {
    setVisible(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* 浏览器禁用存储时仍允许正常使用 */ }
  }, [])

  const advance = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish()
      return
    }
    setStepIndex((current) => current + 1)
  }, [finish, stepIndex, steps.length])

  const goNext = useCallback(() => {
    if (!step) return
    if (step.mode === 'launchpad-trigger') {
      onOpenLaunchpad?.()
      return
    }
    if (step.mode === 'homepage') {
      onOpenHomepageGuide?.()
      finish()
      return
    }
    // 用户可能在抽屉步骤中按 Esc 关掉了抽屉；先恢复现场，不跳到一个没有目标的步骤。
    if ((step.mode === 'launchpad' || step.mode === 'account') && !launchpadOpen) {
      onOpenLaunchpad?.()
      return
    }
    advance()
  }, [advance, finish, launchpadOpen, onOpenHomepageGuide, onOpenLaunchpad, step])

  const goBack = useCallback(() => {
    if (stepIndex === 0) return
    if (stepIndex === 3) onCloseLaunchpad?.()
    setStepIndex((current) => Math.max(0, current - 1))
  }, [onCloseLaunchpad, stepIndex])

  useEffect(() => {
    if (onboardingCompleted()) return undefined
    const timer = window.setTimeout(() => setVisible(true), 650)
    return () => window.clearTimeout(timer)
  }, [])

  // 搜索框的真实 open 状态驱动第二步，不依赖 className 轮询。
  useEffect(() => {
    if (!visible || step?.mode !== 'clock' || !searchActive) return undefined
    const timer = window.setTimeout(advance, CLOCK_OPEN_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [advance, searchActive, step, visible])

  // 抽屉真实打开后再推进，延时只用于等待入场动画结束。
  useEffect(() => {
    if (!visible || step?.mode !== 'launchpad-trigger' || !launchpadOpen) return undefined
    const timer = window.setTimeout(advance, LAUNCHPAD_ADVANCE_DELAY)
    return () => window.clearTimeout(timer)
  }, [advance, launchpadOpen, step, visible])

  useEffect(() => {
    if (visible && step?.mode === 'account' && accountMenuOpen) setAccountVisited(true)
  }, [accountMenuOpen, step, visible])

  useEffect(() => {
    if (!visible || step?.mode !== 'account' || !accountVisited) return undefined
    const timer = window.setTimeout(advance, 900)
    return () => window.clearTimeout(timer)
  }, [accountVisited, advance, step, visible])

  useEffect(() => {
    if (step?.mode !== 'account') setAccountVisited(false)
  }, [step])

  // 目标在动画、缩放和窗口变化后都会重新定位。
  useEffect(() => {
    if (!visible || !step) return undefined
    let frame = 0
    let observer

    const locate = () => {
      if (step.mode === 'launchpad-trigger') {
        const clockRect = document.querySelector('.clock-shell')?.getBoundingClientRect()
        const cardRect = cardRef.current?.getBoundingClientRect()
        const top = (clockRect?.bottom || 180) + 54
        const bottom = (cardRect?.top || window.innerHeight - 150) - 54
        setAnchor(null)
        setDotSpot({
          x: Math.round(window.innerWidth / 2),
          y: Math.round(Math.max(top, Math.min((top + bottom) / 2, bottom))),
        })
        return
      }

      setDotSpot(null)
      if ((step.mode === 'launchpad' || step.mode === 'account') && !launchpadOpen) {
        setAnchor(null)
        return
      }
      const element = step.selector ? document.querySelector(step.selector) : null
      if (!element) {
        setAnchor(null)
        return
      }
      const rect = element.getBoundingClientRect()
      const pad = step.pad || 8
      const left = Math.max(0, rect.left - pad)
      const top = Math.max(0, rect.top - pad)
      const right = Math.min(window.innerWidth, rect.right + pad)
      const bottom = Math.min(window.innerHeight, rect.bottom + pad)
      setAnchor({ top, left, width: right - left, height: bottom - top })
    }

    const scheduleLocate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(locate)
    }

    const delay = step.mode === 'launchpad' || step.mode === 'account' ? 320 : 0
    const timer = window.setTimeout(() => {
      locate()
      const element = step.selector ? document.querySelector(step.selector) : null
      if (element && 'ResizeObserver' in window) {
        observer = new ResizeObserver(scheduleLocate)
        observer.observe(element)
      }
    }, delay)
    window.addEventListener('resize', scheduleLocate)
    window.addEventListener('orientationchange', scheduleLocate)
    return () => {
      window.clearTimeout(timer)
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleLocate)
      window.removeEventListener('orientationchange', scheduleLocate)
    }
  }, [launchpadOpen, step, visible])

  useEffect(() => {
    if (!visible) return undefined
    const frame = window.requestAnimationFrame(() => {
      cardRef.current?.querySelector('.onboarding-next')?.focus({ preventScroll: true })
    })
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      finish()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [finish, stepIndex, visible])

  if (!visible || !step) return null

  const primaryLabel = step.mode === 'clock'
    ? (searchActive ? '搜索框已展开，即将继续…' : '也可以点这里继续')
    : step.mode === 'launchpad-trigger'
      ? '帮我打开'
      : step.mode === 'homepage'
        ? '查看设置方法'
      : !launchpadOpen && (step.mode === 'launchpad' || step.mode === 'account')
        ? '重新打开抽屉'
        : isLast ? '完成，开始使用' : '下一步'

  return (
    <div
      className={`onboarding${letsPageInteract ? ' page-interactive' : ''}`}
      role="dialog"
      aria-modal={!letsPageInteract}
      aria-labelledby="onboarding-title"
      data-mode={step.mode}
    >
      <svg className="onboarding-mask" aria-hidden="true">
        <defs>
          <mask id="ob-mask">
            <rect width="100%" height="100%" fill="white" />
            {anchor && (
              <rect
                x={anchor.left}
                y={anchor.top}
                width={anchor.width}
                height={anchor.height}
                rx={Math.min(22, anchor.height / 3)}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(5,8,16,0.66)" mask="url(#ob-mask)" />
      </svg>

      {blocksWholePage && <div className="onboarding-guard" aria-hidden="true" />}

      {needsTargetHole && (
        <div className="onboarding-blockers" aria-hidden="true">
          <span style={{ inset: '0 0 auto 0', height: anchor.top }} />
          <span style={{ inset: `${anchor.top + anchor.height}px 0 0 0` }} />
          <span style={{ top: anchor.top, left: 0, width: anchor.left, height: anchor.height }} />
          <span style={{ top: anchor.top, left: anchor.left + anchor.width, right: 0, height: anchor.height }} />
        </div>
      )}

      {dotSpot && (
        <button
          type="button"
          className="onboarding-dot"
          style={{ left: dotSpot.x, top: dotSpot.y }}
          aria-label="打开快捷方式抽屉"
          onClick={onOpenLaunchpad}
        >
          <span className="onboarding-dot-ring" />
          <span className="onboarding-dot-core" />
        </button>
      )}

      {anchor && (
        <div
          className="onboarding-highlight"
          style={{ top: anchor.top - 3, left: anchor.left - 3, width: anchor.width + 6, height: anchor.height + 6 }}
        />
      )}

      <div className="onboarding-dots" aria-label={`引导进度：第 ${stepIndex + 1} 步，共 ${steps.length} 步`}>
        {steps.map((item, index) => (
          <span key={item.title} className={index === stepIndex ? 'on' : ''} />
        ))}
      </div>

      <div className="onboarding-card" ref={cardRef}>
        <span className="launcher-kicker">MINTSTART GUIDE · {stepIndex + 1}/{steps.length}</span>
        <h2 id="onboarding-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={finish}>{isLast ? '暂时不用' : '跳过'}</button>
          {stepIndex > 0 && <button type="button" className="onboarding-back" onClick={goBack}>上一步</button>}
          <button type="button" className="onboarding-next" onClick={goNext}>{primaryLabel}</button>
        </div>
      </div>
    </div>
  )
}
