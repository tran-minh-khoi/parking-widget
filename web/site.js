// Shared by every page: language (vi / en) and the header / footer.
const CONFIG = {
  appStoreUrl: '', // fill in when the app is on the App Store
  playUrl: '', // fill in when the app is on Google Play
  contact: 'contact@tranminhkhoi.dev',
  operator: 'MKTech',
  firebaseProject: 'mk-my-parking', // the project the share page reads from (change it for a fork)
};
const lang = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  const saved = (() => { try { return localStorage.getItem('lang'); } catch { return null; } })();
  return ((q || saved || navigator.language || 'en') + '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
})();
document.documentElement.dataset.lang = lang;
document.documentElement.lang = lang;

const ICON = {
  navigate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  apple: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5v17a1 1 0 0 0 1.5.9l14-8.5a1 1 0 0 0 0-1.8l-14-8.5A1 1 0 0 0 6 3.5z"/></svg>',
};

const TXT = {
  vi: { privacy: 'Chính sách quyền riêng tư', terms: 'Điều khoản sử dụng', other: 'English', dl: 'Tải ứng dụng', dlOn: 'Tải về trên', soon: 'Sắp ra mắt', by: 'Phát triển bởi' },
  en: { privacy: 'Privacy Policy', terms: 'Terms of Use', other: 'Tiếng Việt', dl: 'Get the app', dlOn: 'Download on', soon: 'Coming soon', by: 'Developed by' },
}[lang];

function chrome() {
  document.querySelectorAll('.op').forEach((e) => (e.textContent = CONFIG.operator));
  document.querySelectorAll('.mail').forEach((e) => { e.href = `mailto:${CONFIG.contact}`; e.textContent = CONFIG.contact; });
  document.querySelector('header.site')?.insertAdjacentHTML('beforeend', `<button class="lang" id="lang">${TXT.other}</button>`);
  document.getElementById('lang')?.addEventListener('click', () => {
    const next = lang === 'vi' ? 'en' : 'vi';
    try { localStorage.setItem('lang', next); } catch {}
    const u = new URL(location.href); u.searchParams.set('lang', next); location.href = u.toString();
  });
  const foot = document.querySelector('footer.site');
  if (foot) foot.innerHTML = `<a href="/privacy">${TXT.privacy}</a>·<a href="/terms">${TXT.terms}</a><br>${TXT.by} <a href="https://tranminhkhoi.dev" target="_blank" rel="noopener">tranminhkhoi.dev</a><br>© ${new Date().getFullYear()} ${CONFIG.operator}`;
}

// "Get the app" buttons. A store without a URL yet shows as "coming soon".
function storeButtons() {
  const one = (url, icon, name) =>
    `<a class="store" href="${url || '#'}" ${url ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'}>${icon}<span><small>${url ? TXT.dlOn : TXT.soon}</small><b>${name}</b></span></a>`;
  return `<h3 class="dl">${TXT.dl}</h3><div class="stores">${one(CONFIG.appStoreUrl, ICON.apple, 'App Store')}${one(CONFIG.playUrl, ICON.play, 'Google Play')}</div>`;
}
document.addEventListener('DOMContentLoaded', chrome);
