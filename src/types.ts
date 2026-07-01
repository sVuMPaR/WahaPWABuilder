export type BattleSize = 'incursion' | 'strike-force' | 'onslaught';

export const BATTLE_SIZE_LIMITS: Record<BattleSize, number> = {
  incursion: 1000,
  'strike-force': 2000,
  onslaught: 3000,
};

export interface DataManifest {
  packVersion: string;
  builtAt: string;
  attribution: { wahapedia: string; mfm: string };
  sources?: {
    mfm?: { version: string };
  };
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

export interface CostOption {
  models: number;
  points: number;
  desc?: string;
  addon?: boolean;
}

export interface PricingTier {
  range: string;
  label: string;
  costs: CostOption[];
}

export interface UnitPoints {
  source: string;
  version: string;
  pricing: PricingTier[];
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

export interface RosterUnit {
  id: string;
  datasheetId: string;
  name: string;
  models: number;
  points: number;
  tierLabel: string;
  copyIndex: number;
}

export interface Roster {
  id: string;
  name: string;
  factionId: string;
  factionName: string;
  packVersion: string;
  mfmVersion?: string;
  battleSize: BattleSize;
  pointLimit: number;
  createdAt: string;
  updatedAt: string;
  units: RosterUnit[];
}
