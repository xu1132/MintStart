import { useState } from 'react'
import { authApi, saveAuthToken } from '../services/api'

export function SettingsModal({ open, user, onClose, onSignedOut }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')
    setBusy(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      saveAuthToken('')
      setMessage('密码已修改，请重新登录')
      setCurrentPassword('')
      setNewPassword('')
      setTimeout(() => onSignedOut(), 700)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="account-head">
          <div>
            <span className="launcher-kicker">ACCOUNT SETTINGS</span>
            <h2 id="settings-title">账户设置</h2>
          </div>
          <button className="launcher-close" type="button" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <p className="settings-account">当前账户：<strong>{user?.account}</strong></p>
        <form className="account-form" onSubmit={submit}>
          <label><span>当前密码</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label><span>新密码</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></label>
          <div className="account-actions">
            <span className={`account-status${error ? ' error' : ''}`}>{error || message || '修改密码后，其他设备会被要求重新登录'}</span>
            <button type="submit" disabled={busy}>{busy ? '保存中…' : '修改密码'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
