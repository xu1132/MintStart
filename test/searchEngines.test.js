import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SEARCH_ENGINE, normalizeSearchEngine, SEARCH_ENGINES } from '../src/data/searchEngines.js'

test('百度是默认搜索引擎', () => {
  assert.equal(DEFAULT_SEARCH_ENGINE, 'baidu')
  assert.equal(normalizeSearchEngine(null), 'baidu')
  assert.equal(normalizeSearchEngine('unknown'), 'baidu')
})

test('搜狗搜索引擎配置可用', () => {
  assert.equal(normalizeSearchEngine('sogou'), 'sogou')
  assert.equal(SEARCH_ENGINES.sogou.name, '搜狗')
  assert.equal(SEARCH_ENGINES.sogou.url, 'https://www.sogou.com/web?query=')
})
