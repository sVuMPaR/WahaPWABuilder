import type { Datasheet, MfmWargearOption, RosterUnit } from '../types';

export function getMfmWargearOptions(datasheet: Datasheet): MfmWargearOption[] {
  return datasheet.points?.wargear ?? [];
}

export function sumWargearPoints(items: MfmWargearOption[]): number {
  return items.reduce((sum, item) => sum + item.points, 0);
}

export function getUnitWargear(unit: RosterUnit): MfmWargearOption[] {
  return unit.wargear ?? [];
}

export function unitWargearPoints(unit: RosterUnit): number {
  return sumWargearPoints(getUnitWargear(unit));
}

export function unitBasePoints(unit: RosterUnit): number {
  return unit.basePoints ?? unit.points;
}

export function unitTotalPoints(unit: RosterUnit): number {
  return unitBasePoints(unit) + unitWargearPoints(unit);
}

export function toggleWargearSelection(
  selected: MfmWargearOption[],
  option: MfmWargearOption,
  checked: boolean,
): MfmWargearOption[] {
  if (checked) {
    if (selected.some((item) => item.item === option.item)) return selected;
    return [...selected, option];
  }
  return selected.filter((item) => item.item !== option.item);
}

export function applyUnitWargear(unit: RosterUnit, wargear: MfmWargearOption[]): RosterUnit {
  const basePoints = unit.basePoints ?? unit.points - unitWargearPoints(unit);
  return {
    ...unit,
    basePoints,
    wargear,
    points: basePoints + sumWargearPoints(wargear),
  };
}
