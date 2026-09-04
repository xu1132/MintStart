import test from 'node:test'
import assert from 'node:assert/strict'
import { submitSearch } from '../src/utils/search.js'

const baidu = { url: 'https://www.baidu.com/s?wd=' }

test('successful search opens the destination before clearing the query', () => {
  const events = []
  const submitted = submitSearch('  薄荷起始页  ', baidu, {
    open: (...args) => events.push(['open', ...args]),
    clear: () => events.push(['clear']),
  })

  assert.equal(submitted, true)
  assert.deepEqual(events, [
    ['open', 'https://www.baidu.com/s?wd=%E8%96%84%E8%8D%B7%E8%B5%B7%E5%A7%8B%E9%A1%B5', '_blank', 'noopener'],
    ['clear'],
  ])
})

test('blank search does not open a page or clear the query', () => {
  let opened = false
  let cleared = false
  const submitted = submitSearch('   ', baidu, {
    open: () => { opened = true },
    clear: () => { cleared = true },
  })

  assert.equal(submitted, false)
  assert.equal(opened, false)
  assert.equal(cleared, false)
})

test('direct URL search still clears the query after opening', () => {
  let destination
  let cleared = false
  submitSearch('example.com/docs', baidu, {
    open: (url) => { destination = url },
    clear: () => { cleared = true },
  })

  assert.equal(destination, 'https://example.com/docs')
  assert.equal(cleared, true)
})
