import {
  getDefaultLoadoutSelections,
  parseDatasheetLoadout,
  wargearFromSelections,
} from './loadout-parser';
import { applyUnitWargear, sumWargearPoints } from './wargear';
import type { Datasheet, LoadoutSelection, MfmWargearOption, RosterUnit } from '../types';

export function getUnitLoadoutSelections(unit: RosterUnit, datasheet: Datasheet): LoadoutSelection[] {
  if (unit.loadoutSelections?.length) return unit.loadoutSelections;

  const groups = parseDatasheetLoadout(datasheet);
  return getDefaultLoadoutSelections(groups);
}

export function applyUnitLoadout(
  unit: RosterUnit,
  datasheet: Datasheet,
  selections: LoadoutSelection[],
  extraWargear: MfmWargearOption[] = [],
): RosterUnit {
  const groups = parseDatasheetLoadout(datasheet);
  const wargear = wargearFromSelections(datasheet, groups, selections, extraWargear);
  const withWargear = applyUnitWargear(unit, wargear);

  return {
    ...withWargear,
    loadoutSelections: selections,
  };
}

export function splitUnitWargear(
  unit: RosterUnit,
  datasheet: Datasheet,
): { selections: LoadoutSelection[]; extraWargear: MfmWargearOption[] } {
  const groups = parseDatasheetLoadout(datasheet);
  const selections = getUnitLoadoutSelections(unit, datasheet);
  const parsedWargear = wargearFromSelections(datasheet, groups, selections);
  const parsedItems = new Set(parsedWargear.map((entry) => entry.item));
  const extraWargear = (unit.wargear ?? []).filter((entry) => !parsedItems.has(entry.item));

  return { selections, extraWargear };
}

export function unitLoadoutSummary(unit: RosterUnit, datasheet: Datasheet): string {
  const groups = parseDatasheetLoadout(datasheet);
  const { selections, extraWargear } = splitUnitWargear(unit, datasheet);
  const parts: string[] = [];

  for (const selection of selections) {
    const group = groups.find((entry) => entry.id === selection.groupId);
    const choice = group?.choices.find((entry) => entry.id === selection.choiceId);
    if (choice) parts.push(choice.label);
  }

  for (const item of extraWargear) {
    parts.push(item.item);
  }

  return parts.join('; ');
}

export function loadoutPointsFromSelections(
  datasheet: Datasheet,
  selections: LoadoutSelection[],
  extraWargear: MfmWargearOption[] = [],
): number {
  const groups = parseDatasheetLoadout(datasheet);
  return sumWargearPoints(wargearFromSelections(datasheet, groups, selections, extraWargear));
}
