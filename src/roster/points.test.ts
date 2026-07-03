import { describe, expect, it } from 'vitest';
import {
  copyInRange,
  getCostOptionsForCopy,
  getTierForCopy,
  recalculateRosterPricing,
  rosterGrandTotal,
} from './points';
import type { Datasheet, Roster } from '../types';

function baseRoster(overrides: Partial<Roster> = {}): Roster {
  return {
    id: 'r1',
    name: 'Test',
    factionId: 'NEC',
    factionName: 'Necrons',
    packVersion: '0.0.4',
    battleSize: 'strike-force',
    pointLimit: 2000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    units: [],
    enhancements: [],
    ...overrides,
  };
}

const warriors: Datasheet = {
  id: 'warriors',
  name: 'Necron Warriors',
  keywords: [{ keyword: 'Battleline' }],
  points: {
    source: 'mfm',
    version: '1.0',
    pricing: [
      { range: '[1,1]', label: 'Your Unit Costs', costs: [{ models: 10, points: 80 }] },
      {
        range: '[2,)',
        label: 'Your 2nd + Unit Costs',
        costs: [{ models: 10, points: 90 }],
      },
    ],
  },
};

describe('copyInRange', () => {
  it('matches unbounded range [1,)', () => {
    expect(copyInRange('[1,)', 1)).toBe(true);
    expect(copyInRange('[1,)', 3)).toBe(true);
  });

  it('matches closed range [1,1]', () => {
    expect(copyInRange('[1,1]', 1)).toBe(true);
    expect(copyInRange('[1,1]', 2)).toBe(false);
  });
});

describe('tier pricing', () => {
  it('uses first tier for first copy', () => {
    const tier = getTierForCopy(warriors.points!.pricing, 1);
    expect(tier?.label).toBe('Your Unit Costs');
    expect(getCostOptionsForCopy(warriors, 1)[0]?.points).toBe(80);
  });

  it('uses second tier for second copy', () => {
    const tier = getTierForCopy(warriors.points!.pricing, 2);
    expect(tier?.label).toBe('Your 2nd + Unit Costs');
    expect(getCostOptionsForCopy(warriors, 2)[0]?.points).toBe(90);
  });
});

describe('recalculateRosterPricing', () => {
  it('reprices remaining copy when first unit is removed', () => {
    const sheets = new Map<string, Datasheet>([['warriors', warriors]]);
    const roster = baseRoster({
      units: [
        {
          id: 'u1',
          datasheetId: 'warriors',
          name: 'Necron Warriors',
          models: 10,
          points: 90,
          tierLabel: 'Your 2nd + Unit Costs',
          copyIndex: 2,
        },
      ],
    });

    const updated = recalculateRosterPricing(roster, sheets);
    expect(updated.units[0]?.points).toBe(80);
    expect(updated.units[0]?.copyIndex).toBe(1);
  });
});

describe('rosterGrandTotal', () => {
  it('sums units and enhancements', () => {
    const roster = baseRoster({
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
      enhancements: [
        {
          id: 'e1',
          enhancementId: 'enh1',
          name: 'Veil of Darkness',
          points: 20,
          unitId: 'u1',
          unitName: 'Overlord',
        },
      ],
    });

    expect(rosterGrandTotal(roster)).toBe(100);
  });
});
