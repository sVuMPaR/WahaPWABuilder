import { describe, expect, it } from 'vitest';
import type { Datasheet, RosterUnit } from '../types';
import { classifyArmyRole, groupDatasheetsByRole, groupRosterUnitsByRole } from './roles';

describe('classifyArmyRole', () => {
  it('maps Wahapedia roles to army list sections', () => {
    expect(classifyArmyRole('Characters')).toBe('characters');
    expect(classifyArmyRole('Battleline')).toBe('troops');
    expect(classifyArmyRole('Dedicated Transports')).toBe('dedicated');
    expect(classifyArmyRole('Fortifications')).toBe('others');
    expect(classifyArmyRole('Other')).toBe('others');
    expect(classifyArmyRole(undefined)).toBe('others');
  });
});

describe('groupDatasheetsByRole', () => {
  it('groups and sorts alphabetically within sections', () => {
    const sheets = [
      { id: '1', name: 'Intercessor Squad', role: 'Battleline' },
      { id: '2', name: 'Captain', role: 'Characters' },
      { id: '3', name: 'Apothecary', role: 'Characters' },
      { id: '4', name: 'Impulsor', role: 'Dedicated Transports' },
      { id: '5', name: 'Redemptor Dreadnought', role: 'Other' },
    ] as Datasheet[];

    const groups = groupDatasheetsByRole(sheets);
    expect(groups.get('characters')!.map((s) => s.name)).toEqual(['Apothecary', 'Captain']);
    expect(groups.get('troops')!.map((s) => s.name)).toEqual(['Intercessor Squad']);
    expect(groups.get('dedicated')!.map((s) => s.name)).toEqual(['Impulsor']);
    expect(groups.get('others')!.map((s) => s.name)).toEqual(['Redemptor Dreadnought']);
  });
});

describe('groupRosterUnitsByRole', () => {
  it('uses datasheet role for roster units', () => {
    const sheets = new Map<string, Datasheet>([
      ['c', { id: 'c', name: 'Captain', role: 'Characters' }],
      ['t', { id: 't', name: 'Intercessors', role: 'Battleline' }],
    ]);
    const units = [
      { id: 'u2', datasheetId: 't', name: 'Intercessors' },
      { id: 'u1', datasheetId: 'c', name: 'Captain' },
    ] as RosterUnit[];

    const groups = groupRosterUnitsByRole(units, sheets);
    expect(groups.get('characters')![0].name).toBe('Captain');
    expect(groups.get('troops')![0].name).toBe('Intercessors');
  });
});
