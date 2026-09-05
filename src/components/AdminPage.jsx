import { useEffect, useState } from 'react'
import { AdminDashboard } from './AdminDashboard'
import { authApi, saveAuthToken, getAuthToken } from '../services/api'

/**
 * 运营后台独立页（admin.mintstart.cn）
 *
 * 三种状态：
 * 1. 未登录        → 显示管理员登录框
 * 2. 已登录但非管理员 → 403 提示
 * 3. 已登录且是管理员 → 渲染 AdminDashboard
 */
export function AdminPage() {
  const [checking, setChecking] = useState(true)   // 正在校验 token
  const [authState, setAuthState] = useState('loading') // loading | needLogin | forbidden | ready
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = '薄荷起始页运营后台'
    const robots = document.querySelector('meta[name="robots"]')
    if (robots) robots.setAttribute('content', 'noindex, nofollow, noarchive')
  }, [])

  useEffect(() => {
    if (!getAuthToken()) {
      setAuthState('needLogin')
      setChecking(false)
      return
    }
    authApi.me()
      .then(({ user: nextUser }) => {
        setAuthState(nextUser?.role === 'admin' ? 'ready' : 'forbidden')
      })
      .catch(() => {
        saveAuthToken('')
        setAuthState('needLogin')
      })
      .finally(() => setChecking(false))
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await authApi.login(account, password)
      saveAuthToken(result.token)
      setAuthState(result.user?.role === 'admin' ? 'ready' : 'forbidden')
    } catch (requestError) {
      setError(requestError.message)
      setAuthState('needLogin')
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    saveAuthToken('')
    setAccount('')
    setPassword('')
    setAuthState('needLogin')
  }

  if (checking) {
    return (
      <div className="admin-page">
        <p className="admin-muted">正在校验登录状态…</p>
      </div>
    )
  }

  if (authState === 'ready') {
    return (
      <div className="admin-page">
        <header className="admin-page-head">
          <div>
            <span className="launcher-kicker">MINTSTART ADMIN</span>
            <h1>运营后台</h1>
          </div>
          <button className="table-action" type="button" onClick={logout}>退出登录</button>
        </header>
        <AdminDashboard open onClose={() => {}} />
      </div>
    )
  }

  if (authState === 'forbidden') {
    return (
      <div className="admin-page">
        <section className="admin-login-card">
          <span className="launcher-kicker">ACCESS DENIED</span>
          <h1>无权限访问</h1>
          <p>当前账号不是管理员，无法查看运营后台。</p>
          <button className="table-action" type="button" onClick={logout}>使用管理员账号登录</button>
        </section>
      </div>
    )
  }

  // needLogin
  return (
    <div className="admin-page">
      <section className="admin-login-card">
        <span className="launcher-kicker">MINTSTART ADMIN</span>
        <h1>管理员登录</h1>
        <form className="account-form" onSubmit={submit}>
          <label>
            <span>账号</span>
            <input autoFocus value={account} onChange={(event) => setAccount(event.target.value)} placeholder="管理员账号" required />
          </label>
          <label>
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="管理员密码" minLength={8} required />
          </label>
          <div className="account-actions">
            <span className={`account-status${error ? ' error' : ''}`}>{error || '仅管理员可登录'}</span>
            <button type="submit" disabled={busy}>{busy ? '处理中…' : '登录'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
