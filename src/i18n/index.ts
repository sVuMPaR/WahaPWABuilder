import { en } from './en';
import { ru } from './ru';
import type { Locale, MessageKey, Messages } from './types';

const STORAGE_KEY = 'waha-locale';
const catalogs: Record<Locale, Messages> = { en, ru };

let locale: Locale = detectInitialLocale();
const listeners = new Set<() => void>();

function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ru') return stored;
  } catch {
    /* ignore */
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return browser.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  if (locale === next) return;
  locale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
  for (const listener of listeners) listener();
}

export function toggleLocale(): Locale {
  setLocale(locale === 'ru' ? 'en' : 'ru');
  return locale;
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text = catalogs[locale][key] ?? catalogs.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function localeLabel(current: Locale = locale): string {
  return current === 'ru' ? 'РУ' : 'EN';
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = locale;
}

export type { Locale, MessageKey };
