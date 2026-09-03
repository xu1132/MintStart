import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeApps, renameFolder } from '../src/utils/desktop.js'

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
