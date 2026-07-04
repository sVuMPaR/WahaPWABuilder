import { describe, expect, it } from 'vitest';
import { formatStatsPreview, hasUnitStats } from './stats';
import type { Datasheet } from '../types';

const warrior: Datasheet = {
  id: '1',
  name: 'Necron Warriors',
  models: [
    {
      name: 'Necron Warriors',
      m: '5"',
      t: '4',
      sv: '4+',
      w: '1',
      ld: '7+',
      oc: '2',
    },
  ],
};

describe('formatStatsPreview', () => {
  it('formats compact stat line', () => {
    expect(formatStatsPreview(warrior)).toBe('M5" · T4 · Sv4+ · W1 · Ld7+ · OC2');
  });

  it('detects stats availability', () => {
    expect(hasUnitStats(warrior)).toBe(true);
    expect(hasUnitStats({ id: '2', name: 'Empty' })).toBe(false);
  });
});
