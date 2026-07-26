import './style.css';
import { parseFactionRoute, parseRosterRoute, route, startRouter, navigate } from './router';
import { renderFactionDetail, renderFactionList } from './pages/factions';
import { renderOfflinePrep } from './pages/offline-prep';
import { renderNewRoster, renderRosterList } from './pages/rosters';
import { renderRosterEditor } from './pages/roster-editor';
import { initDatasheetModal } from './datasheet/modal';
import { initToastHost } from './util/notify';
import { getLocale, localeLabel, onLocaleChange, t, toggleLocale } from './i18n';
import { registerSW } from 'virtual:pwa-register';

const app = document.querySelector<HTMLElement>('#app')!;
let shellReady = false;
let updateAvailable = false;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let remountCurrentRoute: (() => void) | null = null;

function ensureShell(): HTMLElement {
  if (!shellReady) {
    app.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <a href="#/" class="brand">Waha PWA Builder</a>
          <nav class="nav">
            <a href="#/" class="nav-link" data-i18n="nav.factions">${t('nav.factions')}</a>
            <a href="#/rosters" class="nav-link" data-i18n="nav.rosters">${t('nav.rosters')}</a>
          </nav>
          <button type="button" class="lang-toggle" id="lang-toggle" aria-label="Language">${localeLabel()}</button>
          <span id="online-status" class="status" aria-live="polite"></span>
        </header>
        <div id="update-banner" class="update-banner" hidden></div>
        <main class="main" id="main"></main>
        <div id="datasheet-modal-host" class="datasheet-modal-host" hidden></div>
        <div id="toast-host" class="toast-host" aria-live="polite"></div>
      </div>
    `;

    const toastHost = app.querySelector<HTMLElement>('#toast-host');
    if (toastHost) initToastHost(toastHost);

    const modalHost = app.querySelector<HTMLElement>('#datasheet-modal-host');
    if (modalHost) initDatasheetModal(modalHost);

    const status = app.querySelector<HTMLElement>('#online-status');
    const updateStatus = () => {
      if (!status) return;
      status.textContent = navigator.onLine ? '' : t('status.offline');
      status.classList.toggle('offline', !navigator.onLine);
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();

    app.querySelector('#lang-toggle')?.addEventListener('click', () => {
      toggleLocale();
    });

    onLocaleChange(() => {
      const toggle = app.querySelector<HTMLButtonElement>('#lang-toggle');
      if (toggle) toggle.textContent = localeLabel();
      for (const link of app.querySelectorAll<HTMLAnchorElement>('[data-i18n]')) {
        const key = link.dataset.i18n;
        if (key === 'nav.factions') link.textContent = t('nav.factions');
        if (key === 'nav.rosters') link.textContent = t('nav.rosters');
      }
      updateStatus();
      renderUpdateBanner();
      remountCurrentRoute?.();
    });

    shellReady = true;
  }

  renderUpdateBanner();
  return app.querySelector<HTMLElement>('#main')!;
}

function renderUpdateBanner() {
  const banner = app.querySelector<HTMLElement>('#update-banner');
  if (!banner) return;

  if (!updateAvailable) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }

  banner.hidden = false;
  banner.innerHTML = `
    <span class="update-banner-text">${t('update.available')}</span>
    <button type="button" class="btn small primary" id="sw-reload-btn">${t('update.reload')}</button>
    <button type="button" class="btn small ghost" id="sw-dismiss-btn">${t('update.later')}</button>
  `;

  banner.querySelector('#sw-reload-btn')?.addEventListener('click', () => {
    void applyUpdate?.(true);
  });
  banner.querySelector('#sw-dismiss-btn')?.addEventListener('click', () => {
    updateAvailable = false;
    renderUpdateBanner();
  });
}

async function renderHome() {
  remountCurrentRoute = () => void renderHome();
  const main = ensureShell();
  await renderFactionList(main);
}

async function renderFaction() {
  remountCurrentRoute = () => void renderFaction();
  const id = parseFactionRoute();
  if (!id) {
    navigate('/');
    return;
  }
  const main = ensureShell();
  await renderFactionDetail(main, id);
}

async function renderRosters() {
  remountCurrentRoute = () => void renderRosters();
  const main = ensureShell();
  await renderRosterList(main);
}

async function renderNewRosterPage() {
  remountCurrentRoute = () => void renderNewRosterPage();
  const parsed = parseRosterRoute();
  const main = ensureShell();
  const factionId = parsed?.kind === 'new' ? parsed.factionId : undefined;
  await renderNewRoster(main, factionId);
}

async function renderRosterEdit() {
  remountCurrentRoute = () => void renderRosterEdit();
  const parsed = parseRosterRoute();
  if (!parsed || parsed.kind !== 'edit') {
    navigate('/rosters');
    return;
  }
  const main = ensureShell();
  await renderRosterEditor(main, parsed.id);
}

async function renderOfflinePrepPage() {
  remountCurrentRoute = () => void renderOfflinePrepPage();
  const main = ensureShell();
  await renderOfflinePrep(main);
}

route('/', renderHome);
route('/rosters', renderRosters);
route('/roster/new', renderNewRosterPage);
route('/offline-prep', renderOfflinePrepPage);

startRouter(async () => {
  const rosterRoute = parseRosterRoute();
  if (rosterRoute?.kind === 'new' && window.location.hash.match(/^#\/roster\/new\//)) {
    await renderNewRosterPage();
    return;
  }
  if (rosterRoute?.kind === 'edit') {
    await renderRosterEdit();
    return;
  }
  if (window.location.hash.startsWith('#/faction/')) {
    await renderFaction();
    return;
  }
  await renderHome();
});

applyUpdate = registerSW({
  onNeedRefresh() {
    updateAvailable = true;
    renderUpdateBanner();
  },
});

void getLocale();
