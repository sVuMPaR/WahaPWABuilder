import { escapeHtml } from '../util/html';
import { formatStatsPreview, formatStatsRow, getPrimaryProfile, hasUnitStats } from './stats';
import { getMfmWargearOptions, getUnitWargear, unitTotalPoints } from './wargear';
import type { Datasheet, RosterUnit } from '../types';

export type DatasheetModalMode = 'view' | 'roster';

export interface DatasheetModalContext {
  mode: DatasheetModalMode;
  unit?: RosterUnit;
  onSaveWargear?: (wargear: ReturnType<typeof getUnitWargear>) => void;
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

function renderWargearSection(datasheet: Datasheet, context: DatasheetModalContext): string {
  const mfmOptions = getMfmWargearOptions(datasheet);
  const selected = context.unit ? getUnitWargear(context.unit) : [];
  const selectedItems = new Set(selected.map((item) => item.item));

  const mfmBlock =
    mfmOptions.length === 0
      ? ''
      : `
    <section class="modal-section">
      <h4 class="modal-section-title">MFM wargear upgrades</h4>
      ${
        context.mode === 'roster' && context.unit
          ? `<p class="muted modal-hint">Select upgrades — points are added to this unit.</p>
        <ul class="wargear-select-list">
          ${mfmOptions
            .map(
              (option) => `
            <li>
              <label class="wargear-select-label">
                <input type="checkbox" class="wargear-select" data-item="${escapeHtml(option.item)}" data-points="${option.points}"${selectedItems.has(option.item) ? ' checked' : ''} />
                <span>${escapeHtml(option.item)}</span>
                <span class="wargear-points">+${option.points} pts</span>
              </label>
            </li>`,
            )
            .join('')}
        </ul>
        <div class="form-actions">
          <button type="button" class="btn primary small" id="save-wargear-btn">Save loadout</button>
        </div>`
          : `<ul class="modal-list">
          ${mfmOptions.map((option) => `<li>${escapeHtml(option.item)} <span class="muted">+${option.points} pts</span></li>`).join('')}
        </ul>`
      }
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

  const options = datasheet.options ?? [];
  const optionsBlock =
    options.length === 0
      ? ''
      : `
    <section class="modal-section">
      <h4 class="modal-section-title">Wargear options</h4>
      <ul class="modal-list options-list">
        ${options.map((option) => `<li>${escapeHtml(option.description)}</li>`).join('')}
      </ul>
    </section>`;

  return `${mfmBlock}${weaponsBlock}${optionsBlock}`;
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

  const saveBtn = modalHost.querySelector<HTMLButtonElement>('#save-wargear-btn');
  saveBtn?.addEventListener('click', () => {
    const selected = [...modalHost!.querySelectorAll<HTMLInputElement>('.wargear-select:checked')].map(
      (input) => ({
        item: input.dataset.item ?? '',
        points: Number(input.dataset.points ?? 0),
      }),
    );
    context.onSaveWargear?.(selected);
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
