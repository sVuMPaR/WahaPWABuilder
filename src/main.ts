import './style.css';
import { parseFactionRoute, route, startRouter, navigate } from './router';
import { renderFactionDetail, renderFactionList, renderRostersStub } from './pages/factions';
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
  await renderRostersStub(main);
}

route('/', renderHome);
route('/rosters', renderRosters);

startRouter(async () => {
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
