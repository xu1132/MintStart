export const defaultApps = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', mono: '✦', color: '#20a37f' },
  { id: 'github', name: 'GitHub', url: 'https://github.com', mono: 'GH', color: '#24292f' },
  { id: 'notion', name: 'Notion', url: 'https://www.notion.so', mono: 'N', color: '#f5f5f2', darkText: true },
  { id: 'figma', name: 'Figma', url: 'https://www.figma.com', mono: 'F', color: '#8b5cf6' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com', mono: '▶', color: '#ef3340' },
  { id: 'bilibili', name: '哔哩哔哩', url: 'https://www.bilibili.com', mono: 'bi', color: '#49a9e8' },
  { id: 'xiaohongshu', name: '小红书', url: 'https://www.xiaohongshu.com', mono: '红', color: '#f14d64' },
  { id: 'juejin', name: '掘金', url: 'https://juejin.cn', mono: '掘', color: '#4388e8' },
  { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', mono: 'M', color: '#d94a45' },
]

export const cloneDefaultApps = () => JSON.parse(JSON.stringify(defaultApps))

export function loadApps(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
    return Array.isArray(saved) && saved.length ? saved : cloneDefaultApps()
  } catch {
    return cloneDefaultApps()
  }
}

export function faviconUrl(url) {
  try {
    const hostname = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`
  } catch {
    return ''
  }
}
