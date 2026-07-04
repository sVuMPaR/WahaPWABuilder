export type BattleSize = 'incursion' | 'strike-force' | 'onslaught' | 'custom';

export const BATTLE_SIZE_LIMITS: Record<Exclude<BattleSize, 'custom'>, number> = {
  incursion: 1000,
  'strike-force': 2000,
  onslaught: 3000,
};

export const CUSTOM_POINT_LIMIT = {
  min: 250,
  max: 10000,
  step: 50,
  default: 1500,
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
  wargear?: MfmWargearOption[];
}

export interface MfmWargearOption {
  item: string;
  points: number;
}

export interface DatasheetModelProfile {
  name: string;
  m?: string;
  t?: string;
  sv?: string;
  invSv?: string;
  invSvDescr?: string;
  w?: string;
  ld?: string;
  oc?: string;
  baseSize?: string;
  baseSizeDescr?: string;
}

export interface DatasheetWeaponProfile {
  name: string;
  range?: string;
  type?: string;
  a?: string;
  bsWs?: string;
  s?: string;
  ap?: string;
  d?: string;
  description?: string;
}

export interface DatasheetAbility {
  name: string;
  description: string;
  type?: string;
}

export interface DatasheetWargearOption {
  button?: string;
  description: string;
}

export type LoadoutGroupType = 'optional' | 'exclusive' | 'per-model';

export interface ParsedLoadoutChoice {
  id: string;
  label: string;
  items: string[];
  points: number;
  mfmItem?: string;
}

export interface ParsedLoadoutGroup {
  id: string;
  type: LoadoutGroupType;
  label: string;
  rawText: string;
  replaces?: string;
  choices: ParsedLoadoutChoice[];
}

export interface LoadoutSelection {
  groupId: string;
  choiceId: string | null;
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

export interface DatasheetKeyword {
  keyword: string;
  isFactionKeyword?: string | boolean;
  model?: string;
  datasheetId?: string;
}

export interface Datasheet {
  id: string;
  name: string;
  role?: string;
  legend?: string;
  loadout?: string;
  keywords?: DatasheetKeyword[];
  models?: DatasheetModelProfile[];
  wargear?: DatasheetWeaponProfile[];
  options?: DatasheetWargearOption[];
  abilities?: DatasheetAbility[];
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
  /** Total points including wargear upgrades. */
  points: number;
  /** Base MFM cost before wargear upgrades. */
  basePoints?: number;
  wargear?: MfmWargearOption[];
  loadoutSelections?: LoadoutSelection[];
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
