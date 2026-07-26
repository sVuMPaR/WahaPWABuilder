import { loadFactionIndex, loadManifest, isOfflineDataError } from '../data/loader';
import { deleteRoster, listRosters, saveRoster } from '../db/store';
import { rosterGrandTotal } from '../roster/points';
import { escapeHtml } from '../util/html';
import { renderOfflineError } from '../util/offline-ui';
import { showToast } from '../util/notify';
import { navigate } from '../router';
import { t } from '../i18n';
import type { BattleSize, Roster } from '../types';
import { BATTLE_SIZE_LIMITS, CUSTOM_POINT_LIMIT } from '../types';

let pendingDeleteId: string | null = null;

function battleSizeLabel(size: BattleSize): string {
  switch (size) {
    case 'incursion':
      return t('battle.incursion');
    case 'strike-force':
      return t('battle.strikeForce');
    case 'onslaught':
      return t('battle.onslaught');
    default:
      return t('roster.new.custom');
  }
}

function pointLimitForBattleSize(battleSize: BattleSize, customPoints?: number): number {
  if (battleSize === 'custom') {
    const custom = customPoints ?? CUSTOM_POINT_LIMIT.default;
    return Number.isFinite(custom) && custom >= CUSTOM_POINT_LIMIT.min && custom <= CUSTOM_POINT_LIMIT.max
      ? custom
      : CUSTOM_POINT_LIMIT.default;
  }
  return BATTLE_SIZE_LIMITS[battleSize];
}

export async function renderRosterList(root: HTMLElement) {
  root.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

  try {
    const [rosters, factions, manifest] = await Promise.all([
      listRosters(),
      loadFactionIndex(),
      loadManifest(),
    ]);

    const factionNames = new Map(factions.map((f) => [f.id, f.name]));

    root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <div>
          <h2>${t('rosters.title')}</h2>
          <p class="muted">${t('rosters.meta', { version: escapeHtml(manifest.packVersion) })}</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn ghost" id="offline-prep-btn">${t('rosters.prepareOffline')}</button>
          <button type="button" class="btn primary" id="new-roster-btn">${t('rosters.new')}</button>
        </div>
      </header>
      ${
        rosters.length === 0
          ? `<p class="empty">${t('rosters.empty')}</p>`
          : `<ul class="roster-list">
        ${rosters
          .map((roster) => {
            const total = rosterGrandTotal(roster);
            const over = total > roster.pointLimit;
            const confirming = pendingDeleteId === roster.id;
            return `
          <li class="roster-card${confirming ? ' confirming' : ''}">
            <button type="button" class="roster-open" data-id="${roster.id}"${confirming ? ' disabled' : ''}>
              <span class="roster-card-name">${escapeHtml(roster.name)}</span>
              <span class="roster-card-meta">${escapeHtml(factionNames.get(roster.factionId) ?? roster.factionName)}${roster.detachmentName ? ` · ${escapeHtml(roster.detachmentName)}` : ''}</span>
              <span class="roster-card-points ${over ? 'over' : ''}">${total} / ${roster.pointLimit} pts</span>
            </button>
            ${
              confirming
                ? `<div class="delete-confirm">
              <span class="delete-confirm-text">${t('rosters.deleteConfirm')}</span>
              <button type="button" class="btn small danger confirm-delete" data-id="${roster.id}">${t('common.delete')}</button>
              <button type="button" class="btn small ghost cancel-delete">${t('common.cancel')}</button>
            </div>`
                : `<button type="button" class="btn icon danger roster-delete" data-id="${roster.id}" title="${t('common.delete')}">×</button>`
            }
          </li>`;
          })
          .join('')}
      </ul>`
      }
    </section>
  `;

    root.querySelector('#new-roster-btn')?.addEventListener('click', () => navigate('/roster/new'));
    root.querySelector('#offline-prep-btn')?.addEventListener('click', () => navigate('/offline-prep'));

    for (const btn of root.querySelectorAll<HTMLButtonElement>('.roster-open')) {
      btn.addEventListener('click', () => navigate(`/roster/${btn.dataset.id}`));
    }

    for (const btn of root.querySelectorAll<HTMLButtonElement>('.roster-delete')) {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        pendingDeleteId = btn.dataset.id ?? null;
        void renderRosterList(root);
      });
    }

    for (const btn of root.querySelectorAll<HTMLButtonElement>('.cancel-delete')) {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        pendingDeleteId = null;
        void renderRosterList(root);
      });
    }

    for (const btn of root.querySelectorAll<HTMLButtonElement>('.confirm-delete')) {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const id = btn.dataset.id;
        if (!id) return;
        await deleteRoster(id);
        pendingDeleteId = null;
        showToast(t('rosters.deleted'), 'info', 2500);
        await renderRosterList(root);
      });
    }
  } catch (error) {
    pendingDeleteId = null;
    const message = isOfflineDataError(error) ? error.message : t('rosters.loadError');
    renderOfflineError(root, t('status.offline'), message, `← ${t('nav.factions')}`, '/');
  }
}

export async function renderNewRoster(root: HTMLElement, preselectedFactionId?: string) {
  root.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

  try {
    const [factions, manifest] = await Promise.all([loadFactionIndex(), loadManifest()]);
    factions.sort((a, b) => a.name.localeCompare(b.name));

    root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <button type="button" class="back" id="back-btn">← ${t('rosters.title')}</button>
        <h2>${t('roster.new.title')}</h2>
      </header>
      <form id="new-roster-form" class="form">
        <label class="field">
          <span>${t('roster.new.name')}</span>
          <input type="text" name="name" required maxlength="80" placeholder="${t('roster.new.namePlaceholder')}" />
        </label>
        <label class="field">
          <span>${t('roster.new.faction')}</span>
          <select name="factionId" required>
            <option value="">${t('roster.new.selectFaction')}</option>
            ${factions
              .map(
                (f) =>
                  `<option value="${f.id}"${f.id === preselectedFactionId ? ' selected' : ''}>${escapeHtml(f.name)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="field">
          <span>${t('roster.new.battleSize')}</span>
          <select name="battleSize" id="battle-size-select" required>
            <option value="incursion">${battleSizeLabel('incursion')} (${BATTLE_SIZE_LIMITS.incursion} pts)</option>
            <option value="strike-force" selected>${battleSizeLabel('strike-force')} (${BATTLE_SIZE_LIMITS['strike-force']} pts)</option>
            <option value="onslaught">${battleSizeLabel('onslaught')} (${BATTLE_SIZE_LIMITS.onslaught} pts)</option>
            <option value="custom">${t('roster.new.custom')}</option>
          </select>
        </label>
        <label class="field" id="point-limit-field">
          <span>${t('roster.new.pointLimit')}</span>
          <input
            type="number"
            name="pointLimit"
            id="point-limit-input"
            min="${CUSTOM_POINT_LIMIT.min}"
            max="${CUSTOM_POINT_LIMIT.max}"
            step="${CUSTOM_POINT_LIMIT.step}"
            value="${BATTLE_SIZE_LIMITS['strike-force']}"
            readonly
          />
          <span class="muted field-hint">${t('roster.new.pointLimitHint', {
            min: CUSTOM_POINT_LIMIT.min,
            max: CUSTOM_POINT_LIMIT.max,
          })}</span>
        </label>
        <div class="form-actions">
          <button type="submit" class="btn primary">${t('roster.new.create')}</button>
        </div>
      </form>
      <p class="muted form-note">${t('roster.new.note', { version: escapeHtml(manifest.packVersion) })}</p>
    </section>
  `;

    root.querySelector('#back-btn')?.addEventListener('click', () => navigate('/rosters'));

    const battleSizeSelect = root.querySelector<HTMLSelectElement>('#battle-size-select');
    const pointLimitInput = root.querySelector<HTMLInputElement>('#point-limit-input');

    const syncPointLimit = () => {
      if (!battleSizeSelect || !pointLimitInput) return;
      const size = battleSizeSelect.value as BattleSize;
      const isCustom = size === 'custom';
      pointLimitInput.readOnly = !isCustom;
      pointLimitInput.classList.toggle('point-limit-locked', !isCustom);
      if (!isCustom) {
        pointLimitInput.value = String(pointLimitForBattleSize(size));
      }
    };

    battleSizeSelect?.addEventListener('change', syncPointLimit);
    syncPointLimit();

    root.querySelector<HTMLFormElement>('#new-roster-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const factionId = String(data.get('factionId'));
      const faction = factions.find((f) => f.id === factionId);
      if (!faction) return;

      const battleSize = String(data.get('battleSize')) as BattleSize;
      const pointLimit = pointLimitForBattleSize(battleSize, Number(data.get('pointLimit')));

      const now = new Date().toISOString();
      const roster: Roster = {
        id: crypto.randomUUID(),
        name: String(data.get('name')).trim() || 'Untitled roster',
        factionId: faction.id,
        factionName: faction.name,
        packVersion: manifest.packVersion,
        mfmVersion: manifest.sources?.mfm?.version,
        battleSize,
        pointLimit,
        createdAt: now,
        updatedAt: now,
        units: [],
        enhancements: [],
      };

      await saveRoster(roster);
      navigate(`/roster/${roster.id}`);
    });
  } catch (error) {
    const message = isOfflineDataError(error) ? error.message : t('roster.new.loadError');
    renderOfflineError(root, t('status.offline'), message, `← ${t('rosters.title')}`, '/rosters');
  }
}
