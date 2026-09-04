import { useEffect, useState } from 'react'
import { authApi, saveAuthToken } from '../services/api'

export function AuthModal({ open, initialMode = 'login', onClose, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setAccount('')
    setPassword('')
    setError('')
  }, [initialMode, open])

  if (!open) return null

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = mode === 'login'
        ? await authApi.login(account, password)
        : await authApi.register(account, password)
      saveAuthToken(result.token)
      onAuthenticated(result.user)
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <header className="account-head">
          <div>
            <span className="launcher-kicker">MINTSTART ACCOUNT</span>
            <h2 id="account-title">{mode === 'login' ? '登录账户' : '注册账户'}</h2>
          </div>
          <button className="launcher-close" type="button" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <form className="account-form" onSubmit={submit}>
          <label>
            <span>账号</span>
            <input autoFocus value={account} onChange={(event) => setAccount(event.target.value)} placeholder="用户名或邮箱" required />
          </label>
          <label>
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" minLength={8} required />
          </label>
          <div className="account-actions">
            <span className={`account-status${error ? ' error' : ''}`}>{error || (mode === 'login' ? '登录后快捷方式会自动云端同步' : '注册后即可跨设备保存快捷方式')}</span>
            <button type="submit" disabled={busy}>{busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}</button>
          </div>
        </form>
        <button className="account-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
          {mode === 'login' ? '还没有账户？立即注册' : '已有账户？返回登录'}
        </button>
      </section>
    </div>
  )
}
