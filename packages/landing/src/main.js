import { createOrb } from '@lifetracker/shared/orb';
import './style.css';

const REPO = 'amarnathgaddam75/Productivity_Tracker-';
const sections = [...document.querySelectorAll('.panel')];
const ticks = [...document.querySelectorAll('.ticks a')];
const root = document.documentElement;

// ---- particle body ----------------------------------------------------------------
const small = matchMedia('(max-width: 760px)').matches;
const canvas = document.getElementById('orb');
let orb = null;
try {
  orb = createOrb(canvas, { count: small ? 60000 : 110000, scale: small ? 0.8 : 0.72, point: small ? 1.3 : 2 });
} catch (err) {
  console.warn('WebGL unavailable, using the static orb', err);
}
if (!orb) document.body.classList.add('no-webgl');
document.getElementById('count-line').textContent = `${(orb?.count ?? 0).toLocaleString('en-US')} particles`;

function hexToRgbTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

// ---- section tracking -------------------------------------------------------------
let active = -1;
function activate(i) {
  if (i === active) return;
  active = i;
  const s = sections[i];
  const color = s.dataset.color;
  orb?.set({ shape: s.dataset.shape, color, energy: i === 2 ? 0.9 : 0.45, offset: small ? [0, 0.32] : [0, 0] });
  root.style.setProperty('--accent', color);
  root.style.setProperty('--glow', hexToRgbTriplet(color));
  document.getElementById('tech-line').textContent = s.dataset.tech;
  ticks.forEach((t, k) => t.classList.toggle('active', k === i));
  history.replaceState(null, '', i ? `#${s.id}` : location.pathname);
}

function onScroll() {
  const y = window.scrollY;
  const h = window.innerHeight;
  const i = Math.max(0, Math.min(sections.length - 1, Math.round(y / h)));
  activate(i);
  const max = document.documentElement.scrollHeight - h;
  document.getElementById('progress-bar').style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
  document.getElementById('hint').style.opacity = y > h * 0.5 ? '0' : '1';
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);

const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
  { threshold: 0.35 },
);
sections.forEach((s) => io.observe(s));

// ---- menu -------------------------------------------------------------------------
const menu = document.getElementById('menu');
const menuBtn = document.getElementById('menu-btn');
function setMenu(open) {
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// ---- download links from the latest GitHub release ---------------------------------
const PATTERNS = {
  win: [/-win-x64\.exe$/i, /\.exe$/i],
  mac: [navigator.userAgent.includes('Mac') && /arm|aarch/i.test(navigator.userAgent) ? /arm64\.dmg$/i : /x64\.dmg$/i, /\.dmg$/i],
  linux: [/\.AppImage$/i, /\.deb$/i],
};
fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((rel) => {
    const assets = rel.assets || [];
    for (const a of document.querySelectorAll('[data-os]')) {
      const hit = PATTERNS[a.dataset.os].map((re) => assets.find((x) => re.test(x.name))).find(Boolean);
      if (hit) a.href = hit.browser_download_url;
    }
    document.getElementById('release-line').textContent = `${rel.name || rel.tag_name} / unsigned build — see setup notes on GitHub`;
  })
  .catch(() => {
    /* links keep pointing at the releases page */
  });

// initial state
const start = sections.findIndex((s) => `#${s.id}` === location.hash);
if (start > 0) sections[start].scrollIntoView();
onScroll();
if (active >= 0) orb?.set({ immediate: true });
sections[Math.max(0, active)].classList.add('in');
