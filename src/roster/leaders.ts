import type { Datasheet, FactionPack, Roster, RosterUnit } from '../types';

export interface BodyguardInfo {
  /** Leader datasheet names that can attach to this unit */
  leaders: string[];
}

/** Units that can be bodyguards for leaders (from MFM attachTo + Wahapedia leader links). */
export function buildBodyguardIndex(pack: FactionPack): Map<string, BodyguardInfo> {
  const index = new Map<string, BodyguardInfo>();
  const byName = new Map(pack.datasheets.map((sheet) => [sheet.name.toLowerCase(), sheet]));

  const addLeader = (bodyguardId: string, leaderName: string) => {
    const entry = index.get(bodyguardId) ?? { leaders: [] };
    if (!entry.leaders.includes(leaderName)) entry.leaders.push(leaderName);
    index.set(bodyguardId, entry);
  };

  for (const leader of pack.datasheets) {
    for (const name of leader.points?.attachTo ?? []) {
      const bodyguard = byName.get(name.toLowerCase());
      if (bodyguard) addLeader(bodyguard.id, leader.name);
    }

    for (const link of leader.leaderAttachments ?? []) {
      addLeader(link.attachedId, leader.name);
    }
  }

  return index;
}

export function isBodyguardUnit(datasheetId: string, index: Map<string, BodyguardInfo>): boolean {
  return index.has(datasheetId);
}

export function getBodyguardLeaders(datasheetId: string, index: Map<string, BodyguardInfo>): string[] {
  return index.get(datasheetId)?.leaders ?? [];
}

export function canAddLeader(
  roster: Roster,
  leaderDatasheet: Datasheet,
  datasheets: Map<string, Datasheet>,
): { ok: true } | { ok: false; message: string } {
  const targets = getAttachableUnits(roster, leaderDatasheet, datasheets);
  if (targets.length > 0) return { ok: true };

  const names = getAttachTargetNames(leaderDatasheet, datasheets);
  const hint = names.length
    ? ` Add a bodyguard first, e.g. ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}.`
    : ' Add a compatible bodyguard unit to your list first.';
  return { ok: false, message: `${leaderDatasheet.name} cannot be added yet.${hint}` };
}

export function isLeaderOrSupport(datasheet: Datasheet): boolean {
  const role = datasheet.points?.role;
  return role === 'leader' || role === 'support';
}

export function getAttachTargetNames(datasheet: Datasheet, datasheets: Map<string, Datasheet>): string[] {
  if (datasheet.points?.attachTo?.length) return datasheet.points.attachTo;

  const names = new Set<string>();
  for (const link of datasheet.leaderAttachments ?? []) {
    const target = datasheets.get(link.attachedId);
    if (target) names.add(target.name);
  }
  return [...names];
}

export function getAttachableUnits(
  roster: Roster,
  leaderDatasheet: Datasheet,
  datasheets: Map<string, Datasheet>,
): RosterUnit[] {
  const allowedNames = new Set(
    getAttachTargetNames(leaderDatasheet, datasheets).map((name) => name.toLowerCase()),
  );

  return roster.units.filter(
    (unit) =>
      unit.name.toLowerCase() !== leaderDatasheet.name.toLowerCase() &&
      allowedNames.has(unit.name.toLowerCase()),
  );
}

export function clearAttachmentsToUnit(roster: Roster, unitId: string): RosterUnit[] {
  return roster.units.map((unit) =>
    unit.attachedToUnitId === unitId ? { ...unit, attachedToUnitId: undefined } : unit,
  );
}

export function getAttachedUnitName(roster: Roster, unit: RosterUnit): string | null {
  if (!unit.attachedToUnitId) return null;
  return roster.units.find((entry) => entry.id === unit.attachedToUnitId)?.name ?? null;
}

export function formatLeaderMeta(roster: Roster, unit: RosterUnit): string {
  const target = getAttachedUnitName(roster, unit);
  if (!target) return unit.mfmRole === 'support' ? 'Support · not attached' : 'Leader · not attached';
  return `${unit.mfmRole === 'support' ? 'Support' : 'Leader'} → ${target}`;
}
