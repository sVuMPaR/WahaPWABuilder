import { escapeHtml } from '../util/html';
import {
  getDefaultLoadoutSelections,
  getStandaloneMfmOptions,
  getUnparsedOptions,
  parseDatasheetLoadout,
} from './loadout-parser';
import { splitUnitWargear } from './loadout';
import { formatStatsPreview, formatStatsRow, getPrimaryProfile, hasUnitStats } from './stats';
import { unitTotalPoints } from './wargear';
import type { Datasheet, LoadoutSelection, MfmWargearOption, ParsedLoadoutGroup, RosterUnit } from '../types';

export type DatasheetModalMode = 'view' | 'roster';

export interface DatasheetModalContext {
  mode: DatasheetModalMode;
  unit?: RosterUnit;
  onSaveLoadout?: (payload: { selections: LoadoutSelection[]; wargear: MfmWargearOption[] }) => void;
}

let modalHost: HTMLElement | null = null;
let onClose: (() => void) | null = null;

export function initDatasheetModal(host: HTMLElement): void {
  modalHost = host;
}

function closeModal(): void {
  if (!modalHost) return;
  modalHost.hidden = true;
  modalHost.innerHTML = '';
  document.body.classList.remove('modal-open');
  onClose?.();
  onClose = null;
}

function renderWeaponRow(weapon: NonNullable<Datasheet['wargear']>[number]): string {
  const stats = [weapon.range, weapon.type, weapon.a, weapon.bsWs, weapon.s, weapon.ap, weapon.d]
    .filter(Boolean)
    .join(' · ');
  const desc = weapon.description ? ` · ${weapon.description}` : '';
  return `
    <tr>
      <td>${escapeHtml(weapon.name)}</td>
      <td class="weapon-stats">${escapeHtml(stats)}${escapeHtml(desc)}</td>
    </tr>`;
}

function renderProfileTable(datasheet: Datasheet): string {
  const profiles = datasheet.models ?? [];
  if (profiles.length === 0) {
    return '<p class="muted modal-empty">Stat profiles not available for this faction pack.</p>';
  }

  return `
    <table class="stats-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>M</th>
          <th>T</th>
          <th>Sv</th>
          <th>W</th>
          <th>Ld</th>
          <th>OC</th>
        </tr>
      </thead>
      <tbody>
        ${profiles
          .map((profile) => {
            const inv =
              profile.invSv && profile.invSv !== '-'
                ? `<span class="inv-save" title="${escapeHtml(profile.invSvDescr ?? '')}">${escapeHtml(profile.invSv)}+</span>`
                : '';
            return `
          <tr>
            <td>${escapeHtml(profile.name)}</td>
            <td>${escapeHtml(profile.m ?? '—')}</td>
            <td>${escapeHtml(profile.t ?? '—')}</td>
            <td>${escapeHtml(profile.sv ?? '—')}${inv}</td>
            <td>${escapeHtml(profile.w ?? '—')}</td>
            <td>${escapeHtml(profile.ld ?? '—')}</td>
            <td>${escapeHtml(profile.oc ?? '—')}</td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

function renderLoadoutGroup(
  group: ParsedLoadoutGroup,
  selectedChoiceId: string | null,
  interactive: boolean,
): string {
  const pointsLabel = (points: number) => (points > 0 ? `<span class="wargear-points">+${points} pts</span>` : '');

  if (group.type === 'exclusive') {
    const choices = interactive
      ? `
      <label class="loadout-choice">
        <input type="radio" name="loadout-${group.id}" value=""${selectedChoiceId === null ? ' checked' : ''} />
        <span>Stock loadout</span>
      </label>
      ${group.choices
        .map(
          (choice) => `
      <label class="loadout-choice">
        <input type="radio" name="loadout-${group.id}" value="${escapeHtml(choice.id)}"${selectedChoiceId === choice.id ? ' checked' : ''} />
        <span>${escapeHtml(choice.label)}</span>
        ${pointsLabel(choice.points)}
      </label>`,
        )
        .join('')}`
      : `<ul class="modal-list">${group.choices.map((choice) => `<li>${escapeHtml(choice.label)} ${pointsLabel(choice.points)}</li>`).join('')}</ul>`;

    return `
      <div class="loadout-group">
        <p class="loadout-group-label">${escapeHtml(group.label)}</p>
        <div class="loadout-choices">${choices}</div>
      </div>`;
  }

  const choices = group.choices
    .map((choice) => {
      if (interactive) {
        return `
      <label class="loadout-choice">
        <input type="checkbox" class="loadout-checkbox" data-group-id="${escapeHtml(group.id)}" data-choice-id="${escapeHtml(choice.id)}"${selectedChoiceId === choice.id ? ' checked' : ''} />
        <span>${escapeHtml(choice.label)}</span>
        ${pointsLabel(choice.points)}
      </label>`;
      }
      return `<li>${escapeHtml(choice.label)} ${pointsLabel(choice.points)}</li>`;
    })
    .join('');

  return `
    <div class="loadout-group">
      <p class="loadout-group-label">${escapeHtml(group.label)}</p>
      ${interactive ? `<div class="loadout-choices">${choices}</div>` : `<ul class="modal-list">${choices}</ul>`}
    </div>`;
}

function renderWargearSection(datasheet: Datasheet, context: DatasheetModalContext): string {
  const groups = parseDatasheetLoadout(datasheet);
  const unparsed = getUnparsedOptions(datasheet);
  const standaloneMfm = getStandaloneMfmOptions(datasheet, groups);
  const interactive = context.mode === 'roster' && Boolean(context.unit);

  const { selections, extraWargear } =
    context.unit && interactive
      ? splitUnitWargear(context.unit, datasheet)
      : { selections: getDefaultLoadoutSelections(groups), extraWargear: [] };

  const selectionMap = new Map(selections.map((entry) => [entry.groupId, entry.choiceId]));
  const extraItems = new Set(extraWargear.map((entry) => entry.item));

  const loadoutBuilder =
    groups.length === 0
      ? ''
      : `
    <section class="modal-section">
      <h4 class="modal-section-title">Loadout builder</h4>
      ${
        interactive
          ? '<p class="muted modal-hint">Parsed from Wahapedia options — MFM points applied automatically where available.</p>'
          : ''
      }
      ${groups
        .map((group) => renderLoadoutGroup(group, selectionMap.get(group.id) ?? null, interactive))
        .join('')}
    </section>`;

  const standaloneBlock =
    standaloneMfm.length === 0
      ? ''
      : `
    <section class="modal-section">
      <h4 class="modal-section-title">Additional MFM upgrades</h4>
      ${
        interactive
          ? `<ul class="wargear-select-list">
          ${standaloneMfm
            .map(
              (option) => `
            <li>
              <label class="wargear-select-label">
                <input type="checkbox" class="wargear-select" data-item="${escapeHtml(option.item)}" data-points="${option.points}"${extraItems.has(option.item) ? ' checked' : ''} />
                <span>${escapeHtml(option.item)}</span>
                <span class="wargear-points">+${option.points} pts</span>
              </label>
            </li>`,
            )
            .join('')}
        </ul>`
          : `<ul class="modal-list">${standaloneMfm.map((option) => `<li>${escapeHtml(option.item)} <span class="muted">+${option.points} pts</span></li>`).join('')}</ul>`
      }
    </section>`;

  const saveBlock =
    interactive && (groups.length > 0 || standaloneMfm.length > 0)
      ? `<div class="form-actions"><button type="button" class="btn primary small" id="save-loadout-btn">Save loadout</button></div>`
      : '';

  const unparsedBlock =
    unparsed.length === 0
      ? ''
      : `
    <section class="modal-section">
      <h4 class="modal-section-title">Other options (text)</h4>
      <ul class="modal-list options-list">
        ${unparsed.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}
      </ul>
    </section>`;

  const weapons = datasheet.wargear ?? [];
  const weaponsBlock =
    weapons.length === 0
      ? ''
      : `
    <section class="modal-section">
      <h4 class="modal-section-title">Weapon profiles</h4>
      <table class="weapon-table">
        <thead><tr><th>Weapon</th><th>Stats</th></tr></thead>
        <tbody>${weapons.map(renderWeaponRow).join('')}</tbody>
      </table>
    </section>`;

  return `${loadoutBuilder}${standaloneBlock}${saveBlock}${unparsedBlock}${weaponsBlock}`;
}

export function renderStatsPreviewHtml(datasheet: Datasheet): string {
  if (!hasUnitStats(datasheet)) return '';
  const preview = formatStatsPreview(datasheet);
  const profile = getPrimaryProfile(datasheet);
  const title = profile?.name && profile.name !== datasheet.name ? profile.name : '';
  return `<span class="stats-preview" title="${escapeHtml(title || preview)}">${escapeHtml(preview)}</span>`;
}

export function openDatasheetModal(datasheet: Datasheet, context: DatasheetModalContext = { mode: 'view' }): void {
  if (!modalHost) return;

  const profile = getPrimaryProfile(datasheet);
  const preview = formatStatsPreview(datasheet);
  const abilities = datasheet.abilities ?? [];
  const unitPoints =
    context.mode === 'roster' && context.unit
      ? `${unitTotalPoints(context.unit)} pts total`
      : '';

  modalHost.hidden = false;
  modalHost.innerHTML = `
    <div class="modal-backdrop" data-close-modal></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="datasheet-modal-title">
      <header class="modal-header">
        <div>
          <h3 id="datasheet-modal-title">${escapeHtml(datasheet.name)}</h3>
          <p class="muted modal-subtitle">${escapeHtml(datasheet.role ?? '')}${unitPoints ? ` · ${escapeHtml(unitPoints)}` : ''}</p>
          ${preview ? `<p class="stats-preview-line">${escapeHtml(preview)}</p>` : ''}
          ${profile && preview !== formatStatsRow(profile) ? `<p class="muted modal-profile-name">${escapeHtml(profile.name)}</p>` : ''}
        </div>
        <button type="button" class="btn icon modal-close" data-close-modal aria-label="Close">×</button>
      </header>
      <div class="modal-body">
        ${
          datasheet.loadout
            ? `<section class="modal-section"><h4 class="modal-section-title">Default loadout</h4><p class="modal-text">${escapeHtml(datasheet.loadout)}</p></section>`
            : ''
        }
        <section class="modal-section">
          <h4 class="modal-section-title">Characteristics</h4>
          ${renderProfileTable(datasheet)}
        </section>
        ${
          abilities.length
            ? `<section class="modal-section">
          <h4 class="modal-section-title">Abilities</h4>
          <ul class="ability-list">
            ${abilities
              .map(
                (ability) => `
              <li>
                <strong>${escapeHtml(ability.name)}</strong>${ability.type ? ` <span class="muted">(${escapeHtml(ability.type)})</span>` : ''}
                <p class="modal-text">${escapeHtml(ability.description)}</p>
              </li>`,
              )
              .join('')}
          </ul>
        </section>`
            : ''
        }
        ${renderWargearSection(datasheet, context)}
        ${
          datasheet.legend
            ? `<section class="modal-section"><h4 class="modal-section-title">Lore</h4><p class="modal-text lore">${escapeHtml(datasheet.legend)}</p></section>`
            : ''
        }
      </div>
    </div>
  `;

  document.body.classList.add('modal-open');

  for (const el of modalHost.querySelectorAll('[data-close-modal]')) {
    el.addEventListener('click', closeModal);
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') closeModal();
    },
    { once: true },
  );

  const saveBtn = modalHost.querySelector<HTMLButtonElement>('#save-loadout-btn');
  saveBtn?.addEventListener('click', () => {
    const groups = parseDatasheetLoadout(datasheet);
    const selections: LoadoutSelection[] = groups.map((group) => {
      if (group.type === 'exclusive') {
        const selected = modalHost!.querySelector<HTMLInputElement>(`input[name="loadout-${group.id}"]:checked`);
        const choiceId = selected?.value ? selected.value : null;
        return { groupId: group.id, choiceId };
      }

      const checked = modalHost!.querySelector<HTMLInputElement>(
        `.loadout-checkbox[data-group-id="${group.id}"]:checked`,
      );
      return { groupId: group.id, choiceId: checked?.dataset.choiceId ?? null };
    });

    const extraWargear = [...modalHost!.querySelectorAll<HTMLInputElement>('.wargear-select:checked')].map(
      (input) => ({
        item: input.dataset.item ?? '',
        points: Number(input.dataset.points ?? 0),
      }),
    );

    context.onSaveLoadout?.({ selections, wargear: extraWargear });
    closeModal();
  });
}

export function bindDatasheetDetailButtons(
  root: HTMLElement,
  getDatasheet: (id: string) => Datasheet | undefined,
  contextFor?: (datasheetId: string) => DatasheetModalContext,
): void {
  for (const btn of root.querySelectorAll<HTMLElement>('[data-datasheet-detail]')) {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const id = btn.dataset.datasheetDetail;
      if (!id) return;
      const datasheet = getDatasheet(id);
      if (!datasheet) return;
      const context = contextFor?.(id) ?? { mode: 'view' };
      openDatasheetModal(datasheet, context);
    });
  }
}
