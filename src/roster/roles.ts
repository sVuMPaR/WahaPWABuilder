import type { Datasheet, RosterUnit } from '../types';
import { t, type MessageKey } from '../i18n';

export type ArmyRoleGroup = 'characters' | 'troops' | 'dedicated' | 'others';

export const ARMY_ROLE_ORDER: ArmyRoleGroup[] = ['characters', 'troops', 'dedicated', 'others'];

const ROLE_LABEL_KEYS: Record<ArmyRoleGroup, MessageKey> = {
  characters: 'role.characters',
  troops: 'role.troops',
  dedicated: 'role.dedicated',
  others: 'role.others',
};

export function classifyArmyRole(role?: string): ArmyRoleGroup {
  const normalized = (role ?? '').trim().toLowerCase();
  if (normalized === 'characters' || normalized === 'character') return 'characters';
  if (normalized === 'battleline' || normalized === 'troops') return 'troops';
  if (normalized.startsWith('dedicated')) return 'dedicated';
  return 'others';
}

export function armyRoleLabel(group: ArmyRoleGroup): string {
  return t(ROLE_LABEL_KEYS[group]);
}

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function groupDatasheetsByRole(datasheets: Datasheet[]): Map<ArmyRoleGroup, Datasheet[]> {
  const groups = new Map<ArmyRoleGroup, Datasheet[]>(ARMY_ROLE_ORDER.map((key) => [key, []]));
  for (const sheet of datasheets) {
    groups.get(classifyArmyRole(sheet.role))!.push(sheet);
  }
  for (const key of ARMY_ROLE_ORDER) {
    groups.set(key, sortByName(groups.get(key)!));
  }
  return groups;
}

export function groupRosterUnitsByRole(
  units: RosterUnit[],
  sheets: Map<string, Datasheet>,
): Map<ArmyRoleGroup, RosterUnit[]> {
  const groups = new Map<ArmyRoleGroup, RosterUnit[]>(ARMY_ROLE_ORDER.map((key) => [key, []]));
  for (const unit of units) {
    const role = sheets.get(unit.datasheetId)?.role;
    groups.get(classifyArmyRole(role))!.push(unit);
  }
  for (const key of ARMY_ROLE_ORDER) {
    groups.set(key, sortByName(groups.get(key)!));
  }
  return groups;
}
