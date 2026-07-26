import { getOfflinePrepContext, prepareFactionsForOffline } from '../data/offline-prep';
import { isOfflineDataError } from '../data/loader';
import { navigate } from '../router';
import { renderOfflineError } from '../util/offline-ui';
import { escapeHtml } from '../util/html';
import { showToast } from '../util/notify';
import { t } from '../i18n';

export async function renderOfflinePrep(root: HTMLElement) {
  root.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

  try {
    const { factions, cachedIds, rosterFactionIds } = await getOfflinePrepContext();
    renderOfflinePrepForm(root, factions, cachedIds, rosterFactionIds);
  } catch (error) {
    const message = isOfflineDataError(error) ? error.message : t('factions.loadError');
    renderOfflineError(root, t('status.offline'), message);
  }
}

function renderOfflinePrepForm(
  root: HTMLElement,
  factions: Awaited<ReturnType<typeof getOfflinePrepContext>>['factions'],
  cachedIds: Set<string>,
  rosterFactionIds: string[],
) {
  const defaultSelected = new Set([...rosterFactionIds, ...cachedIds]);

  root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <button type="button" class="back" id="back-btn">← ${t('factions.title')}</button>
        <div>
          <h2>${t('offline.title')}</h2>
          <p class="muted">${t('offline.desc')}</p>
        </div>
      </header>

      <div class="offline-prep-actions">
        <button type="button" class="btn ghost small" id="select-rosters-btn">${t('offline.fromRosters')}</button>
        <button type="button" class="btn ghost small" id="select-uncached-btn">${t('offline.notCached')}</button>
        <button type="button" class="btn ghost small" id="select-all-btn">${t('offline.selectAll')}</button>
        <button type="button" class="btn ghost small" id="clear-all-btn">${t('offline.clear')}</button>
      </div>

      <ul class="offline-prep-list" id="faction-prep-list">
        ${factions
          .map((faction) => {
            const cached = cachedIds.has(faction.id);
            const checked = defaultSelected.has(faction.id);
            return `
          <li class="offline-prep-row">
            <label class="offline-prep-label">
              <input type="checkbox" name="faction" value="${faction.id}" data-path="${escapeHtml(faction.path)}"${checked ? ' checked' : ''} />
              <span class="offline-prep-name">${escapeHtml(faction.name)}</span>
              ${cached ? `<span class="badge cached">${t('offline.cached')}</span>` : ''}
            </label>
          </li>`;
          })
          .join('')}
      </ul>

      <div id="prep-progress" class="prep-progress" hidden>
        <p class="prep-progress-label" id="prep-progress-label">${t('offline.downloading')}</p>
        <div class="prep-progress-bar">
          <div class="prep-progress-fill" id="prep-progress-fill"></div>
        </div>
      </div>

      <div id="prep-result" class="prep-result" hidden></div>

      <div class="form-actions">
        <button type="button" class="btn primary" id="start-prep-btn">${t('offline.download')}</button>
      </div>
    </section>
  `;

  root.querySelector('#back-btn')?.addEventListener('click', () => navigate('/'));

  const checkboxes = () => [...root.querySelectorAll<HTMLInputElement>('input[name="faction"]')];

  root.querySelector('#select-rosters-btn')?.addEventListener('click', () => {
    const rosterSet = new Set(rosterFactionIds);
    for (const box of checkboxes()) {
      box.checked = rosterSet.has(box.value);
    }
  });

  root.querySelector('#select-uncached-btn')?.addEventListener('click', () => {
    for (const box of checkboxes()) {
      box.checked = !cachedIds.has(box.value);
    }
  });

  root.querySelector('#select-all-btn')?.addEventListener('click', () => {
    for (const box of checkboxes()) box.checked = true;
  });

  root.querySelector('#clear-all-btn')?.addEventListener('click', () => {
    for (const box of checkboxes()) box.checked = false;
  });

  root.querySelector('#start-prep-btn')?.addEventListener('click', async () => {
    const selected = checkboxes().filter((box) => box.checked);
    if (selected.length === 0) {
      showToast(t('offline.notCached'), 'error');
      return;
    }

    if (!navigator.onLine) {
      showToast(t('status.offline'), 'error');
      return;
    }

    const entries = selected.map((box) => {
      const faction = factions.find((entry) => entry.id === box.value);
      if (!faction) throw new Error(`Unknown faction ${box.value}`);
      return faction;
    });

    const startBtn = root.querySelector<HTMLButtonElement>('#start-prep-btn');
    const progressEl = root.querySelector<HTMLElement>('#prep-progress');
    const progressLabel = root.querySelector<HTMLElement>('#prep-progress-label');
    const progressFill = root.querySelector<HTMLElement>('#prep-progress-fill');
    const resultEl = root.querySelector<HTMLElement>('#prep-result');

    if (startBtn) startBtn.disabled = true;
    progressEl?.removeAttribute('hidden');
    resultEl?.setAttribute('hidden', '');

    try {
      const result = await prepareFactionsForOffline(entries, (progress) => {
        if (!progressLabel || !progressFill) return;

        if (progress.phase === 'catalog') {
          progressLabel.textContent = `${t('offline.downloading')} (${progress.done}/${progress.total})`;
          progressFill.style.width = `${Math.round((progress.done / progress.total) * 100)}%`;
          return;
        }

        const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
        progressLabel.textContent = progress.currentName
          ? `${progress.currentName} (${progress.done + 1}/${progress.total})`
          : `${t('offline.downloading')} (${progress.done}/${progress.total})`;
        progressFill.style.width = `${pct}%`;
      });

      if (progressLabel) progressLabel.textContent = 'OK';
      if (progressFill) progressFill.style.width = '100%';

      if (resultEl) {
        resultEl.removeAttribute('hidden');
        const failedList =
          result.failed.length === 0
            ? ''
            : `<ul class="prep-failed-list">${result.failed
                .map(
                  (entry) =>
                    `<li><strong>${escapeHtml(entry.name)}</strong>: ${escapeHtml(entry.error)}</li>`,
                )
                .join('')}</ul>`;

        resultEl.innerHTML = `
          <p class="prep-result-summary ${result.failed.length ? 'warning' : 'success'}">
            ${result.ok.length} / ${entries.length}
          </p>
          ${failedList}
        `;
      }

      for (const id of result.ok) cachedIds.add(id);
      renderOfflinePrepForm(root, factions, cachedIds, rosterFactionIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error');
      showToast(message, 'error', 5000);
      if (startBtn) startBtn.disabled = false;
      progressEl?.setAttribute('hidden', '');
    }
  });
}
