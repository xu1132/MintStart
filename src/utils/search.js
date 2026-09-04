export function submitSearch(query, engine, { open, clear }) {
  const value = query?.trim()
  if (!value) return false

  const looksLikeUrl = /^(https?:\/\/|www\.)/i.test(value) || /^[\w-]+\.[a-z]{2,}(\/.*)?$/i.test(value)
  const destination = looksLikeUrl
    ? (value.startsWith('http') ? value : `https://${value}`)
    : `${engine.url}${encodeURIComponent(value)}`

  open(destination, '_blank', 'noopener')
  clear()
  return true
}
