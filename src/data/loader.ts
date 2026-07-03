import type { DataManifest, FactionIndexEntry, FactionPack } from '../types';
import { cacheFaction, cacheMeta, getCachedFaction, getCachedMeta } from '../db/store';

const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const FETCH_TIMEOUT_MS = 8_000;

export class OfflineDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineDataError';
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${DATA_BASE}/${path}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OfflineDataError(
        navigator.onLine
          ? `Request timed out loading ${path}`
          : 'You are offline and this data is not cached yet.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function loadWithMetaCache<T>(path: string, metaKey: string): Promise<T> {
  const cached = await getCachedMeta<T>(metaKey);

  if (!navigator.onLine) {
    if (cached) return cached;
    throw new OfflineDataError(
      'You are offline. Open the app while online once to download the data catalog.',
    );
  }

  try {
    const data = await fetchJson<T>(path);
    await cacheMeta(metaKey, data);
    return data;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

export async function loadManifest(): Promise<DataManifest> {
  return loadWithMetaCache<DataManifest>('manifest.json', 'manifest');
}

export async function loadFactionIndex(): Promise<FactionIndexEntry[]> {
  return loadWithMetaCache<FactionIndexEntry[]>('wahapedia/index.json', 'faction-index');
}

export async function loadFactionPack(id: string, path: string): Promise<FactionPack> {
  const cached = await getCachedFaction(id);
  if (cached) return cached;

  if (!navigator.onLine) {
    throw new OfflineDataError(
      `“${id}” is not cached on this device. Open this faction once while online, then it works offline.`,
    );
  }

  try {
    const pack = await fetchJson<FactionPack>(`wahapedia/${path}`);
    await cacheFaction(id, pack);
    return pack;
  } catch (error) {
    const stale = await getCachedFaction(id);
    if (stale) return stale;
    throw error;
  }
}

export function getUnitPoints(datasheet: FactionPack['datasheets'][number]): number | null {
  const pricing = datasheet.points?.pricing;
  if (!pricing?.length) return null;

  const firstTier = pricing[0];
  const firstCost = firstTier?.costs[0];
  return firstCost?.points ?? null;
}

export function isOfflineDataError(error: unknown): error is OfflineDataError {
  return error instanceof OfflineDataError;
}
