import { describe, expect, it } from 'vitest';
import {
  canAddUnitCopy,
  isEpicHero,
  isRosterLegal,
  maxUnitCopies,
  rosterHasCharacter,
} from './validation';
import type { Datasheet, Roster } from '../types';

function roster(units: Roster['units']): Roster {
  return {
    id: 'r1',
    name: 'Test',
    factionId: 'AS',
    factionName: 'Adepta Sororitas',
    packVersion: '0.0.4',
    battleSize: 'custom',
    pointLimit: 1500,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    units,
    enhancements: [],
  };
}

const celestine: Datasheet = {
  id: 'cel',
  name: 'Saint Celestine',
  keywords: [{ keyword: 'Character' }, { keyword: 'Epic Hero' }],
  points: { source: 'mfm', version: '1.0', pricing: [{ range: '[1,)', label: '', costs: [{ models: 1, points: 170 }] }], role: 'leader' },
};

const warriors: Datasheet = {
  id: 'war',
  name: 'Necron Warriors',
  keywords: [{ keyword: 'Battleline' }],
};

const arco: Datasheet = {
  id: 'arco',
  name: 'Arco-flagellants',
  keywords: [],
};

describe('maxUnitCopies', () => {
  it('limits Epic Hero to 1', () => {
    expect(maxUnitCopies(celestine)).toBe(1);
    expect(isEpicHero(celestine)).toBe(true);
  });

  it('limits Battleline to 6', () => {
    expect(maxUnitCopies(warriors)).toBe(6);
  });

  it('limits default units to 3', () => {
    expect(maxUnitCopies(arco)).toBe(3);
  });
});

describe('canAddUnitCopy', () => {
  it('blocks when epic hero already in list', () => {
    const r = roster([
      {
        id: 'u1',
        datasheetId: 'cel',
        name: 'Saint Celestine',
        models: 1,
        points: 170,
        tierLabel: '',
        copyIndex: 1,
        mfmRole: 'leader',
      },
    ]);

    const result = canAddUnitCopy(r, celestine);
    expect(result.ok).toBe(false);
  });
});

describe('rosterHasCharacter', () => {
  const sheets = new Map<string, Datasheet>([
    ['cel', celestine],
    ['arco', arco],
  ]);

  it('counts unattached leader as character', () => {
    const r = roster([
      {
        id: 'u1',
        datasheetId: 'cel',
        name: 'Saint Celestine',
        models: 1,
        points: 170,
        tierLabel: '',
        copyIndex: 1,
        mfmRole: 'leader',
      },
    ]);

    expect(rosterHasCharacter(r, sheets)).toBe(true);
  });

  it('fails when only non-characters', () => {
    const r = roster([
      {
        id: 'u1',
        datasheetId: 'arco',
        name: 'Arco-flagellants',
        models: 10,
        points: 140,
        tierLabel: '',
        copyIndex: 1,
      },
    ]);

    expect(rosterHasCharacter(r, sheets)).toBe(false);
  });
});

describe('isRosterLegal', () => {
  const sheets = new Map<string, Datasheet>([
    ['cel', celestine],
    ['war', warriors],
  ]);

  it('is illegal when leader is not attached', () => {
    const r = roster([
      {
        id: 'u1',
        datasheetId: 'war',
        name: 'Necron Warriors',
        models: 10,
        points: 80,
        tierLabel: '',
        copyIndex: 1,
      },
      {
        id: 'u2',
        datasheetId: 'cel',
        name: 'Saint Celestine',
        models: 1,
        points: 170,
        tierLabel: '',
        copyIndex: 1,
        mfmRole: 'leader',
      },
    ]);

    expect(isRosterLegal(r, sheets)).toBe(false);
  });
});
