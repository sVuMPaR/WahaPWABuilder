import type {
  Datasheet,
  Enhancement,
  FactionPack,
  Roster,
  RosterEnhancement,
  RosterUnit,
} from '../types';

export const MAX_ARMY_ENHANCEMENTS = 3;

export function enhancementPoints(enhancement: Enhancement): number {
  if (enhancement.points?.cost != null) return enhancement.points.cost;
  const parsed = Number(enhancement.cost);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getDetachmentEnhancements(pack: FactionPack, detachmentId: string): Enhancement[] {
  return (pack.enhancements ?? []).filter((enhancement) => enhancement.detachmentId === detachmentId);
}

export function getEligibleEnhancementsForUnit(
  roster: Roster,
  pack: FactionPack,
  unit: RosterUnit,
  datasheets: Map<string, Datasheet>,
): Enhancement[] {
  if (!roster.detachmentId) return [];

  const datasheet = datasheets.get(unit.datasheetId);
  if (!datasheet?.enhancements?.length) return [];

  const assignedIds = new Set((roster.enhancements ?? []).map((entry) => entry.enhancementId));
  const detachmentEnhancements = getDetachmentEnhancements(pack, roster.detachmentId);
  const detachmentIds = new Set(detachmentEnhancements.map((enhancement) => enhancement.id));

  return datasheet.enhancements.filter(
    (enhancement) => detachmentIds.has(enhancement.id) && !assignedIds.has(enhancement.id),
  );
}

export function enhancementTotalPoints(roster: Roster): number {
  return (roster.enhancements ?? []).reduce((sum, entry) => sum + entry.points, 0);
}

export function canAddEnhancement(roster: Roster): boolean {
  return (roster.enhancements ?? []).length < MAX_ARMY_ENHANCEMENTS;
}

export function createRosterEnhancement(
  enhancement: Enhancement,
  unit: RosterUnit,
): RosterEnhancement {
  return {
    id: crypto.randomUUID(),
    enhancementId: enhancement.id,
    name: enhancement.name,
    points: enhancementPoints(enhancement),
    unitId: unit.id,
    unitName: unit.name,
  };
}

export function pruneEnhancementsForRemovedUnit(roster: Roster, unitId: string): RosterEnhancement[] {
  return (roster.enhancements ?? []).filter((entry) => entry.unitId !== unitId);
}

export function pruneEnhancementsForDetachment(
  roster: Roster,
  pack: FactionPack,
): RosterEnhancement[] {
  if (!roster.detachmentId) return [];

  const validIds = new Set(
    getDetachmentEnhancements(pack, roster.detachmentId).map((enhancement) => enhancement.id),
  );
  return (roster.enhancements ?? []).filter((entry) => validIds.has(entry.enhancementId));
}

export function isStandardDetachment(detachment: { type?: string }): boolean {
  return detachment.type !== 'Boarding Actions';
}
