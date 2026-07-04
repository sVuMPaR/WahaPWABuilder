import { listCachedFactionIds, listRosters } from '../db/store';
import type { FactionIndexEntry } from '../types';
import { loadFactionIndex, loadFactionPack, loadManifest, OfflineDataError } from './loader';

export interface OfflinePrepProgress {
  phase: 'catalog' | 'factions';
  done: number;
  total: number;
  currentName?: string;
}

export interface OfflinePrepResult {
  ok: string[];
  failed: Array<{ id: string; name: string; error: string }>;
}

export async function getOfflinePrepContext(): Promise<{
  factions: FactionIndexEntry[];
  cachedIds: Set<string>;
  rosterFactionIds: string[];
}> {
  const [factions, cachedIds, rosters] = await Promise.all([
    loadFactionIndex(),
    listCachedFactionIds(),
    listRosters(),
  ]);

  factions.sort((a, b) => a.name.localeCompare(b.name));

  return {
    factions,
    cachedIds: new Set(cachedIds),
    rosterFactionIds: [...new Set(rosters.map((roster) => roster.factionId))],
  };
}

export async function prepareFactionsForOffline(
  entries: FactionIndexEntry[],
  onProgress: (progress: OfflinePrepProgress) => void,
): Promise<OfflinePrepResult> {
  if (!navigator.onLine) {
    throw new OfflineDataError('Connect to the internet to download faction data.');
  }

  onProgress({ phase: 'catalog', done: 0, total: 2, currentName: 'Catalog' });
  await loadManifest();
  onProgress({ phase: 'catalog', done: 1, total: 2, currentName: 'Faction index' });
  await loadFactionIndex();
  onProgress({ phase: 'catalog', done: 2, total: 2 });

  const ok: string[] = [];
  const failed: OfflinePrepResult['failed'] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    onProgress({
      phase: 'factions',
      done: index,
      total: entries.length,
      currentName: entry.name,
    });

    try {
      await loadFactionPack(entry.id, entry.path);
      ok.push(entry.id);
    } catch (error) {
      failed.push({
        id: entry.id,
        name: entry.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  onProgress({ phase: 'factions', done: entries.length, total: entries.length });
  return { ok, failed };
}
