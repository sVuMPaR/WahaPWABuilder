export interface DataManifest {
  packVersion: string;
  builtAt: string;
  attribution: { wahapedia: string; mfm: string };
  wahapedia: { factionCount: number; datasheetCount: number };
  mfm?: { merge?: { totalMatched: number } };
}

export interface FactionIndexEntry {
  id: string;
  name: string;
  link: string;
  path: string;
  datasheetCount: number;
  detachmentCount: number;
}

export interface UnitPoints {
  source: string;
  version: string;
  pricing: Array<{
    range: string;
    label: string;
    costs: Array<{ models: number; points: number; desc?: string; addon?: boolean }>;
  }>;
  role?: 'leader' | 'support';
  attachTo?: string[];
  legends?: boolean;
}

export interface Datasheet {
  id: string;
  name: string;
  role?: string;
  legend?: string;
  points?: UnitPoints;
}

export interface FactionPack {
  id: string;
  name: string;
  link: string;
  datasheetCount: number;
  detachmentCount: number;
  datasheets: Datasheet[];
  mfm?: {
    slug: string;
    version: string;
    matchedUnits: number;
    unmatchedUnits: number;
  };
}

export interface Roster {
  id: string;
  name: string;
  factionId: string;
  packVersion: string;
  createdAt: string;
  updatedAt: string;
  units: Array<{ datasheetId: string; name: string; points?: number }>;
}
