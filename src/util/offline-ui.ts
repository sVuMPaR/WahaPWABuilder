import { navigate } from '../router';
import { escapeHtml } from './html';

export function renderOfflineError(
  root: HTMLElement,
  title: string,
  message: string,
  backLabel = '← Factions',
  backPath = '/',
): void {
  root.innerHTML = `
    <section class="panel">
      <header class="panel-header">
        <button type="button" class="back" id="back-btn">${escapeHtml(backLabel)}</button>
        <h2>${escapeHtml(title)}</h2>
      </header>
      <p class="error">${escapeHtml(message)}</p>
      <p class="muted offline-tip">While online: use <strong>Prepare offline</strong> to download armies you need. Rosters you already created stay available offline.</p>
      <div class="form-actions">
        <button type="button" class="btn primary" id="offline-prep-btn">Prepare offline</button>
      </div>
    </section>
  `;

  root.querySelector('#back-btn')?.addEventListener('click', () => navigate(backPath));
  root.querySelector('#offline-prep-btn')?.addEventListener('click', () => navigate('/offline-prep'));
}
