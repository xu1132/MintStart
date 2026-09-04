import { useCallback, useEffect, useState } from 'react'
import { ClockSearch } from './components/ClockSearch'
import { Launchpad } from './components/Launchpad'
import { AuthModal } from './components/AuthModal'
import { SettingsModal } from './components/SettingsModal'
import { AdminDashboard } from './components/AdminDashboard'
import { AdminPage } from './components/AdminPage'
import { loadApps } from './data/apps'
import { useBingWallpaper } from './hooks/useBingWallpaper'
import { authApi, desktopApi, getAuthToken, saveAuthToken } from './services/api'
import { dissolveFolder, mergeApps, removeDesktopApp, renameFolder, replaceDesktopApp } from './utils/desktop'

const DESKTOP_STORAGE = 'leave-space-desktop-apps'

// admin.mintstart.cn → 独立运营后台；其余 host → 薄荷起始页
function isAdminHost() {
  return typeof window !== 'undefined' && window.location.hostname === 'admin.mintstart.cn'
}

export default function App() {
  // admin.mintstart.cn → 独立运营后台；其余 host → 薄荷起始页
  return isAdminHost() ? <AdminPage /> : <MainApp />
}

function MainApp() {
  const wallpaper = useBingWallpaper()
  const [launchpadOpen, setLaunchpadOpen] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [searchResetVersion, setSearchResetVersion] = useState(0)
  const [items, setItems] = useState(() => loadApps(DESKTOP_STORAGE))
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [cloudReadyUserId, setCloudReadyUserId] = useState(null)
  const [authModal, setAuthModal] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState('游客模式，配置保存在本机')

  useEffect(() => {
    if (!getAuthToken()) {
      setAuthReady(true)
      return
    }
    authApi.me()
      .then(({ user: nextUser }) => setUser(nextUser || null))
      .catch(() => saveAuthToken(''))
      .finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_STORAGE, JSON.stringify(items))
    } catch {
      setSyncStatus('本地保存失败，请导出配置备份')
    }
  }, [items])

  useEffect(() => {
    if (!authReady || !user) {
      setCloudReadyUserId(null)
      if (!user) setSyncStatus('游客模式，配置保存在本机')
      return
    }
    let cancelled = false
    setCloudReadyUserId(null)
    setSyncStatus('正在读取云端配置…')
    desktopApi.get()
      .then(({ items: cloudItems }) => {
        if (cancelled) return
        if (Array.isArray(cloudItems)) setItems(cloudItems)
        else desktopApi.save(items).catch(() => {})
        setCloudReadyUserId(user.id)
        setSyncStatus('已登录，配置自动同步')
      })
      .catch(() => { if (!cancelled) setSyncStatus('云端暂不可用，当前使用本地配置') })
    return () => { cancelled = true }
  }, [authReady, user]) // 登录切换时只拉取一次，避免编辑快捷方式触发重新拉取

  useEffect(() => {
    if (!authReady || !user || cloudReadyUserId !== user.id) return undefined
    const timer = window.setTimeout(() => {
      setSyncStatus('同步中…')
      desktopApi.save(items)
        .then(() => setSyncStatus('已同步'))
        .catch(() => setSyncStatus('同步失败，稍后自动重试'))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [authReady, cloudReadyUserId, items, user])

  useEffect(() => {
    if (!authReady || !user) return undefined
    const usageKey = `mintstart-usage-session:${user.id}`
    let sessionId = sessionStorage.getItem(usageKey)
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem(usageKey, sessionId)
    }
    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') desktopApi.heartbeat(sessionId).catch(() => {})
    }
    sendHeartbeat()
    const timer = window.setInterval(sendHeartbeat, 30000)
    document.addEventListener('visibilitychange', sendHeartbeat)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', sendHeartbeat)
    }
  }, [authReady, user])

  useEffect(() => {
    document.body.classList.toggle('launcher-open', launchpadOpen)
    return () => document.body.classList.remove('launcher-open')
  }, [launchpadOpen])

  const merge = useCallback((sourceId, targetId) => {
    setItems((current) => mergeApps(current, sourceId, targetId))
  }, [])

  const rename = useCallback((folderId, name) => {
    setItems((current) => renameFolder(current, folderId, name))
  }, [])

  const addApp = useCallback((app) => {
    setItems((current) => [...current, app])
  }, [])

  const dissolve = useCallback((folderId) => {
    setItems((current) => dissolveFolder(current, folderId))
  }, [])

  const editApp = useCallback((app) => {
    setItems((current) => replaceDesktopApp(current, app))
  }, [])

  const deleteApp = useCallback((appId) => {
    setItems((current) => removeDesktopApp(current, appId))
  }, [])

  const handleAuthenticated = useCallback((nextUser) => {
    setUser(nextUser)
    setSyncStatus('正在连接云端…')
  }, [])

  const handleLogout = useCallback(async () => {
    try { await authApi.logout() } catch { /* 即使网络中断，也清除本地登录态 */ }
    saveAuthToken('')
    setCloudReadyUserId(null)
    setUser(null)
    setAdminOpen(false)
    setSettingsOpen(false)
  }, [])

  return (
    <>
      <div
        className={`wallpaper${wallpaper ? ' ready' : ''}`}
        style={wallpaper ? { backgroundImage: `url("${wallpaper}")` } : undefined}
        aria-hidden="true"
      />
      <div className="shade" aria-hidden="true" />

      <main
        className="start-page"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (searchActive) {
          setSearchResetVersion((version) => version + 1)
          return
        }

        setLaunchpadOpen(true)
      }}
    >
      <ClockSearch onActiveChange={setSearchActive} resetVersion={searchResetVersion} />
      </main>

      <Launchpad
        open={launchpadOpen}
        items={items}
        user={user}
        syncStatus={syncStatus}
        onClose={() => setLaunchpadOpen(false)}
        onMerge={merge}
        onRenameFolder={rename}
        onDissolveFolder={dissolve}
        onAddApp={addApp}
        onEditApp={editApp}
        onDeleteApp={deleteApp}
        onLogin={() => setAuthModal('login')}
        onRegister={() => setAuthModal('register')}
        onSettings={() => setSettingsOpen(true)}
        onAdmin={() => setAdminOpen(true)}
        onLogout={handleLogout}
      />
      <AuthModal
        open={Boolean(authModal)}
        initialMode={authModal || 'login'}
        onClose={() => setAuthModal(null)}
        onAuthenticated={handleAuthenticated}
      />
      <SettingsModal
        open={settingsOpen}
        user={user}
        onClose={() => setSettingsOpen(false)}
        onSignedOut={handleLogout}
      />
      <AdminDashboard open={adminOpen} onClose={() => setAdminOpen(false)} />
      <p className="sr-only" aria-live="polite">{wallpaper ? '今日 Bing 壁纸已加载' : '正在加载今日壁纸'}</p>
    </>
  )
}
