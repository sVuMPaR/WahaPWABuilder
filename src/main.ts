import './style.css';
import { parseFactionRoute, parseRosterRoute, route, startRouter, navigate } from './router';
import { renderFactionDetail, renderFactionList } from './pages/factions';
import { renderNewRoster, renderRosterList } from './pages/rosters';
import { renderRosterEditor } from './pages/roster-editor';
import { registerSW } from 'virtual:pwa-register';

const app = document.querySelector<HTMLElement>('#app')!;

function shell(content: string) {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a href="#/" class="brand">Waha PWA Builder</a>
        <nav class="nav">
          <a href="#/" class="nav-link">Factions</a>
          <a href="#/rosters" class="nav-link">Rosters</a>
        </nav>
        <span id="online-status" class="status" aria-live="polite"></span>
      </header>
      <main class="main" id="main">${content}</main>
    </div>
  `;

  const status = app.querySelector<HTMLElement>('#online-status');
  const updateStatus = () => {
    if (!status) return;
    status.textContent = navigator.onLine ? '' : 'Offline';
    status.classList.toggle('offline', !navigator.onLine);
  };
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();

  return app.querySelector<HTMLElement>('#main')!;
}

async function renderHome() {
  const main = shell('');
  await renderFactionList(main);
}

async function renderFaction() {
  const id = parseFactionRoute();
  if (!id) {
    navigate('/');
    return;
  }
  const main = shell('');
  await renderFactionDetail(main, id);
}

async function renderRosters() {
  const main = shell('');
  await renderRosterList(main);
}

async function renderNewRosterPage() {
  const parsed = parseRosterRoute();
  const main = shell('');
  const factionId = parsed?.kind === 'new' ? parsed.factionId : undefined;
  await renderNewRoster(main, factionId);
}

async function renderRosterEdit() {
  const parsed = parseRosterRoute();
  if (!parsed || parsed.kind !== 'edit') {
    navigate('/rosters');
    return;
  }
  const main = shell('');
  await renderRosterEditor(main, parsed.id);
}

route('/', renderHome);
route('/rosters', renderRosters);
route('/roster/new', renderNewRosterPage);

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

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New version available. Reload?')) updateSW(true);
  },
});
