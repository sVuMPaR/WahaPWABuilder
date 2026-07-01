import type { DataManifest, FactionIndexEntry, FactionPack } from '../types';
import { cacheFaction, getCachedFaction } from '../db/store';

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function loadManifest(): Promise<DataManifest> {
  return fetchJson<DataManifest>('manifest.json');
}

export async function loadFactionIndex(): Promise<FactionIndexEntry[]> {
  return fetchJson<FactionIndexEntry[]>('wahapedia/index.json');
}

export async function loadFactionPack(id: string, path: string): Promise<FactionPack> {
  const cached = await getCachedFaction(id);
  if (cached) return cached;

  const pack = await fetchJson<FactionPack>(`wahapedia/${path}`);
  await cacheFaction(id, pack);
  return pack;
}

export function getUnitPoints(datasheet: FactionPack['datasheets'][number]): number | null {
  const pricing = datasheet.points?.pricing;
  if (!pricing?.length) return null;

  const firstTier = pricing[0];
  const firstCost = firstTier?.costs[0];
  return firstCost?.points ?? null;
}
