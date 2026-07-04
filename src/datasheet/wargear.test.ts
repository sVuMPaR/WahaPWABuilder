import { describe, expect, it } from 'vitest';
import { applyUnitWargear, unitTotalPoints } from './wargear';
import type { RosterUnit } from '../types';

const unit: RosterUnit = {
  id: 'u1',
  datasheetId: 'd1',
  name: 'Captain',
  models: 1,
  basePoints: 100,
  points: 100,
  tierLabel: 'Your Unit Costs',
  copyIndex: 1,
  wargear: [],
};

describe('applyUnitWargear', () => {
  it('adds wargear points to unit total', () => {
    const updated = applyUnitWargear(unit, [
      { item: 'Thunder Hammer', points: 5 },
      { item: 'Storm Shield', points: 10 },
    ]);
    expect(updated.points).toBe(115);
    expect(unitTotalPoints(updated)).toBe(115);
  });

  it('clears wargear back to base points', () => {
    const withWargear = applyUnitWargear(unit, [{ item: 'Hammer', points: 5 }]);
    const cleared = applyUnitWargear(withWargear, []);
    expect(cleared.points).toBe(100);
  });
});
