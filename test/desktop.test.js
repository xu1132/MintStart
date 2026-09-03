import test from 'node:test'
import assert from 'node:assert/strict'
import { createDesktopApp, dissolveFolder, mergeApps, normalizeAppUrl, renameFolder, replaceDesktopApp } from '../src/utils/desktop.js'

const alpha = { id: 'a', name: 'Alpha', url: 'https://a.example' }
const beta = { id: 'b', name: 'Beta', url: 'https://b.example' }
const gamma = { id: 'c', name: 'Gamma', url: 'https://c.example' }

test('dropping an app onto another app creates a folder with both icons', () => {
  const result = mergeApps([alpha, beta, gamma], 'a', 'b', () => 'folder-1')
  assert.equal(result.length, 2)
  assert.deepEqual(result[0], {
    id: 'folder-1',
    type: 'folder',
    name: '新建文件夹',
    items: [beta, alpha],
  })
  assert.equal(result[1], gamma)
})

test('dropping an app onto a folder preserves the folder and app icons', () => {
  const folder = { id: 'folder-1', type: 'folder', name: '工作', items: [alpha, beta] }
  const result = mergeApps([folder, gamma], 'c', 'folder-1')
  assert.equal(result.length, 1)
  assert.deepEqual(result[0].items, [alpha, beta, gamma])
})

test('dropping a folder onto an app flattens its icons into the new folder', () => {
  const folder = { id: 'folder-1', type: 'folder', name: '工作', items: [alpha, beta] }
  const result = mergeApps([folder, gamma], 'folder-1', 'c', () => 'folder-2')
  assert.deepEqual(result[0].items, [gamma, alpha, beta])
})

test('folder rename trims whitespace and preserves other entries', () => {
  const folder = { id: 'folder-1', type: 'folder', name: '新建文件夹', items: [alpha, beta] }
  const result = renameFolder([folder, gamma], 'folder-1', '  工作  ')
  assert.equal(result[0].name, '工作')
  assert.equal(result[1], gamma)
})

test('blank folder names are ignored', () => {
  const folder = { id: 'folder-1', type: 'folder', name: '工作', items: [alpha] }
  assert.equal(renameFolder([folder], 'folder-1', '   ')[0].name, '工作')
})

test('dissolving a folder puts its apps back into the original grid position', () => {
  const folder = { id: 'folder-1', type: 'folder', name: '工作', items: [alpha, beta] }
  const result = dissolveFolder([gamma, folder], 'folder-1')
  assert.deepEqual(result, [gamma, alpha, beta])
})

test('editing an app replaces only that app while preserving order', () => {
  const edited = { ...beta, name: 'Beta 编辑版', icon: 'https://example.com/icon.png' }
  const result = replaceDesktopApp([alpha, beta, gamma], edited)
  assert.deepEqual(result, [alpha, edited, gamma])
})

test('app URLs are normalized and reject unsafe protocols', () => {
  assert.equal(normalizeAppUrl('example.com'), 'https://example.com/')
  assert.throws(() => normalizeAppUrl('javascript:alert(1)'), /仅支持/)
})

test('new apps prefer custom fields and fall back to resolved website metadata', () => {
  const fromMetadata = createDesktopApp({
    url: 'example.com',
    title: 'Example Site',
    resolvedIcon: 'https://example.com/icon.png',
  }, () => 'app-1')
  assert.deepEqual(fromMetadata, {
    id: 'app-1',
    name: 'Example Site',
    url: 'https://example.com/',
    icon: 'https://example.com/icon.png',
    mono: 'E',
    color: fromMetadata.color,
  })

  const custom = createDesktopApp({
    url: 'https://example.com/path',
    name: ' 我的入口 ',
    icon: ' https://cdn.example.com/custom.svg ',
    title: 'Ignored title',
  }, () => 'app-2')
  assert.equal(custom.name, '我的入口')
  assert.equal(custom.icon, 'https://cdn.example.com/custom.svg')
})
