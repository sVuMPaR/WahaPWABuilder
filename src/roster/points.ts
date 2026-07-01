import { enhancementTotalPoints } from './enhancements';
import type { CostOption, Datasheet, PricingTier, Roster, RosterUnit } from '../types';

/** Whether `copy` (1-based instance of this datasheet in the army) falls in a tier range. */
export function copyInRange(range: string, copy: number): boolean {
  const unbounded = range.match(/^\[(\d+),\)$/);
  if (unbounded) return copy >= Number(unbounded[1]);

  const closed = range.match(/^\[(\d+),(\d+)\]$/);
  if (closed) {
    const from = Number(closed[1]);
    const to = Number(closed[2]);
    return copy >= from && copy <= to;
  }

  return copy >= 1;
}

export function getTierForCopy(pricing: PricingTier[], copy: number): PricingTier | null {
  return pricing.find((tier) => copyInRange(tier.range, copy)) ?? null;
}

export function getCostOptionsForCopy(datasheet: Datasheet, copy: number): CostOption[] {
  const pricing = datasheet.points?.pricing;
  if (!pricing?.length) return [];

  const tier = getTierForCopy(pricing, copy);
  return tier?.costs ?? [];
}

export function countDatasheetCopies(roster: Roster, datasheetId: string): number {
  return roster.units.filter((unit) => unit.datasheetId === datasheetId).length;
}

export function nextCopyIndex(roster: Roster, datasheetId: string): number {
  return countDatasheetCopies(roster, datasheetId) + 1;
}

export function createRosterUnit(
  datasheet: Datasheet,
  copyIndex: number,
  cost: CostOption,
  tierLabel: string,
): RosterUnit {
  return {
    id: crypto.randomUUID(),
    datasheetId: datasheet.id,
    name: datasheet.name,
    models: cost.models,
    points: cost.points,
    tierLabel,
    copyIndex,
    ...(datasheet.points?.role === 'leader' || datasheet.points?.role === 'support'
      ? { mfmRole: datasheet.points.role }
      : {}),
  };
}

export function rosterUnitsPoints(roster: Roster): number {
  return roster.units.reduce((sum, unit) => sum + unit.points, 0);
}

/** @deprecated Use rosterUnitsPoints or rosterGrandTotal */
export function rosterTotalPoints(roster: Roster): number {
  return rosterUnitsPoints(roster);
}

export function rosterGrandTotal(roster: Roster): number {
  return rosterUnitsPoints(roster) + enhancementTotalPoints(roster);
}

export function pointsRemaining(roster: Roster): number {
  return roster.pointLimit - rosterGrandTotal(roster);
}

export function isOverLimit(roster: Roster): boolean {
  return rosterGrandTotal(roster) > roster.pointLimit;
}

/** Re-number copy indices and refresh tier pricing after add/remove. */
export function recalculateRosterPricing(roster: Roster, datasheets: Map<string, Datasheet>): Roster {
  const copyCounts = new Map<string, number>();

  const units = roster.units.map((unit) => {
    const datasheet = datasheets.get(unit.datasheetId);
    const pricing = datasheet?.points?.pricing;
    if (!pricing?.length) return unit;

    const copyIndex = (copyCounts.get(unit.datasheetId) ?? 0) + 1;
    copyCounts.set(unit.datasheetId, copyIndex);

    const tier = getTierForCopy(pricing, copyIndex);
    if (!tier) return { ...unit, copyIndex };

    const cost = tier.costs.find((option) => option.models === unit.models) ?? tier.costs[0];
    return {
      ...unit,
      copyIndex,
      tierLabel: tier.label,
      models: cost.models,
      points: cost.points,
    };
  });

  return { ...roster, units, updatedAt: new Date().toISOString() };
}

export function normalizeRoster(roster: Roster): Roster {
  return {
    ...roster,
    enhancements: roster.enhancements ?? [],
  };
}
