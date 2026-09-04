export const DEFAULT_SEARCH_ENGINE = 'baidu'

export const SEARCH_ENGINES = {
  baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=' },
  sogou: { name: '搜狗', url: 'https://www.sogou.com/web?query=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
}

export function normalizeSearchEngine(value) {
  return Object.hasOwn(SEARCH_ENGINES, value) ? value : DEFAULT_SEARCH_ENGINE
}
