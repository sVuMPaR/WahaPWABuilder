import { getOfflinePrepContext, prepareFactionsForOffline } from '../data/offline-prep';
import { isOfflineDataError } from '../data/loader';
import { navigate } from '../router';
import { renderOfflineError } from '../util/offline-ui';
import { escapeHtml } from '../util/html';
import { showToast } from '../util/notify';

export async function renderOfflinePrep(root: HTMLElement) {
  root.innerHTML = '<p class="loading">Loading…</p>';

  try {
    const { factions, cachedIds, rosterFactionIds } = await getOfflinePrepContext();
    renderOfflinePrepForm(root, factions, cachedIds, rosterFactionIds);
  } catch (error) {
    const message = isOfflineDataError(error)
      ? error.message
      : 'Could not load faction catalog.';
    renderOfflineError(root, 'Offline', message);
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
        <button type="button" class="back" id="back-btn">← Factions</button>
        <div>
          <h2>Prepare offline</h2>
          <p class="muted">Download faction data to this device while online. Selected armies will work without internet later.</p>
        </div>
      </header>

      <div class="offline-prep-actions">
        <button type="button" class="btn ghost small" id="select-rosters-btn">From rosters</button>
        <button type="button" class="btn ghost small" id="select-uncached-btn">Not cached yet</button>
        <button type="button" class="btn ghost small" id="select-all-btn">Select all</button>
        <button type="button" class="btn ghost small" id="clear-all-btn">Clear</button>
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
              ${cached ? '<span class="badge cached">Cached</span>' : ''}
            </label>
          </li>`;
          })
          .join('')}
      </ul>

      <div id="prep-progress" class="prep-progress" hidden>
        <p class="prep-progress-label" id="prep-progress-label">Downloading…</p>
        <div class="prep-progress-bar">
          <div class="prep-progress-fill" id="prep-progress-fill"></div>
        </div>
      </div>

      <div id="prep-result" class="prep-result" hidden></div>

      <div class="form-actions">
        <button type="button" class="btn primary" id="start-prep-btn">Download selected</button>
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
      showToast('Select at least one faction to download.', 'error');
      return;
    }

    if (!navigator.onLine) {
      showToast('You are offline. Connect to the internet to download data.', 'error');
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
          progressLabel.textContent = `Downloading catalog (${progress.done}/${progress.total})…`;
          progressFill.style.width = `${Math.round((progress.done / progress.total) * 100)}%`;
          return;
        }

        const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
        progressLabel.textContent = progress.currentName
          ? `Downloading ${progress.currentName} (${progress.done + 1}/${progress.total})…`
          : `Downloading factions (${progress.done}/${progress.total})…`;
        progressFill.style.width = `${pct}%`;
      });

      if (progressLabel) progressLabel.textContent = 'Done';
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
            Downloaded ${result.ok.length} faction${result.ok.length === 1 ? '' : 's'}${result.failed.length ? `, ${result.failed.length} failed` : ''}.
          </p>
          ${failedList}
        `;
      }

      if (result.failed.length === 0) {
        showToast(`${result.ok.length} faction(s) ready for offline use.`, 'success', 5000);
      } else {
        showToast(`${result.failed.length} faction(s) failed to download.`, 'error', 5000);
      }

      for (const id of result.ok) cachedIds.add(id);
      renderOfflinePrepForm(root, factions, cachedIds, rosterFactionIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed.';
      showToast(message, 'error', 5000);
      if (startBtn) startBtn.disabled = false;
      progressEl?.setAttribute('hidden', '');
    }
  });
}
