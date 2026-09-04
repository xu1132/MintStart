import { useEffect, useState } from 'react'
import { adminApi } from '../services/api'

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  if (total < 60) return `${total} 秒`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}

export function AdminDashboard({ open, onClose }) {
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetUser, setResetUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([adminApi.overview(), adminApi.users()])
      .then(([nextOverview, nextUsers]) => {
        if (cancelled) return
        setOverview(nextOverview)
        setUsers(nextUsers.users || [])
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const resetPassword = async (event) => {
    event.preventDefault()
    setResetMessage('')
    try {
      await adminApi.resetPassword(resetUser.id, newPassword)
      setResetMessage('密码已重置，该用户的其他登录会话已失效')
      setNewPassword('')
    } catch (requestError) {
      setResetMessage(requestError.message)
    }
  }

  return (
    <div className="admin-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <header className="admin-head">
          <div><span className="launcher-kicker">MINTSTART ADMIN</span><h2 id="admin-title">运营后台</h2></div>
          <button className="launcher-close" type="button" aria-label="关闭后台" onClick={onClose}>×</button>
        </header>
        {error && <p className="admin-error">{error}</p>}
        {loading && <p className="admin-muted">正在读取统计数据…</p>}
        {overview && (
          <div className="stat-grid">
            <div className="stat-card"><span>用户总数</span><strong>{overview.totalUsers}</strong><small>今日新增 {overview.newUsersToday}</small></div>
            <div className="stat-card"><span>今日活跃用户</span><strong>{overview.activeUsersToday}</strong><small>按心跳统计</small></div>
            <div className="stat-card"><span>累计使用时长</span><strong>{formatDuration(overview.totalUsageSeconds)}</strong><small>所有用户</small></div>
            <div className="stat-card"><span>今日使用时长</span><strong>{formatDuration(overview.todayUsageSeconds)}</strong><small>UTC 自然日</small></div>
          </div>
        )}
        <div className="admin-section-head"><div><span className="launcher-kicker">USER MANAGEMENT</span><h3>用户列表</h3></div><span className="admin-muted">共 {users.length} 个账户</span></div>
        <div className="user-table-wrap">
          <table className="user-table">
            <thead><tr><th>账号</th><th>角色</th><th>注册时间</th><th>最后登录</th><th>使用时长</th><th>操作</th></tr></thead>
            <tbody>{users.map((item) => (
              <tr key={item.id}>
                <td>{item.account}</td><td><span className={`role-badge ${item.role}`}>{item.role === 'admin' ? '管理员' : '用户'}</span></td>
                <td>{formatDate(item.createdAt)}</td><td>{formatDate(item.lastLoginAt)}</td><td>{formatDuration(item.usageSeconds)}</td>
                <td><button className="table-action" type="button" onClick={() => { setResetUser(item); setResetMessage('') }}>重置密码</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {resetUser && (
          <div className="reset-card">
            <div><span className="launcher-kicker">RESET PASSWORD</span><strong>{resetUser.account}</strong></div>
            <form onSubmit={resetPassword}><input type="password" placeholder="输入新密码（至少 8 位）" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><button type="submit">确认重置</button><button type="button" className="reset-cancel" onClick={() => setResetUser(null)}>取消</button></form>
            {resetMessage && <p className={resetMessage.includes('已') ? 'admin-success' : 'admin-error'}>{resetMessage}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
