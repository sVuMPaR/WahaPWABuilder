import { loadFactionIndex, loadFactionPack } from '../data/loader';
import { getRoster, saveRoster } from '../db/store';
import {
  createRosterUnit,
  getCostOptionsForCopy,
  getTierForCopy,
  isOverLimit,
  nextCopyIndex,
  pointsRemaining,
  recalculateRosterPricing,
  rosterTotalPoints,
} from '../roster/points';
import { escapeHtml } from '../util/html';
import { navigate } from '../router';
import type { CostOption, Datasheet, Roster } from '../types';

function formatCostLabel(cost: CostOption): string {
  const models = cost.models === 1 ? '1 model' : `${cost.models} models`;
  return `${cost.points} pts · ${models}`;
}

function datasheetMap(pack: { datasheets: Datasheet[] }): Map<string, Datasheet> {
  return new Map(pack.datasheets.map((sheet) => [sheet.id, sheet]));
}

function renderPointsBar(roster: Roster): string {
  const total = rosterTotalPoints(roster);
  const remaining = pointsRemaining(roster);
  const over = isOverLimit(roster);
  const pct = Math.min(100, Math.round((total / roster.pointLimit) * 100));

  return `
    <div class="points-bar ${over ? 'over' : ''}">
      <div class="points-bar-fill" style="width: ${pct}%"></div>
      <span class="points-bar-label">
        <strong>${total}</strong> / ${roster.pointLimit} pts
        <span class="points-remaining">(${over ? `${Math.abs(remaining)} over` : `${remaining} left`})</span>
      </span>
    </div>`;
}

function renderArmyList(roster: Roster): string {
  if (roster.units.length === 0) {
    return '<p class="empty">No units yet. Search below to add datasheets with MFM points.</p>';
  }

  return `
    <ul class="army-list">
      ${roster.units
        .map(
          (unit) => `
        <li class="army-row">
          <div class="army-row-main">
            <span class="army-name">${escapeHtml(unit.name)}</span>
            <span class="army-meta">${escapeHtml(unit.tierLabel)} · ${unit.models} models</span>
          </div>
          <span class="army-points">${unit.points} pts</span>
          <button type="button" class="btn icon danger army-remove" data-unit-id="${unit.id}" title="Remove unit">×</button>
        </li>`,
        )
        .join('')}
    </ul>`;
}

function renderUnitPicker(datasheets: Datasheet[], query: string): string {
  const normalized = query.trim().toLowerCase();
  const available = datasheets
    .filter((sheet) => sheet.points?.pricing?.length)
    .filter((sheet) => !normalized || sheet.name.toLowerCase().includes(normalized))
    .slice(0, 40);

  if (available.length === 0) {
    return '<p class="empty">No units match your search.</p>';
  }

  return `
    <ul class="picker-list">
      ${available
        .map(
          (sheet) => `
        <li class="picker-row">
          <div class="picker-main">
            <span class="picker-name">${escapeHtml(sheet.name)}</span>
            <span class="picker-role">${escapeHtml(sheet.role ?? '')}</span>
          </div>
          <button type="button" class="btn small picker-add" data-datasheet-id="${sheet.id}">Add</button>
        </li>`,
        )
        .join('')}
    </ul>`;
}

function renderCostPicker(datasheet: Datasheet, copyIndex: number): string {
  const pricing = datasheet.points!.pricing;
  const tier = getTierForCopy(pricing, copyIndex)!;
  const options = getCostOptionsForCopy(datasheet, copyIndex);

  return `
    <div class="cost-picker" data-datasheet-id="${datasheet.id}">
      <p class="cost-picker-title">
        ${escapeHtml(datasheet.name)}
        <span class="muted">· ${escapeHtml(tier.label)}</span>
      </p>
      <div class="cost-picker-options">
        ${options
          .map(
            (cost, index) => `
          <button type="button" class="btn cost-option" data-cost-index="${index}">
            ${formatCostLabel(cost)}
          </button>`,
          )
          .join('')}
        <button type="button" class="btn ghost cost-cancel">Cancel</button>
      </div>
    </div>`;
}

async function persistRoster(roster: Roster, datasheets: Map<string, Datasheet>): Promise<Roster> {
  const updated = recalculateRosterPricing(roster, datasheets);
  await saveRoster(updated);
  return updated;
}

function bindEditor(root: HTMLElement, roster: Roster, pack: { datasheets: Datasheet[] }) {
  const sheets = datasheetMap(pack);
  let current = roster;
  let pendingDatasheetId: string | null = null;
  let searchQuery = '';

  const rerender = () => {
    root.innerHTML = `
      <section class="panel roster-editor">
        <header class="panel-header">
          <button type="button" class="back" id="back-btn">← Rosters</button>
          <div class="roster-title-block">
            <h2>${escapeHtml(current.name)}</h2>
            <p class="muted">${escapeHtml(current.factionName)} · ${current.pointLimit} pt ${current.battleSize.replace('-', ' ')}</p>
          </div>
        </header>
        ${renderPointsBar(current)}
        <section class="roster-section">
          <h3 class="section-title">Army list</h3>
          <div id="army-list">${renderArmyList(current)}</div>
        </section>
        <section class="roster-section">
          <h3 class="section-title">Add unit</h3>
          <input type="search" id="unit-search" class="search" placeholder="Search datasheets…" value="${escapeHtml(searchQuery)}" />
          <div id="cost-picker-slot">${pendingDatasheetId ? renderCostPicker(sheets.get(pendingDatasheetId)!, nextCopyIndex(current, pendingDatasheetId)) : ''}</div>
          <div id="unit-picker">${renderUnitPicker(pack.datasheets, searchQuery)}</div>
        </section>
      </section>
    `;

    root.querySelector('#back-btn')?.addEventListener('click', () => navigate('/rosters'));

    for (const btn of root.querySelectorAll<HTMLButtonElement>('.army-remove')) {
      btn.addEventListener('click', async () => {
        const unitId = btn.dataset.unitId;
        if (!unitId) return;
        current = {
          ...current,
          units: current.units.filter((unit) => unit.id !== unitId),
        };
        current = await persistRoster(current, sheets);
        pendingDatasheetId = null;
        rerender();
      });
    }

    const search = root.querySelector<HTMLInputElement>('#unit-search');
    search?.addEventListener('input', () => {
      searchQuery = search.value;
      const picker = root.querySelector('#unit-picker');
      if (picker) picker.innerHTML = renderUnitPicker(pack.datasheets, searchQuery);
      bindPickerButtons();
    });
    search?.focus();

    bindPickerButtons();
    bindCostPicker();
  };

  const bindPickerButtons = () => {
    for (const btn of root.querySelectorAll<HTMLButtonElement>('.picker-add')) {
      btn.addEventListener('click', async () => {
        const datasheetId = btn.dataset.datasheetId;
        if (!datasheetId) return;

        const datasheet = sheets.get(datasheetId);
        if (!datasheet?.points?.pricing?.length) return;

        const copyIndex = nextCopyIndex(current, datasheetId);
        const options = getCostOptionsForCopy(datasheet, copyIndex);
        const tier = getTierForCopy(datasheet.points.pricing, copyIndex);
        if (!tier || options.length === 0) return;

        if (options.length === 1) {
          current = {
            ...current,
            units: [...current.units, createRosterUnit(datasheet, copyIndex, options[0], tier.label)],
          };
          current = await persistRoster(current, sheets);
          pendingDatasheetId = null;
          rerender();
          return;
        }

        pendingDatasheetId = datasheetId;
        const slot = root.querySelector('#cost-picker-slot');
        if (slot) slot.innerHTML = renderCostPicker(datasheet, copyIndex);
        bindCostPicker();
      });
    }
  };

  const bindCostPicker = () => {
    const picker = root.querySelector('.cost-picker');
    if (!picker) return;

    const datasheetId = picker.getAttribute('data-datasheet-id');
    if (!datasheetId) return;

    const datasheet = sheets.get(datasheetId);
    if (!datasheet) return;

    picker.querySelector('.cost-cancel')?.addEventListener('click', () => {
      pendingDatasheetId = null;
      const slot = root.querySelector('#cost-picker-slot');
      if (slot) slot.innerHTML = '';
    });

    for (const btn of picker.querySelectorAll<HTMLButtonElement>('.cost-option')) {
      btn.addEventListener('click', async () => {
        const copyIndex = nextCopyIndex(current, datasheetId);
        const options = getCostOptionsForCopy(datasheet, copyIndex);
        const tier = getTierForCopy(datasheet.points!.pricing, copyIndex);
        const cost = options[Number(btn.dataset.costIndex)];
        if (!tier || !cost) return;

        current = {
          ...current,
          units: [...current.units, createRosterUnit(datasheet, copyIndex, cost, tier.label)],
        };
        current = await persistRoster(current, sheets);
        pendingDatasheetId = null;
        rerender();
      });
    }
  };

  rerender();
}

export async function renderRosterEditor(root: HTMLElement, rosterId: string) {
  root.innerHTML = '<p class="loading">Loading roster…</p>';

  const roster = await getRoster(rosterId);
  if (!roster) {
    root.innerHTML = `<p class="error">Roster not found. <a href="#/rosters">Back to rosters</a></p>`;
    return;
  }

  const index = await loadFactionIndex();
  const entry = index.find((faction) => faction.id === roster.factionId);
  if (!entry) {
    root.innerHTML = `<p class="error">Faction data missing for this roster.</p>`;
    return;
  }

  const pack = await loadFactionPack(entry.id, entry.path);
  bindEditor(root, roster, pack);
}
