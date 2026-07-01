import { loadFactionIndex, loadFactionPack } from '../data/loader';
import { getRoster, saveRoster } from '../db/store';
import {
  canAddEnhancement,
  createRosterEnhancement,
  getEligibleEnhancementsForUnit,
  isStandardDetachment,
  MAX_ARMY_ENHANCEMENTS,
  pruneEnhancementsForDetachment,
  pruneEnhancementsForRemovedUnit,
} from '../roster/enhancements';
import { copyRosterToClipboard, shareRoster } from '../roster/export';
import {
  buildBodyguardIndex,
  clearAttachmentsToUnit,
  formatLeaderMeta,
  getAttachableUnits,
  getBodyguardLeaders,
  isBodyguardUnit,
  isLeaderOrSupport,
} from '../roster/leaders';
import {
  canAddUnitCopy,
  copyLimitLabel,
  factionHasKeywordData,
  getRosterValidationIssues,
  isBattleline,
  isEpicHero,
  maxUnitCopies,
} from '../roster/validation';
import {
  countDatasheetCopies,
  createRosterUnit,
  getCostOptionsForCopy,
  getTierForCopy,
  isOverLimit,
  nextCopyIndex,
  normalizeRoster,
  pointsRemaining,
  recalculateRosterPricing,
  rosterGrandTotal,
} from '../roster/points';
import { escapeHtml } from '../util/html';
import { navigate } from '../router';
import type { CostOption, Datasheet, FactionPack, Roster, RosterUnit } from '../types';

function formatCostLabel(cost: CostOption): string {
  const models = cost.models === 1 ? '1 model' : `${cost.models} models`;
  return `${cost.points} pts · ${models}`;
}

function datasheetMap(pack: FactionPack): Map<string, Datasheet> {
  return new Map(pack.datasheets.map((sheet) => [sheet.id, sheet]));
}

function renderPointsBar(roster: Roster): string {
  const total = rosterGrandTotal(roster);
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

function renderDetachmentSection(roster: Roster, pack: FactionPack): string {
  const detachments = (pack.detachments ?? []).filter(isStandardDetachment);
  if (detachments.length === 0) {
    return '<p class="empty">No detachments in data pack for this faction.</p>';
  }

  return `
    <select id="detachment-select" class="search" ${detachments.length === 1 ? 'disabled' : ''}>
      <option value="">Select detachment…</option>
      ${detachments
        .map((detachment) => {
          const meta = [
            detachment.points?.objective,
            detachment.points?.dp != null ? `${detachment.points.dp} CP` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return `<option value="${detachment.id}"${detachment.id === roster.detachmentId ? ' selected' : ''}>${escapeHtml(detachment.name)}${meta ? ` (${escapeHtml(meta)})` : ''}</option>`;
        })
        .join('')}
    </select>`;
}

function renderEnhancementsSection(
  roster: Roster,
  pack: FactionPack,
  sheets: Map<string, Datasheet>,
  addingEnhancement: boolean,
): string {
  const assigned = roster.enhancements ?? [];
  const canAdd = canAddEnhancement(roster) && roster.detachmentId;

  const eligibleUnits = roster.units.filter(
    (unit) => getEligibleEnhancementsForUnit(roster, pack, unit, sheets).length > 0,
  );

  return `
    <div class="enhancement-block">
      <div class="section-row">
        <span class="muted">Assigned ${assigned.length} / ${MAX_ARMY_ENHANCEMENTS}</span>
        ${canAdd && eligibleUnits.length > 0 ? '<button type="button" class="btn small" id="add-enhancement-btn">Add enhancement</button>' : ''}
      </div>
      ${
        assigned.length === 0
          ? '<p class="empty">No enhancements assigned.</p>'
          : `<ul class="enhancement-list">
        ${assigned
          .map(
            (entry) => `
          <li class="enhancement-row">
            <span>${escapeHtml(entry.name)} on ${escapeHtml(entry.unitName)}</span>
            <span class="army-points">${entry.points} pts</span>
            <button type="button" class="btn icon danger enhancement-remove" data-id="${entry.id}" title="Remove">×</button>
          </li>`,
          )
          .join('')}
      </ul>`
      }
      ${
        addingEnhancement && canAdd
          ? `<form id="enhancement-form" class="inline-form">
          <label class="field">
            <span>Character</span>
            <select name="unitId" required>
              <option value="">Select unit…</option>
              ${eligibleUnits.map((unit) => `<option value="${unit.id}">${escapeHtml(unit.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Enhancement</span>
            <select name="enhancementId" required disabled>
              <option value="">Select character first…</option>
            </select>
          </label>
          <div class="form-actions">
            <button type="submit" class="btn primary small">Assign</button>
            <button type="button" class="btn ghost small" id="cancel-enhancement-btn">Cancel</button>
          </div>
        </form>`
          : ''
      }
    </div>`;
}

function renderValidationSection(
  roster: Roster,
  pack: FactionPack,
  sheets: Map<string, Datasheet>,
): string {
  const issues = getRosterValidationIssues(roster, sheets);
  const keywordNote = !factionHasKeywordData(pack)
    ? '<p class="validation-note">Keyword data missing for this faction — copy limits use default max 3.</p>'
    : '';

  if (issues.length === 0 && !keywordNote) {
    return '<p class="muted validation-ok">Army rules: within copy limits.</p>';
  }

  return `
    ${keywordNote}
    ${
      issues.length
        ? `<ul class="validation-list">
      ${issues
        .map(
          (issue) =>
            `<li class="validation-item ${issue.severity}">${escapeHtml(issue.message)}</li>`,
        )
        .join('')}
    </ul>`
        : ''
    }`;
}

function renderArmyList(roster: Roster, sheets: Map<string, Datasheet>): string {
  if (roster.units.length === 0) {
    return '<p class="empty">No units yet. Search below to add datasheets with MFM points.</p>';
  }

  return `
    <ul class="army-list">
      ${roster.units
        .map((unit) => {
          const datasheet = sheets.get(unit.datasheetId);
          const leaderMeta = unit.mfmRole ? formatLeaderMeta(roster, unit) : null;
          const copies = countDatasheetCopies(roster, unit.datasheetId);
          const max = datasheet ? maxUnitCopies(datasheet) : 3;
          const copyWarning = copies > max ? ' over-limit' : '';
          return `
        <li class="army-row">
          <div class="army-row-main">
            <span class="army-name">${escapeHtml(unit.name)}</span>
            <span class="army-meta">${escapeHtml(unit.tierLabel)} · ${unit.models} models · ${copies}/${max}${leaderMeta ? ` · ${escapeHtml(leaderMeta)}` : ''}</span>
          </div>
          <span class="army-points${copyWarning}">${unit.points} pts</span>
          <button type="button" class="btn icon danger army-remove" data-unit-id="${unit.id}" title="Remove unit">×</button>
        </li>`;
        })
        .join('')}
    </ul>`;
}

function renderUnitBadges(
  datasheet: Datasheet,
  roster: Roster,
  bodyguardIndex: ReturnType<typeof buildBodyguardIndex>,
): string {
  const badges: string[] = [];
  if (datasheet.points?.role === 'leader') badges.push('Leader');
  if (datasheet.points?.role === 'support') badges.push('Support');
  if (isBodyguardUnit(datasheet.id, bodyguardIndex)) badges.push('Bodyguard');
  if (isEpicHero(datasheet)) badges.push('Epic Hero');
  if (isBattleline(datasheet)) badges.push('Battleline');

  const copies = countDatasheetCopies(roster, datasheet.id);
  const max = maxUnitCopies(datasheet);
  if (copies > 0) badges.push(`${copies}/${max}`);

  return badges.map((label) => `<span class="badge">${escapeHtml(label)}</span>`).join(' ');
}

function renderUnitPicker(
  datasheets: Datasheet[],
  query: string,
  roster: Roster,
  bodyguardIndex: ReturnType<typeof buildBodyguardIndex>,
): string {
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
        .map((sheet) => {
          const leaders = getBodyguardLeaders(sheet.id, bodyguardIndex);
          const leaderHint = leaders.length
            ? `Bodyguard for: ${leaders.slice(0, 3).join(', ')}${leaders.length > 3 ? '…' : ''}`
            : '';
          const atLimit = !canAddUnitCopy(roster, sheet).ok;
          return `
        <li class="picker-row${atLimit ? ' at-limit' : ''}">
          <div class="picker-main">
            <span class="picker-name">${escapeHtml(sheet.name)} ${renderUnitBadges(sheet, roster, bodyguardIndex)}</span>
            <span class="picker-role">${escapeHtml(sheet.role ?? '')}${leaderHint ? ` · ${escapeHtml(leaderHint)}` : ''} · ${escapeHtml(copyLimitLabel(sheet))}</span>
          </div>
          <button type="button" class="btn small picker-add" data-datasheet-id="${sheet.id}"${atLimit ? ' disabled title="Copy limit reached"' : ''}>Add</button>
        </li>`;
        })
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

function renderAttachPicker(roster: Roster, leaderUnit: RosterUnit, datasheet: Datasheet, sheets: Map<string, Datasheet>): string {
  const targets = getAttachableUnits(roster, datasheet, sheets);

  return `
    <div class="cost-picker attach-picker" data-unit-id="${leaderUnit.id}">
      <p class="cost-picker-title">
        Attach ${escapeHtml(leaderUnit.name)}
        <span class="muted">to a unit in your list</span>
      </p>
      <div class="cost-picker-options">
        ${
          targets.length === 0
            ? '<p class="empty">Add a compatible bodyguard unit first.</p>'
            : targets
                .map(
                  (target) => `
            <button type="button" class="btn attach-option" data-target-id="${target.id}">
              ${escapeHtml(target.name)} <span class="badge">Bodyguard</span>
            </button>`,
                )
                .join('')
        }
        <button type="button" class="btn ghost attach-skip">Skip for now</button>
      </div>
    </div>`;
}

async function persistRoster(roster: Roster, datasheets: Map<string, Datasheet>): Promise<Roster> {
  const updated = recalculateRosterPricing(roster, datasheets);
  await saveRoster(updated);
  return updated;
}

function bindEditor(root: HTMLElement, roster: Roster, pack: FactionPack) {
  const sheets = datasheetMap(pack);
  const bodyguardIndex = buildBodyguardIndex(pack);
  let current = normalizeRoster(roster);
  let pendingDatasheetId: string | null = null;
  let pendingLeaderUnitId: string | null = null;
  let addingEnhancement = false;
  let searchQuery = '';

  const rerender = () => {
    root.innerHTML = `
      <section class="panel roster-editor">
        <header class="panel-header">
          <button type="button" class="back" id="back-btn">← Rosters</button>
          <div class="roster-title-block">
            <h2>${escapeHtml(current.name)}</h2>
            <p class="muted">${escapeHtml(current.factionName)} · ${current.pointLimit} pt ${current.battleSize.replace('-', ' ')}${current.detachmentName ? ` · ${escapeHtml(current.detachmentName)}` : ''}</p>
          </div>
          <div class="header-actions">
            <button type="button" class="btn small" id="copy-roster-btn">Copy list</button>
            <button type="button" class="btn small" id="share-roster-btn">Share</button>
          </div>
        </header>
        ${renderPointsBar(current)}
        <section class="roster-section validation-section">
          <h3 class="section-title">Rules check</h3>
          <div id="validation-panel">${renderValidationSection(current, pack, sheets)}</div>
        </section>
        <section class="roster-section">
          <h3 class="section-title">Detachment</h3>
          ${renderDetachmentSection(current, pack)}
        </section>
        <section class="roster-section">
          <h3 class="section-title">Enhancements</h3>
          ${renderEnhancementsSection(current, pack, sheets, addingEnhancement)}
        </section>
        <section class="roster-section">
          <h3 class="section-title">Army list</h3>
          <div id="army-list">${renderArmyList(current, sheets)}</div>
        </section>
        <section class="roster-section">
          <h3 class="section-title">Add unit</h3>
          <input type="search" id="unit-search" class="search" placeholder="Search datasheets…" value="${escapeHtml(searchQuery)}" />
          <div id="cost-picker-slot">${
            pendingDatasheetId
              ? renderCostPicker(sheets.get(pendingDatasheetId)!, nextCopyIndex(current, pendingDatasheetId))
              : ''
          }</div>
          <div id="attach-picker-slot">${
            pendingLeaderUnitId
              ? (() => {
                  const leader = current.units.find((unit) => unit.id === pendingLeaderUnitId);
                  const datasheet = leader ? sheets.get(leader.datasheetId) : null;
                  return leader && datasheet ? renderAttachPicker(current, leader, datasheet, sheets) : '';
                })()
              : ''
          }</div>
          <div id="unit-picker">${renderUnitPicker(pack.datasheets, searchQuery, current, bodyguardIndex)}</div>
        </section>
      </section>
    `;

    root.querySelector('#back-btn')?.addEventListener('click', () => navigate('/rosters'));

    root.querySelector('#copy-roster-btn')?.addEventListener('click', async () => {
      await copyRosterToClipboard(current);
      const btn = root.querySelector<HTMLButtonElement>('#copy-roster-btn');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      }
    });

    root.querySelector('#share-roster-btn')?.addEventListener('click', async () => {
      const shared = await shareRoster(current);
      if (!shared) {
        const btn = root.querySelector<HTMLButtonElement>('#share-roster-btn');
        if (btn) {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = original;
          }, 1500);
        }
      }
    });

    root.querySelector<HTMLSelectElement>('#detachment-select')?.addEventListener('change', async (event) => {
      const select = event.currentTarget as HTMLSelectElement;
      const detachment = (pack.detachments ?? []).find((entry) => entry.id === select.value);
      if (!detachment) return;

      current = {
        ...current,
        detachmentId: detachment.id,
        detachmentName: detachment.name,
        enhancements: pruneEnhancementsForDetachment(
          { ...current, detachmentId: detachment.id },
          pack,
        ),
      };
      current = await persistRoster(current, sheets);
      rerender();
    });

    root.querySelector('#add-enhancement-btn')?.addEventListener('click', () => {
      addingEnhancement = true;
      rerender();
    });

    root.querySelector('#cancel-enhancement-btn')?.addEventListener('click', () => {
      addingEnhancement = false;
      rerender();
    });

    for (const btn of root.querySelectorAll<HTMLButtonElement>('.enhancement-remove')) {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!id) return;
        current = {
          ...current,
          enhancements: current.enhancements.filter((entry) => entry.id !== id),
        };
        current = await persistRoster(current, sheets);
        rerender();
      });
    }

    bindEnhancementForm();

    for (const btn of root.querySelectorAll<HTMLButtonElement>('.army-remove')) {
      btn.addEventListener('click', async () => {
        const unitId = btn.dataset.unitId;
        if (!unitId) return;
        current = {
          ...current,
          units: clearAttachmentsToUnit(
            { ...current, units: current.units.filter((unit) => unit.id !== unitId) },
            unitId,
          ),
          enhancements: pruneEnhancementsForRemovedUnit(current, unitId),
        };
        if (pendingLeaderUnitId === unitId) pendingLeaderUnitId = null;
        current = await persistRoster(current, sheets);
        pendingDatasheetId = null;
        rerender();
      });
    }

    const search = root.querySelector<HTMLInputElement>('#unit-search');
    search?.addEventListener('input', () => {
      searchQuery = search.value;
      const picker = root.querySelector('#unit-picker');
      if (picker) picker.innerHTML = renderUnitPicker(pack.datasheets, searchQuery, current, bodyguardIndex);
      bindPickerButtons();
    });

    bindPickerButtons();
    bindCostPicker();
    bindAttachPicker();
  };

  const bindEnhancementForm = () => {
    const form = root.querySelector<HTMLFormElement>('#enhancement-form');
    if (!form) return;

    const unitSelect = form.querySelector<HTMLSelectElement>('select[name="unitId"]');
    const enhancementSelect = form.querySelector<HTMLSelectElement>('select[name="enhancementId"]');

    unitSelect?.addEventListener('change', () => {
      if (!enhancementSelect || !unitSelect.value) return;
      const unit = current.units.find((entry) => entry.id === unitSelect.value);
      if (!unit) return;

      const eligible = getEligibleEnhancementsForUnit(current, pack, unit, sheets);
      enhancementSelect.disabled = eligible.length === 0;
      enhancementSelect.innerHTML =
        eligible.length === 0
          ? '<option value="">No eligible enhancements</option>'
          : `<option value="">Select enhancement…</option>${eligible.map((enhancement) => `<option value="${enhancement.id}">${escapeHtml(enhancement.name)} (${enhancement.points?.cost ?? enhancement.cost} pts)</option>`).join('')}`;
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const unitId = String(data.get('unitId'));
      const enhancementId = String(data.get('enhancementId'));
      const unit = current.units.find((entry) => entry.id === unitId);
      if (!unit) return;

      const eligible = getEligibleEnhancementsForUnit(current, pack, unit, sheets);
      const enhancement = eligible.find((entry) => entry.id === enhancementId);
      if (!enhancement) return;

      current = {
        ...current,
        enhancements: [...current.enhancements, createRosterEnhancement(enhancement, unit)],
      };
      current = await persistRoster(current, sheets);
      addingEnhancement = false;
      rerender();
    });
  };

  const addUnit = async (datasheet: Datasheet, cost: CostOption, tierLabel: string) => {
    const check = canAddUnitCopy(current, datasheet);
    if (!check.ok) {
      alert(check.message);
      return;
    }

    const newUnit = createRosterUnit(datasheet, nextCopyIndex(current, datasheet.id), cost, tierLabel);
    current = {
      ...current,
      units: [...current.units, newUnit],
    };
    current = await persistRoster(current, sheets);
    pendingDatasheetId = null;

    if (isLeaderOrSupport(datasheet)) {
      pendingLeaderUnitId = newUnit.id;
    }
    rerender();
  };

  const bindPickerButtons = () => {
    for (const btn of root.querySelectorAll<HTMLButtonElement>('.picker-add')) {
      btn.addEventListener('click', async () => {
        const datasheetId = btn.dataset.datasheetId;
        if (!datasheetId) return;

        const datasheet = sheets.get(datasheetId);
        if (!datasheet?.points?.pricing?.length) return;

        const check = canAddUnitCopy(current, datasheet);
        if (!check.ok) {
          alert(check.message);
          return;
        }

        const copyIndex = nextCopyIndex(current, datasheetId);
        const options = getCostOptionsForCopy(datasheet, copyIndex);
        const tier = getTierForCopy(datasheet.points.pricing, copyIndex);
        if (!tier || options.length === 0) return;

        if (options.length === 1) {
          await addUnit(datasheet, options[0], tier.label);
          return;
        }

        pendingDatasheetId = datasheetId;
        pendingLeaderUnitId = null;
        const slot = root.querySelector('#cost-picker-slot');
        if (slot) slot.innerHTML = renderCostPicker(datasheet, copyIndex);
        bindCostPicker();
      });
    }
  };

  const bindCostPicker = () => {
    const picker = root.querySelector('.cost-picker:not(.attach-picker)');
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
        await addUnit(datasheet, cost, tier.label);
      });
    }
  };

  const bindAttachPicker = () => {
    const picker = root.querySelector('.attach-picker');
    if (!picker) return;

    const leaderUnitId = picker.getAttribute('data-unit-id');
    if (!leaderUnitId) return;

    picker.querySelector('.attach-skip')?.addEventListener('click', () => {
      pendingLeaderUnitId = null;
      const slot = root.querySelector('#attach-picker-slot');
      if (slot) slot.innerHTML = '';
    });

    for (const btn of picker.querySelectorAll<HTMLButtonElement>('.attach-option')) {
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.targetId;
        if (!targetId) return;

        current = {
          ...current,
          units: current.units.map((unit) =>
            unit.id === leaderUnitId ? { ...unit, attachedToUnitId: targetId } : unit,
          ),
        };
        current = await persistRoster(current, sheets);
        pendingLeaderUnitId = null;
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
  bindEditor(root, normalizeRoster(roster), pack);
}
