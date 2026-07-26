import { renderStatsPreviewHtml, openDatasheetModal } from '../datasheet/modal';
import { loadFactionIndex, loadFactionPack, loadManifest, getUnitPoints, isOfflineDataError } from '../data/loader';
import { escapeHtml } from '../util/html';
import { navigate } from '../router';
import { renderOfflineError } from '../util/offline-ui';
import { t } from '../i18n';
import { ARMY_ROLE_ORDER, armyRoleLabel, groupDatasheetsByRole } from '../roster/roles';

export async function renderFactionList(root: HTMLElement) {
  root.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

  try {
    const [manifest, factions] = await Promise.all([loadManifest(), loadFactionIndex()]);
    factions.sort((a, b) => a.name.localeCompare(b.name));

    root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <div>
          <h2>${t('factions.title')}</h2>
          <p class="muted">${t('factions.meta', {
            version: manifest.packVersion,
            count: manifest.wahapedia.datasheetCount,
          })}</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn ghost" id="offline-prep-btn">${t('rosters.prepareOffline')}</button>
          <input type="search" id="faction-search" placeholder="${t('factions.search')}" class="search" />
        </div>
      </header>
      <ul class="faction-grid" id="faction-list">
        ${factions
          .map(
            (faction) => `
          <li>
            <button type="button" class="faction-card" data-id="${faction.id}" data-path="${faction.path}">
              <span class="faction-name">${faction.name}</span>
              <span class="faction-meta">${t('factions.units', { count: faction.datasheetCount })} · ${t('factions.detachments', {
                count: faction.detachmentCount,
              })}</span>
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
    const message = isOfflineDataError(error) ? error.message : t('factions.loadError');
    renderOfflineError(root, t('status.offline'), message);
  }
}

export async function renderFactionDetail(root: HTMLElement, factionId: string) {
  root.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

  try {
    const index = await loadFactionIndex();
    const entry = index.find((f) => f.id === factionId);
    if (!entry) {
      root.innerHTML = `<p class="error">${t('factions.notFound')}</p>`;
      return;
    }

    const pack = await loadFactionPack(entry.id, entry.path);
    const withPoints = pack.datasheets.filter((d) => getUnitPoints(d) !== null).length;
    const groups = groupDatasheetsByRole(pack.datasheets);

    root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <button type="button" class="back" id="back-btn">← ${t('factions.title')}</button>
        <div>
          <h2>${pack.name}</h2>
          <p class="muted">${pack.datasheetCount} · ${t('factions.withPoints', { count: withPoints })}</p>
        </div>
        <button type="button" class="btn primary" id="build-roster-btn">${t('factions.buildRoster')}</button>
      </header>
      ${ARMY_ROLE_ORDER.map((group) => {
        const sheets = groups.get(group) ?? [];
        if (sheets.length === 0) return '';
        return `
      <div class="army-group">
        <h3 class="army-group-title">${armyRoleLabel(group)} <span class="muted">(${sheets.length})</span></h3>
        <ul class="datasheet-list">
          ${sheets
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
      </div>`;
      }).join('')}
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
    const message = isOfflineDataError(error) ? error.message : t('factions.loadError');
    renderOfflineError(root, t('status.offline'), message);
  }
}
