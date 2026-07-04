export type ToastType = 'error' | 'info' | 'success';

let toastHost: HTMLElement | null = null;

export function initToastHost(host: HTMLElement): void {
  toastHost = host;
}

export function showToast(message: string, type: ToastType = 'info', durationMs = 4000): void {
  if (!toastHost) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  toastHost.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));

  window.setTimeout(() => {
    toast.classList.remove('visible');
    window.setTimeout(() => toast.remove(), 220);
  }, durationMs);
}
