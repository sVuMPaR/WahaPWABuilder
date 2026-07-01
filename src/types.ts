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

export interface Enhancement {
  id: string;
  name: string;
  cost?: string;
  detachmentId: string;
  detachment?: string;
  legend?: string;
  description?: string;
  points?: { cost: number; leaderTo?: string[] };
}

export interface DatasheetEnhancementRef extends Enhancement {
  datasheetId?: string;
  enhancementId?: string;
  factionId?: string;
}

export interface Detachment {
  id: string;
  factionId: string;
  name: string;
  legend?: string;
  type?: string;
  points?: {
    dp?: number;
    objective?: string;
    unique?: string | null;
  };
}

export interface Datasheet {
  id: string;
  name: string;
  role?: string;
  legend?: string;
  points?: UnitPoints;
  enhancements?: DatasheetEnhancementRef[];
  leaderAttachments?: { leaderId: string; attachedId: string }[];
  leaderHead?: string;
  leaderFooter?: string;
}

export interface FactionPack {
  id: string;
  name: string;
  link: string;
  datasheetCount: number;
  detachmentCount: number;
  datasheets: Datasheet[];
  detachments?: Detachment[];
  enhancements?: Enhancement[];
  mfm?: {
    slug: string;
    version: string;
    matchedUnits: number;
    unmatchedUnits: number;
  };
  _slim?: boolean;
}

export interface RosterUnit {
  id: string;
  datasheetId: string;
  name: string;
  models: number;
  points: number;
  tierLabel: string;
  copyIndex: number;
  mfmRole?: 'leader' | 'support';
  attachedToUnitId?: string;
}

export interface RosterEnhancement {
  id: string;
  enhancementId: string;
  name: string;
  points: number;
  unitId: string;
  unitName: string;
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
  detachmentId?: string;
  detachmentName?: string;
  createdAt: string;
  updatedAt: string;
  units: RosterUnit[];
  enhancements: RosterEnhancement[];
}
