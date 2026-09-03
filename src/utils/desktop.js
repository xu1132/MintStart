export function itemMembers(item) {
  return item.type === 'folder' ? item.items : [item]
}

export function mergeApps(items, sourceId, targetId, createId = () => `folder-${Date.now()}`) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items

  const source = items[sourceIndex]
  const target = items[targetIndex]

  if (target.type === 'folder') {
    return items
      .filter((item) => item.id !== sourceId)
      .map((item) => item.id === targetId
        ? { ...item, items: [...item.items, ...itemMembers(source)] }
        : item)
  }

  const folder = {
    id: createId(),
    type: 'folder',
    name: '新建文件夹',
    items: [target, ...itemMembers(source)],
  }
  const result = items.filter((item) => item.id !== sourceId && item.id !== targetId)
  result.splice(Math.min(sourceIndex, targetIndex), 0, folder)
  return result
}

export function renameFolder(items, folderId, name) {
  const nextName = name.trim()
  if (!nextName) return items
  let changed = false
  const result = items.map((item) => {
    if (item.id !== folderId || item.type !== 'folder' || item.name === nextName) return item
    changed = true
    return { ...item, name: nextName }
  })
  return changed ? result : items
}

export function dissolveFolder(items, folderId) {
  const folderIndex = items.findIndex((item) => item.id === folderId && item.type === 'folder')
  if (folderIndex < 0) return items

  const folder = items[folderIndex]
  return [
    ...items.slice(0, folderIndex),
    ...folder.items,
    ...items.slice(folderIndex + 1),
  ]
}

export function replaceDesktopApp(items, nextApp) {
  return items.map((item) => item.id === nextApp.id ? nextApp : item)
}

export function normalizeAppUrl(value) {
  const raw = value.trim()
  if (!raw) throw new Error('请输入网址')

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`
  let url
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('网址格式不正确')
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('仅支持 http 或 https 网址')
  }
  return url.href
}

export function nameFromUrl(url) {
  return new URL(url).hostname.replace(/^www\./, '')
}

function colorFromUrl(url) {
  const hostname = new URL(url).hostname
  let hash = 0
  for (const character of hostname) hash = character.charCodeAt(0) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360} 48% 48%)`
}

export function createDesktopApp(draft, createId = () => `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`) {
  const url = normalizeAppUrl(draft.url)
  const name = (draft.name?.trim() || draft.title?.trim() || nameFromUrl(url)).slice(0, 40)
  const icon = draft.icon?.trim() || draft.resolvedIcon?.trim() || undefined

  return {
    id: createId(),
    name,
    url,
    ...(icon ? { icon } : {}),
    mono: name.slice(0, 1).toUpperCase(),
    color: colorFromUrl(url),
  }
}
