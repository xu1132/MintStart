import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'mintstart-onboarding-done'

/**
 * 新手引导：首次访问自动弹出，步骤式遮罩引导。
 * - 首次访问（无本地完成标记）自动显示
 * - 逐步高亮关键区域 + 气泡说明
 * - 可跳过 / 关闭，完成后记录 localStorage
 * - 在 Launchpad 打开时展示真实 UI，引导“点空白打开应用”等交互
 */
export function OnboardingGuide({ launchpadOpen, onOpenLaunchpad }) {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [anchor, setAnchor] = useState(null) // {top,left,width,height}

  // 首次访问自动弹（延迟等页面渲染完）
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const timer = window.setTimeout(() => setVisible(true), 600)
    return () => window.clearTimeout(timer)
  }, [])

  const steps = useMemo(() => [
    {
      title: '欢迎使用薄荷起始页',
      body: '一个属于你的轻量新标签页。跟着 4 步快速上手，随时可跳过。',
      selector: '.clock',
      action: null,
    },
    {
      title: '时钟与搜索',
      body: '点击时钟即可唤起搜索框，支持 Bing / Google / 百度，回车直达结果。',
      selector: '.clock-shell',
      action: null,
    },
    {
      title: '打开应用抽屉',
      body: '点击页面任意空白处，即可打开你的快捷方式抽屉（App 启动器）。',
      selector: '.start-page',
      action: 'open-launchpad',
    },
    {
      title: '快捷方式与文件夹',
      body: '抽屉里可以添加网址快捷方式、拖拽排序、长按归入文件夹，整理你的常用站点。',
      selector: '.launcher-toolbar',
      action: null,
    },
    {
      title: '账户与云端同步',
      body: '右上角账户菜单可注册登录，登录后快捷方式自动云端同步，多设备一致。',
      selector: '.account-area',
      action: null,
    },
  ], [])

  // 计算当前步骤高亮区域（anchor 位置）
  useEffect(() => {
    if (!visible) return
    const step = steps[stepIndex]
    if (!step) return
    // 步骤 3 需要打开启动器后定位 toolbar；等待 launchpadOpen
    if (step.action === 'open-launchpad' && !launchpadOpen) {
      setAnchor(null)
      return
    }
    const timer = window.setTimeout(() => {
      const el = document.querySelector(step.selector)
      if (!el) { setAnchor(null); return }
      const rect = el.getBoundingClientRect()
      setAnchor({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }, step.action === 'open-launchpad' ? 450 : 120)
    return () => window.clearTimeout(timer)
  }, [visible, stepIndex, launchpadOpen, steps])

  if (!visible) return null

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const needOpenLaunchpad = step.action === 'open-launchpad' && !launchpadOpen

  const next = () => {
    if (step.action === 'open-launchpad') {
      onOpenLaunchpad?.()
    }
    if (isLast) {
      finish()
      return
    }
    setStepIndex((index) => index + 1)
  }

  const finish = () => {
    setVisible(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
  }

  const hint = needOpenLaunchpad ? '点击页面空白处打开抽屉…' : (isLast ? '完成，开始使用' : '下一步')

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* 暗色遮罩：高亮区域用透明“窗口”露出 */}
      <svg className="onboarding-mask" aria-hidden="true">
        <defs>
          <mask id="ob-mask">
            <rect width="100%" height="100%" fill="white" />
            {anchor && (
              <rect
                x={anchor.left} y={anchor.top}
                width={anchor.width} height={anchor.height}
                rx={Math.min(20, anchor.height / 3)}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(5,8,16,0.72)" mask="url(#ob-mask)" />
      </svg>

      {/* 高亮框描边（跟随目标） */}
      {anchor && (
        <div
          className="onboarding-highlight"
          style={{ top: anchor.top - 5, left: anchor.left - 5, width: anchor.width + 10, height: anchor.height + 10 }}
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
          <button type="button" className="onboarding-next" onClick={next}>
            {hint}
          </button>
        </div>
      </div>
    </div>
  )
}
