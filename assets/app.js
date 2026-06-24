/* ============================================================
   Auto Content Hub — core logic (no token, GitHub-powered)
   ============================================================ */

const GITHUB_OWNER  = 'parthikchavda';
const GITHUB_REPO   = 'Parthik-Hub';
const GITHUB_BRANCH = 'main';

const SITE_TITLE = 'Parthik Hub';
const SITE_SUBTITLE = 'Explore, Learn & Enjoy All Resources';

const FILE_TYPES = {
  html: { exts: ['html', 'htm'], tag: 'WEB', tagClass: 'tag-web' },
  pdf:  { exts: ['pdf'],          tag: 'PDF', tagClass: 'tag-pdf' },
  image:{ exts: ['jpg','jpeg','png','gif','webp','svg'], tag: 'IMG', tagClass: 'tag-img' },
};

const IGNORE_PREFIXES = ['/assets/', '/.github/'];
const IGNORE_FILES = ['/index.html', '/README.md', '/.gitignore'];

// ============================================================
// localStorage state keys
// ============================================================
const LS_LAST_FILE        = 'ph_last_file';        // path of last opened file
const LS_OPEN_FOLDERS     = 'ph_open_folders';     // JSON array of open folder paths
const LS_SIDEBAR_STATE    = 'ph_sidebar_state';    // 'open' | 'closed'
const LS_FIRST_VISIT      = 'ph_first_visit';      // boolean flag
const LS_SCROLL_POS       = 'ph_scroll_pos';       // JSON {path: scrollY}
const LS_SEARCH_TEXT      = 'ph_search_text';      // last search query

// ---------- DOM ----------
const app = document.querySelector('.app');
const toggleBtn = document.getElementById('sidebarToggle');
const focusToggle = document.getElementById('focusToggle');
const backdrop = document.getElementById('backdrop');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const treeEl = document.getElementById('tree');
const footerCount = document.getElementById('footerCount');
const refreshBtn = document.getElementById('refreshBtn');
const contentEl = document.getElementById('content');
const headerTitleEl = document.getElementById('headerTitle');
const headerSubtitleEl = document.getElementById('headerSubtitle');

headerTitleEl.textContent = SITE_TITLE;
headerSubtitleEl.textContent = SITE_SUBTITLE;

let fileTree = null;
let flatFiles = [];
let activePath = null;
let openFolders = new Set();   // set of folder paths currently open
let isMobile = () => window.innerWidth <= 768;

// ============================================================
// localStorage helpers
// ============================================================

function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ============================================================
// Sidebar open/close — with state persistence
// ============================================================

function openSidebar() {
  if (isMobile()) app.classList.add('is-mobile-open');
  else { app.classList.remove('is-collapsed'); lsSet(LS_SIDEBAR_STATE, 'open'); }
}
function closeSidebar() {
  if (isMobile()) app.classList.remove('is-mobile-open');
  else { app.classList.add('is-collapsed'); lsSet(LS_SIDEBAR_STATE, 'closed'); }
}
function toggleSidebar() {
  if (isMobile()) app.classList.toggle('is-mobile-open');
  else {
    const willCollapse = !app.classList.contains('is-collapsed');
    app.classList.toggle('is-collapsed');
    lsSet(LS_SIDEBAR_STATE, willCollapse ? 'closed' : 'open');
  }
}
toggleBtn.addEventListener('click', toggleSidebar);
backdrop.addEventListener('click', () => { if (isMobile()) app.classList.remove('is-mobile-open'); });

// Sidebar initial state: open on first visit, then remember
const isFirstVisit = !lsGet(LS_FIRST_VISIT, false);
if (isFirstVisit) {
  lsSet(LS_FIRST_VISIT, true);
  if (isMobile()) app.classList.remove('is-collapsed');
  else app.classList.remove('is-collapsed');   // open on first visit
} else {
  const savedState = lsGet(LS_SIDEBAR_STATE, 'open');
  if (savedState === 'closed') app.classList.add('is-collapsed');
  else app.classList.remove('is-collapsed');
}

window.addEventListener('resize', () => {
  app.classList.remove('is-mobile-open');
});

// ============================================================
// Focus / reading mode
// ============================================================

const ICON_ENTER_FOCUS = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m11 0h3a2 2 0 0 0 2-2v-3"/></svg>`;
const ICON_EXIT_FOCUS  = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 21v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4"/></svg>`;

function setFocusMode(on) {
  app.classList.toggle('is-focus-mode', on);
  focusToggle.innerHTML = on ? ICON_EXIT_FOCUS : ICON_ENTER_FOCUS;
  focusToggle.title = on ? 'Show header & sidebar' : 'Focus mode — hide header & sidebar';
  focusToggle.setAttribute('aria-label', focusToggle.title);
}
focusToggle.addEventListener('click', () => setFocusMode(!app.classList.contains('is-focus-mode')));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && app.classList.contains('is-focus-mode')) setFocusMode(false);
});
setFocusMode(false);

// ============================================================
// Scroll position persistence
// ============================================================

function saveScrollPos(path, scrollY) {
  const all = lsGet(LS_SCROLL_POS, {});
  all[path] = scrollY;
  lsSet(LS_SCROLL_POS, all);
}
function getScrollPos(path) {
  const all = lsGet(LS_SCROLL_POS, {});
  return all[path] || 0;
}

// ============================================================
// GitHub fetch
// ============================================================

async function fetchDeployFiles() {
  const candidates = [GITHUB_BRANCH, 'main', 'master'].filter((b, i, arr) => arr.indexOf(b) === i);
  let lastErr = null;
  for (const branch of candidates) {
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${branch}?recursive=1`);
    } catch (e) {
      lastErr = new Error('Could not reach GitHub. Check your connection and try again.');
      continue;
    }
    if (res.status === 404) { lastErr = new Error(`Repo or branch not found. Check GITHUB_OWNER ("${GITHUB_OWNER}"), GITHUB_REPO ("${GITHUB_REPO}") and GITHUB_BRANCH at the top of assets/app.js.`); continue; }
    if (res.status === 403) throw new Error('GitHub\u2019s free API rate limit was hit. Wait a few minutes and try again.');
    if (!res.ok) { lastErr = new Error(`GitHub API error (${res.status}).`); continue; }
    const data = await res.json();
    if (data.truncated) console.warn('GitHub truncated this repo\u2019s file tree — some deeply nested files may be missing.');
    return (data.tree || []).filter(item => item.type === 'blob').map(item => '/' + item.path);
  }
  throw lastErr || new Error('Could not load the file list from GitHub.');
}

function classifyExt(path) {
  const ext = path.split('.').pop().toLowerCase();
  for (const [type, def] of Object.entries(FILE_TYPES)) {
    if (def.exts.includes(ext)) return type;
  }
  return null;
}

function shouldList(path) {
  if (IGNORE_FILES.includes(path)) return false;
  if (IGNORE_PREFIXES.some(p => path.startsWith(p))) return false;
  return !!classifyExt(path);
}

// ============================================================
// Build tree
// ============================================================

function buildTree(paths) {
  const root = { type: 'folder', name: '', children: {}, path: '' };
  flatFiles = [];
  paths.forEach(path => {
    const type = classifyExt(path);
    if (!type) return;
    const segments = path.split('/').filter(Boolean);
    let node = root;
    segments.forEach((seg, i) => {
      const isFile = i === segments.length - 1;
      if (isFile) {
        const fileNode = { type: 'file', name: seg, path, fileType: type };
        node.children[seg] = fileNode;
        flatFiles.push(fileNode);
      } else {
        if (!node.children[seg]) {
          node.children[seg] = { type: 'folder', name: seg, children: {}, path: (node.path ? node.path + '/' : '') + seg };
        }
        node = node.children[seg];
      }
    });
  });
  return root;
}

function folderFileCount(folder) {
  let n = 0;
  Object.values(folder.children).forEach(c => {
    n += c.type === 'file' ? 1 : folderFileCount(c);
  });
  return n;
}

// ============================================================
// Folder expansion — single expand with Ctrl+click for multi
// ============================================================

function toggleFolder(folderPath, multiExpand) {
  if (multiExpand) {
    // Ctrl+Click: toggle this folder without closing others
    if (openFolders.has(folderPath)) openFolders.delete(folderPath);
    else openFolders.add(folderPath);
  } else {
    // Normal click: close all siblings at the same level, open this one
    // We identify siblings by their parent path prefix
    const parentPrefix = folderPath.includes('/') ? folderPath.substring(0, folderPath.lastIndexOf('/')) : '';
    // Remove all folders that share the same parent (siblings)
    const toRemove = [...openFolders].filter(fp => {
      const fpParent = fp.includes('/') ? fp.substring(0, fp.lastIndexOf('/')) : '';
      return fpParent === parentPrefix && fp !== folderPath;
    });
    toRemove.forEach(fp => openFolders.delete(fp));

    if (openFolders.has(folderPath)) openFolders.delete(folderPath);
    else openFolders.add(folderPath);
  }
  lsSet(LS_OPEN_FOLDERS, [...openFolders]);
  refreshSidebar();
}

// ============================================================
// Render icons
// ============================================================

function iconFolder() {
  return `<svg class="node-folder__icon" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
}
function iconChevron() {
  return `<svg class="node-folder__chev" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
}
function iconFile(type) {
  if (type === 'pdf') return `<svg class="node-file__icon" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
  if (type === 'image') return `<svg class="node-file__icon" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
  return `<svg class="node-file__icon" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`;
}
function iconNewTab() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
}

function humanLabel(name) {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================
// Render tree -> sidebar
// ============================================================

function renderTree(root, container, query) {
  container.innerHTML = '';
  const entries = Object.values(root.children).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (!entries.length) {
    container.innerHTML = `<div class="sidebar__empty">No files yet. Drop files into a folder, push to GitHub, and they'll show up here on refresh.</div>`;
    return false;
  }

  let anyVisible = false;
  entries.forEach(node => {
    if (node.type === 'folder') {
      const el = document.createElement('div');
      el.className = 'node-folder';
      const count = folderFileCount(node);
      const isOpen = openFolders.has(node.path) || (query && true);
      if (isOpen) el.classList.add('is-open');

      el.innerHTML = `
        <div class="node-folder__row" title="${humanLabel(node.name)}">
          ${iconChevron()}${iconFolder()}
          <span class="node-folder__name">${humanLabel(node.name)}</span>
          <span class="node-folder__count">${count}</span>
        </div>
        <div class="node-folder__children"></div>`;
      const childrenEl = el.querySelector('.node-folder__children');
      const hasVisibleChild = renderTree(node, childrenEl, query);

      el.querySelector('.node-folder__row').addEventListener('click', (e) => {
        if (!query) toggleFolder(node.path, e.ctrlKey || e.metaKey);
        else el.classList.toggle('is-open');
      });

      if (!query) {
        container.appendChild(el);
        anyVisible = true;
      } else if (hasVisibleChild) {
        el.classList.add('is-open');
        container.appendChild(el);
        anyVisible = true;
      }
    } else {
      const matches = !query || node.name.toLowerCase().includes(query) || humanLabel(node.name).toLowerCase().includes(query);
      if (!matches) return;
      anyVisible = true;
      const def = FILE_TYPES[node.fileType];
      const el = document.createElement('div');
      el.className = 'node-file' + (node.path === activePath ? ' is-active' : '');
      el.setAttribute('title', humanLabel(node.name));

      // Build inner HTML with mobile "open in new tab" button
      el.innerHTML = `
        ${iconFile(node.fileType)}
        <span class="node-file__name">${humanLabel(node.name)}</span>
        <span class="node-file__tag ${def.tagClass}">${def.tag}</span>
        <button class="node-file__newtab" aria-label="Open in new tab" title="Open in new tab">${iconNewTab()}</button>`;

      // Open in new tab button (mobile-friendly)
      el.querySelector('.node-file__newtab').addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(location.origin + node.path, '_blank');
      });

      // Click: open file; Ctrl+Click: new tab
      el.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          window.open(location.origin + node.path, '_blank');
        } else {
          openFile(node);
        }
      });

      container.appendChild(el);
    }
  });

  return anyVisible;
}

function refreshSidebar() {
  const query = (searchInput.value || '').trim().toLowerCase();
  searchClear.classList.toggle('show', !!query);
  const hasAny = renderTree(fileTree, treeEl, query);
  if (!hasAny && query) {
    treeEl.innerHTML = `<div class="sidebar__empty">No matches for "${searchInput.value}".</div>`;
  }
  footerCount.textContent = `${flatFiles.length} item${flatFiles.length === 1 ? '' : 's'}`;
}

// Restore search text from localStorage
const savedSearch = lsGet(LS_SEARCH_TEXT, '');
if (savedSearch) searchInput.value = savedSearch;

searchInput.addEventListener('input', () => {
  lsSet(LS_SEARCH_TEXT, searchInput.value);
  refreshSidebar();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  lsSet(LS_SEARCH_TEXT, '');
  refreshSidebar();
  searchInput.focus();
});

// On mobile: keep sidebar open when search is focused/used
searchInput.addEventListener('focus', () => {
  if (isMobile()) app.classList.add('is-mobile-open');
});

// ============================================================
// Content loading
// ============================================================

function openFile(node) {
  activePath = node.path;
  lsSet(LS_LAST_FILE, node.path);
  refreshSidebar();

  const fullUrl = location.origin + node.path;

  if (node.fileType === 'image') {
    contentEl.innerHTML = `<div class="content__image-wrap"><img src="${fullUrl}" alt="${humanLabel(node.name)}"></div>`;
  } else {
    const savedScroll = getScrollPos(node.path);
    contentEl.innerHTML = `<iframe class="content__frame" src="${fullUrl}" title="${humanLabel(node.name)}" id="contentFrame"></iframe>`;

    // Restore scroll position after iframe loads
    const frame = document.getElementById('contentFrame');
    if (frame && savedScroll) {
      frame.addEventListener('load', () => {
        try { frame.contentWindow.scrollTo(0, savedScroll); } catch {}
      });
    }

    // Periodically save iframe scroll position
    let scrollSaver = null;
    if (frame) {
      frame.addEventListener('load', () => {
        if (scrollSaver) clearInterval(scrollSaver);
        scrollSaver = setInterval(() => {
          try {
            const sy = frame.contentWindow.scrollY;
            if (sy !== undefined) saveScrollPos(node.path, sy);
          } catch {}
        }, 1000);
      });
    }
  }

  // On mobile: close sidebar after selecting a file (but not if search is focused)
  if (isMobile() && document.activeElement !== searchInput) {
    app.classList.remove('is-mobile-open');
  }
}

// ============================================================
// Restore folder state from localStorage
// ============================================================

function restoreFolderState() {
  const savedFolders = lsGet(LS_OPEN_FOLDERS, []);
  openFolders = new Set(savedFolders);
}

// ============================================================
// Restore last opened file
// ============================================================

function restoreLastFile() {
  const lastPath = lsGet(LS_LAST_FILE, null);
  if (!lastPath) return;
  const node = flatFiles.find(f => f.path === lastPath);
  if (node) {
    // Ensure the parent folder(s) are open
    const segments = lastPath.split('/').filter(Boolean);
    let accumulated = '';
    segments.slice(0, -1).forEach(seg => {
      accumulated = accumulated ? accumulated + '/' + seg : seg;
      openFolders.add(accumulated);
    });
    lsSet(LS_OPEN_FOLDERS, [...openFolders]);
    openFile(node);
    refreshSidebar();
  }
}

// ============================================================
// Placeholder / error / loading states
// ============================================================

function showPlaceholder() {
  contentEl.innerHTML = `
    <div class="placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      <div class="placeholder__title">Pick something from the sidebar</div>
      <div class="placeholder__sub">Every website, PDF, and image you add to a folder shows up there automatically.</div>
    </div>`;
}

function showError(msg) {
  contentEl.innerHTML = `
    <div class="state-panel">
      <div class="state-panel__title">Couldn't load the file list</div>
      <div class="state-panel__sub">${msg}</div>
      <button class="state-panel__btn" id="retryBtn">Try again</button>
    </div>`;
  document.getElementById('retryBtn').addEventListener('click', init);
}

function showLoading() {
  contentEl.innerHTML = `
    <div class="placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .9s linear infinite;transform-origin:center"><path d="M21 12a9 9 0 1 1-2.64-6.36"/></svg>
      <div class="placeholder__title">Loading content list…</div>
    </div>`;
}

// ============================================================
// Init
// ============================================================

async function init() {
  showLoading();
  refreshBtn.classList.add('is-loading');
  try {
    const paths = await fetchDeployFiles();
    const listable = paths.filter(shouldList);
    restoreFolderState();
    fileTree = buildTree(listable);
    refreshSidebar();
    restoreLastFile() || showPlaceholder();
  } catch (e) {
    showError(e.message || 'Something went wrong talking to GitHub.');
  } finally {
    refreshBtn.classList.remove('is-loading');
  }
}

// restoreLastFile returns the node if found, showPlaceholder otherwise
function restoreLastFile() {
  const lastPath = lsGet(LS_LAST_FILE, null);
  if (!lastPath) return false;
  const node = flatFiles.find(f => f.path === lastPath);
  if (!node) return false;
  // Open parent folders
  const segments = lastPath.split('/').filter(Boolean);
  let accumulated = '';
  segments.slice(0, -1).forEach(seg => {
    accumulated = accumulated ? accumulated + '/' + seg : seg;
    openFolders.add(accumulated);
  });
  lsSet(LS_OPEN_FOLDERS, [...openFolders]);
  openFile(node);
  refreshSidebar();
  return true;
}

refreshBtn.addEventListener('click', init);
init();
