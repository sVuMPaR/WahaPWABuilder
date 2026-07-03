import { describe, expect, it } from 'vitest';
import { buildBodyguardIndex, getAttachableUnits, isBodyguardUnit } from './leaders';
import type { FactionPack, Roster } from '../types';

const pack: FactionPack = {
  id: 'NEC',
  name: 'Necrons',
  link: '',
  datasheetCount: 2,
  detachmentCount: 1,
  datasheets: [
    {
      id: 'imotekh',
      name: 'Imotekh The Stormlord',
      points: {
        source: 'mfm',
        version: '1.0',
        pricing: [{ range: '[1,)', label: '', costs: [{ models: 1, points: 100 }] }],
        role: 'leader',
        attachTo: ['Necron Warriors', 'Immortals'],
      },
    },
    {
      id: 'warriors',
      name: 'Necron Warriors',
      keywords: [{ keyword: 'Battleline' }],
    },
    {
      id: 'immortals',
      name: 'Immortals',
    },
  ],
};

describe('buildBodyguardIndex', () => {
  it('marks bodyguard units from MFM attachTo', () => {
    const index = buildBodyguardIndex(pack);
    expect(isBodyguardUnit('warriors', index)).toBe(true);
    expect(isBodyguardUnit('immortals', index)).toBe(true);
    expect(isBodyguardUnit('imotekh', index)).toBe(false);
  });
});

describe('getAttachableUnits', () => {
  const roster: Roster = {
    id: 'r1',
    name: 'Test',
    factionId: 'NEC',
    factionName: 'Necrons',
    packVersion: '0.0.4',
    battleSize: 'strike-force',
    pointLimit: 2000,
    createdAt: '',
    updatedAt: '',
    enhancements: [],
    units: [
      {
        id: 'u1',
        datasheetId: 'warriors',
        name: 'Necron Warriors',
        models: 10,
        points: 80,
        tierLabel: '',
        copyIndex: 1,
      },
    ],
  };

  const sheets = new Map(pack.datasheets.map((d) => [d.id, d]));
  const imotekh = pack.datasheets[0]!;

  it('returns roster units matching attachTo names', () => {
    const targets = getAttachableUnits(roster, imotekh, sheets);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.name).toBe('Necron Warriors');
  });
});
