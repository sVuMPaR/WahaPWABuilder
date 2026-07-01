import type { Datasheet, Roster, RosterUnit } from '../types';

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
