import { loadFactionIndex, loadManifest } from '../data/loader';
import { deleteRoster, listRosters, saveRoster } from '../db/store';
import { rosterGrandTotal } from '../roster/points';
import { escapeHtml } from '../util/html';
import { navigate } from '../router';
import type { BattleSize, Roster } from '../types';
import { BATTLE_SIZE_LIMITS, CUSTOM_POINT_LIMIT } from '../types';

export async function renderRosterList(root: HTMLElement) {
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
          <h2>Rosters</h2>
          <p class="muted">Data pack v${escapeHtml(manifest.packVersion)} · stored on this device</p>
        </div>
        <button type="button" class="btn primary" id="new-roster-btn">New roster</button>
      </header>
      ${
        rosters.length === 0
          ? '<p class="empty">No rosters yet. Create one to start building an army list.</p>'
          : `<ul class="roster-list">
        ${rosters
          .map((roster) => {
            const total = rosterGrandTotal(roster);
            const over = total > roster.pointLimit;
            return `
          <li class="roster-card">
            <button type="button" class="roster-open" data-id="${roster.id}">
              <span class="roster-card-name">${escapeHtml(roster.name)}</span>
              <span class="roster-card-meta">${escapeHtml(factionNames.get(roster.factionId) ?? roster.factionName)}${roster.detachmentName ? ` · ${escapeHtml(roster.detachmentName)}` : ''}</span>
              <span class="roster-card-points ${over ? 'over' : ''}">${total} / ${roster.pointLimit} pts</span>
            </button>
            <button type="button" class="btn icon danger roster-delete" data-id="${roster.id}" title="Delete roster">×</button>
          </li>`;
          })
          .join('')}
      </ul>`
      }
    </section>
  `;

  root.querySelector('#new-roster-btn')?.addEventListener('click', () => navigate('/roster/new'));

  for (const btn of root.querySelectorAll<HTMLButtonElement>('.roster-open')) {
    btn.addEventListener('click', () => navigate(`/roster/${btn.dataset.id}`));
  }

  for (const btn of root.querySelectorAll<HTMLButtonElement>('.roster-delete')) {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = btn.dataset.id;
      if (!id || !confirm('Delete this roster?')) return;
      await deleteRoster(id);
      await renderRosterList(root);
    });
  }
}

export async function renderNewRoster(root: HTMLElement, preselectedFactionId?: string) {
  const [factions, manifest] = await Promise.all([loadFactionIndex(), loadManifest()]);
  factions.sort((a, b) => a.name.localeCompare(b.name));

  root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <button type="button" class="back" id="back-btn">← Rosters</button>
        <h2>New roster</h2>
      </header>
      <form id="new-roster-form" class="form">
        <label class="field">
          <span>Name</span>
          <input type="text" name="name" required maxlength="80" placeholder="My army list" />
        </label>
        <label class="field">
          <span>Faction</span>
          <select name="factionId" required>
            <option value="">Select faction…</option>
            ${factions
              .map(
                (f) =>
                  `<option value="${f.id}"${f.id === preselectedFactionId ? ' selected' : ''}>${escapeHtml(f.name)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="field">
          <span>Battle size</span>
          <select name="battleSize" id="battle-size-select" required>
            <option value="incursion">Incursion (${BATTLE_SIZE_LIMITS.incursion} pts)</option>
            <option value="strike-force" selected>Strike Force (${BATTLE_SIZE_LIMITS['strike-force']} pts)</option>
            <option value="onslaught">Onslaught (${BATTLE_SIZE_LIMITS.onslaught} pts)</option>
            <option value="custom">Custom limit…</option>
          </select>
        </label>
        <label class="field" id="custom-points-field" hidden>
          <span>Point limit</span>
          <input
            type="number"
            name="customPoints"
            min="${CUSTOM_POINT_LIMIT.min}"
            max="${CUSTOM_POINT_LIMIT.max}"
            step="${CUSTOM_POINT_LIMIT.step}"
            value="${CUSTOM_POINT_LIMIT.default}"
          />
          <span class="muted field-hint">${CUSTOM_POINT_LIMIT.min}–${CUSTOM_POINT_LIMIT.max} pts, casual / open play</span>
        </label>
        <div class="form-actions">
          <button type="submit" class="btn primary">Create roster</button>
        </div>
      </form>
      <p class="muted form-note">Lists are saved locally and tagged with data pack v${escapeHtml(manifest.packVersion)}.</p>
    </section>
  `;

  root.querySelector('#back-btn')?.addEventListener('click', () => navigate('/rosters'));

  const battleSizeSelect = root.querySelector<HTMLSelectElement>('#battle-size-select');
  const customField = root.querySelector<HTMLLabelElement>('#custom-points-field');
  battleSizeSelect?.addEventListener('change', () => {
    if (!customField) return;
    customField.hidden = battleSizeSelect.value !== 'custom';
  });

  root.querySelector<HTMLFormElement>('#new-roster-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const factionId = String(data.get('factionId'));
    const faction = factions.find((f) => f.id === factionId);
    if (!faction) return;

    const battleSize = String(data.get('battleSize')) as BattleSize;
    let pointLimit = BATTLE_SIZE_LIMITS[battleSize as keyof typeof BATTLE_SIZE_LIMITS];
    if (battleSize === 'custom') {
      const custom = Number(data.get('customPoints'));
      pointLimit =
        Number.isFinite(custom) && custom >= CUSTOM_POINT_LIMIT.min && custom <= CUSTOM_POINT_LIMIT.max
          ? custom
          : CUSTOM_POINT_LIMIT.default;
    }

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
}
