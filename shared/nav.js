import { TOOLS } from '/tools.js';

const NAV_CSS = `
#hub-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 40px;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 1.25rem;
  background: #0a0e1a;
  border-bottom: 1px solid #3a3f5c;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.72rem;
  box-sizing: border-box;
}
#hub-nav * { box-sizing: border-box; }
#hub-nav a {
  color: #7b82a8;
  text-decoration: none;
  white-space: nowrap;
  padding: 0 0.6rem;
  transition: color 0.15s;
}
#hub-nav a:hover { color: #e8eaf6; }
#hub-nav a.active { color: #e8eaf6; }
.hub-brand {
  color: #00ff9d !important;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-shadow: 0 0 8px #00ff9d88;
  margin-right: 0.5rem;
}
.hub-brand:hover { color: #00ff9d !important; }
.hub-tools {
  display: flex;
  align-items: center;
  flex: 1;
}
.hub-extras {
  display: flex;
  align-items: center;
  margin-left: auto;
}
.hub-yt {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
`;

function injectStyles() {
  if (document.getElementById('hub-nav-styles')) return;
  const style = document.createElement('style');
  style.id = 'hub-nav-styles';
  style.textContent = NAV_CSS;
  document.head.appendChild(style);
}

function buildNav() {
  const path = window.location.pathname;

  const nav = document.createElement('nav');
  nav.id = 'hub-nav';
  nav.setAttribute('aria-label', 'Site navigation');

  // Brand
  const brand = document.createElement('a');
  brand.className = 'hub-brand';
  brand.href = '/';
  brand.textContent = 'MR. SHIP';
  nav.appendChild(brand);

  // Tool links
  const toolsDiv = document.createElement('div');
  toolsDiv.className = 'hub-tools';
  for (const tool of TOOLS) {
    if (tool.status !== 'live') continue;
    const link = document.createElement('a');
    link.href = tool.path;
    link.textContent = tool.title;
    if (path.startsWith(tool.path)) link.classList.add('active');
    toolsDiv.appendChild(link);
  }
  nav.appendChild(toolsDiv);

  // Extras: AP MAP + YouTube
  const extrasDiv = document.createElement('div');
  extrasDiv.className = 'hub-extras';

  const apMap = document.createElement('a');
  apMap.href = '/ap-map/';
  apMap.textContent = 'AP MAP';
  if (path.startsWith('/ap-map/')) apMap.classList.add('active');
  extrasDiv.appendChild(apMap);

  const yt = document.createElement('a');
  yt.href = 'https://www.youtube.com/@amdgship/shorts';
  yt.target = '_blank';
  yt.rel = 'noopener noreferrer';
  yt.className = 'hub-yt';
  yt.setAttribute('aria-label', 'YouTube Shorts');
  yt.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>`;
  extrasDiv.appendChild(yt);

  nav.appendChild(extrasDiv);
  return nav;
}

export function initNav() {
  injectStyles();
  const nav = buildNav();
  const anchor = document.querySelector('main') ?? document.body.firstElementChild;
  document.body.insertBefore(nav, anchor);
}
