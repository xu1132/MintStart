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
