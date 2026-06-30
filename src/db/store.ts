import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FactionPack, Roster } from '../types';

interface WahaDB extends DBSchema {
  factions: {
    key: string;
    value: { id: string; pack: FactionPack; cachedAt: string };
  };
  rosters: {
    key: string;
    value: Roster;
    indexes: { 'by-faction': string };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<WahaDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<WahaDB>('waha-pwa-builder', 1, {
      upgrade(db) {
        db.createObjectStore('factions', { keyPath: 'id' });
        const rosters = db.createObjectStore('rosters', { keyPath: 'id' });
        rosters.createIndex('by-faction', 'factionId');
        db.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

export async function cacheFaction(id: string, pack: FactionPack): Promise<void> {
  const db = await getDb();
  await db.put('factions', { id, pack, cachedAt: new Date().toISOString() });
}

export async function getCachedFaction(id: string): Promise<FactionPack | null> {
  const db = await getDb();
  const row = await db.get('factions', id);
  return row?.pack ?? null;
}

export async function listRosters(): Promise<Roster[]> {
  const db = await getDb();
  return db.getAll('rosters');
}

export async function saveRoster(roster: Roster): Promise<void> {
  const db = await getDb();
  await db.put('rosters', roster);
}

export async function deleteRoster(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('rosters', id);
}
