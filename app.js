const BING_ARCHIVE = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN';
const WALLPAPER_CACHE = 'leave-space-bing-wallpaper';
const clockShell = document.querySelector('#clockShell');
const clock = document.querySelector('#clock');
const searchForm = document.querySelector('#searchForm');
const searchInput = document.querySelector('#searchInput');
const time = document.querySelector('#time');
const status = document.querySelector('#wallpaperStatus');
const engineToggle = document.querySelector('#engineToggle');
const engineMenu = document.querySelector('#engineMenu');
const engineName = document.querySelector('#engineName');
const engineMark = document.querySelector('#engineMark');
const searchEngines = {
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=' },
};
let closeTimer;
let activeEngine = localStorage.getItem('leave-space-search-engine') || 'bing';

function setTime() {
  const now = new Date();
  time.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function openSearch(focusInput = false) {
  clearTimeout(closeTimer);
  clockShell.classList.add('active');
  clock.setAttribute('aria-expanded', 'true');
  if (focusInput) window.setTimeout(() => searchInput.focus({ preventScroll: true }), 280);
}

function closeSearch(force = false) {
  closeTimer = window.setTimeout(() => {
    if (force || (!clockShell.matches(':hover') && !clockShell.contains(document.activeElement))) {
      clockShell.classList.remove('active');
      clock.setAttribute('aria-expanded', 'false');
      closeEngineMenu();
    }
  }, 140);
}

function closeEngineMenu() {
  engineMenu.classList.remove('open');
  engineToggle.setAttribute('aria-expanded', 'false');
}

function setSearchEngine(key) {
  const engine = searchEngines[key] || searchEngines.bing;
  activeEngine = searchEngines[key] ? key : 'bing';
  engineName.textContent = engine.name;
  engineMark.className = `engine-mark ${activeEngine}`;
  localStorage.setItem('leave-space-search-engine', activeEngine);
}

function showWallpaper(url) {
  document.documentElement.style.setProperty('--wallpaper', `url("${url}")`);
  document.querySelector('#wallpaper').classList.add('ready');
}

function getCachedWallpaper() {
  try { return JSON.parse(localStorage.getItem(WALLPAPER_CACHE) || 'null'); } catch { return null; }
}

function localDateKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

async function loadBingWallpaper() {
  const today = localDateKey();
  const cached = getCachedWallpaper();
  if (cached?.date === today && cached.url) {
    showWallpaper(cached.url);
    status.textContent = `今日壁纸：${cached.copyright || 'Bing 每日壁纸'}`;
    return;
  }

  try {
    const response = await fetch(`${BING_ARCHIVE}&_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Bing wallpaper request failed');
    const data = await response.json();
    const image = data.images?.[0];
    if (!image?.url) throw new Error('No Bing image returned');
    const url = new URL(image.url, 'https://www.bing.com').href;
    localStorage.setItem(WALLPAPER_CACHE, JSON.stringify({ date: today, url, copyright: image.copyright }));
    showWallpaper(url);
    status.textContent = `今日壁纸：${image.copyright || 'Bing 每日壁纸'}`;
  } catch (error) {
    if (cached?.url) {
      showWallpaper(cached.url);
      status.textContent = 'Bing 暂时不可用，已使用上次壁纸';
    } else {
      // Public fallback keeps the page usable when HPImageArchive is blocked by CORS.
      showWallpaper('https://bing.biturl.top/?resolution=1920&format=image');
      status.textContent = '正在使用 Bing 壁纸';
    }
  }
}

clockShell.addEventListener('mouseenter', () => openSearch());
clockShell.addEventListener('mouseleave', closeSearch);
searchInput.addEventListener('focus', () => openSearch());
searchInput.addEventListener('blur', closeSearch);
clock.addEventListener('click', () => {
  if (clockShell.classList.contains('active')) searchInput.focus();
  else openSearch(true);
});
clock.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSearch(true); }
});
engineToggle.addEventListener('click', () => {
  const isOpen = engineMenu.classList.toggle('open');
  engineToggle.setAttribute('aria-expanded', String(isOpen));
});
engineMenu.addEventListener('click', (event) => {
  const option = event.target.closest('[data-engine]');
  if (!option) return;
  setSearchEngine(option.dataset.engine);
  closeEngineMenu();
  searchInput.focus();
});
document.addEventListener('pointerdown', (event) => {
  if (!clockShell.contains(event.target)) {
    closeEngineMenu();
    closeSearch(true);
  }
});
searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return searchInput.focus();
  const looksLikeUrl = /^(https?:\/\/|www\.)/i.test(query) || /^[\w-]+\.[a-z]{2,}(\/.*)?$/i.test(query);
  const destination = looksLikeUrl ? (query.startsWith('http') ? query : `https://${query}`) : `${searchEngines[activeEngine].url}${encodeURIComponent(query)}`;
  window.open(destination, '_blank', 'noopener');
});

setTime();
setSearchEngine(activeEngine);
window.setInterval(setTime, 1000);
loadBingWallpaper();
