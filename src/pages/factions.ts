import { renderStatsPreviewHtml, openDatasheetModal } from '../datasheet/modal';
import { loadFactionIndex, loadFactionPack, loadManifest, getUnitPoints, isOfflineDataError } from '../data/loader';
import { escapeHtml } from '../util/html';
import { navigate } from '../router';
import { renderOfflineError } from '../util/offline-ui';

export async function renderFactionList(root: HTMLElement) {
  root.innerHTML = '<p class="loading">Loading factions…</p>';

  try {
    const [manifest, factions] = await Promise.all([loadManifest(), loadFactionIndex()]);
    factions.sort((a, b) => a.name.localeCompare(b.name));

    root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <div>
          <h2>Factions</h2>
          <p class="muted">Data pack v${manifest.packVersion} · ${manifest.wahapedia.datasheetCount} datasheets</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn ghost" id="offline-prep-btn">Prepare offline</button>
          <input type="search" id="faction-search" placeholder="Search factions…" class="search" />
        </div>
      </header>
      <ul class="faction-grid" id="faction-list">
        ${factions
          .map(
            (faction) => `
          <li>
            <button type="button" class="faction-card" data-id="${faction.id}" data-path="${faction.path}">
              <span class="faction-name">${faction.name}</span>
              <span class="faction-meta">${faction.datasheetCount} units · ${faction.detachmentCount} detachments</span>
            </button>
          </li>`,
          )
          .join('')}
      </ul>
      <footer class="attribution">
        <a href="${manifest.attribution.wahapedia}" target="_blank" rel="noopener">Wahapedia</a>
        ·
        <a href="${manifest.attribution.mfm}" target="_blank" rel="noopener">MFM</a>
      </footer>
    </section>
  `;

    const search = root.querySelector<HTMLInputElement>('#faction-search');
    const cards = () => [...root.querySelectorAll<HTMLButtonElement>('.faction-card')];

    search?.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      for (const card of cards()) {
        const name = card.querySelector('.faction-name')?.textContent?.toLowerCase() ?? '';
        card.closest('li')!.hidden = query.length > 0 && !name.includes(query);
      }
    });

    for (const card of cards()) {
      card.addEventListener('click', () => {
        navigate(`/faction/${card.dataset.id}`);
      });
    }

    root.querySelector('#offline-prep-btn')?.addEventListener('click', () => navigate('/offline-prep'));
  } catch (error) {
    const message = isOfflineDataError(error) ? error.message : 'Could not load factions.';
    renderOfflineError(root, 'Offline', message);
  }
}

export async function renderFactionDetail(root: HTMLElement, factionId: string) {
  root.innerHTML = '<p class="loading">Loading faction…</p>';

  try {
    const index = await loadFactionIndex();
    const entry = index.find((f) => f.id === factionId);
    if (!entry) {
      root.innerHTML = `<p class="error">Faction not found.</p>`;
      return;
    }

    const pack = await loadFactionPack(entry.id, entry.path);
    const withPoints = pack.datasheets.filter((d) => getUnitPoints(d) !== null).length;

    pack.datasheets.sort((a, b) => a.name.localeCompare(b.name));

    root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <button type="button" class="back" id="back-btn">← Factions</button>
        <div>
          <h2>${pack.name}</h2>
          <p class="muted">${pack.datasheetCount} datasheets · ${withPoints} with MFM points</p>
        </div>
        <button type="button" class="btn primary" id="build-roster-btn">Build roster</button>
      </header>
      <ul class="datasheet-list">
        ${pack.datasheets
          .map((sheet) => {
            const points = getUnitPoints(sheet);
            return `
          <li class="datasheet-row">
            <div class="datasheet-main">
              <button type="button" class="datasheet-name-btn" data-datasheet-id="${sheet.id}">${escapeHtml(sheet.name)}</button>
              ${renderStatsPreviewHtml(sheet)}
            </div>
            <span class="datasheet-role">${escapeHtml(sheet.role ?? '')}</span>
            <span class="datasheet-points">${points !== null ? `${points} pts` : '—'}</span>
          </li>`;
          })
          .join('')}
      </ul>
    </section>
  `;

    root.querySelector('#back-btn')?.addEventListener('click', () => navigate('/'));
    root.querySelector('#build-roster-btn')?.addEventListener('click', () => navigate(`/roster/new/${factionId}`));

    const sheets = new Map(pack.datasheets.map((sheet) => [sheet.id, sheet]));
    for (const btn of root.querySelectorAll<HTMLButtonElement>('.datasheet-name-btn')) {
      btn.addEventListener('click', () => {
        const sheet = sheets.get(btn.dataset.datasheetId ?? '');
        if (sheet) openDatasheetModal(sheet, { mode: 'view' });
      });
    }
  } catch (error) {
    const message = isOfflineDataError(error) ? error.message : 'Could not load this faction.';
    renderOfflineError(root, 'Offline', message);
  }
}
