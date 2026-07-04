import { describe, expect, it } from 'vitest';
import {
  getParseCoverageStats,
  parseDatasheetLoadout,
  parseDefaultLoadoutItems,
  parseOptionDescription,
  wargearFromSelections,
} from './loadout-parser';
import type { Datasheet } from '../types';

describe('parseDefaultLoadoutItems', () => {
  it('parses semicolon-separated loadout', () => {
    expect(parseDefaultLoadoutItems('Every model is equipped with: gauss flayer; close combat weapon.')).toEqual([
      'gauss flayer',
      'close combat weapon',
    ]);
  });
});

describe('parseOptionDescription', () => {
  const mfm = [{ item: 'Macro plasma incinerator', points: 10 }];

  it('parses per-model replacement', () => {
    const group = parseOptionDescription(
      'Any number of models can each have their gauss flayer replaced with 1 gauss reaper.',
      0,
    );
    expect(group?.type).toBe('per-model');
    expect(group?.choices[0].label).toBe('gauss reaper');
  });

  it('parses exclusive one-of list', () => {
    const group = parseOptionDescription(
      "This model's tachyon arrow and Overlord’s blade can be replaced with one of the following:1 staff of light 1 voidscythe",
      0,
    );
    expect(group?.type).toBe('exclusive');
    expect(group?.choices).toHaveLength(2);
    expect(group?.choices[0].label).toBe('staff of light');
    expect(group?.choices[1].label).toBe('voidscythe');
  });

  it('parses optional add-on', () => {
    const group = parseOptionDescription('This model can be equipped with 1 Icarus rocket pod.', 0);
    expect(group?.type).toBe('optional');
    expect(group?.choices[0].label).toBe('Icarus rocket pod');
  });

  it('matches MFM points on replacement', () => {
    const group = parseOptionDescription(
      'This model’s heavy onslaught gatling cannon can be replaced with 1 macro plasma incinerator.',
      0,
      mfm,
    );
    expect(group?.choices[0].points).toBe(10);
    expect(group?.choices[0].mfmItem).toBe('Macro plasma incinerator');
  });

  it('parses captain bundle choices', () => {
    const group = parseOptionDescription(
      'This model’s bolt pistol, master-crafted bolter and close combat weapon can be replaced with one of the following: 1 heavy bolt pistol and 1 power fist 1 heavy bolt pistol and 1 master-crafted power weapon',
      0,
    );
    expect(group?.choices).toHaveLength(2);
    expect(group?.choices[0].label).toBe('heavy bolt pistol + power fist');
  });

  it('parses counted optional wargear', () => {
    const group = parseOptionDescription('This model can be equipped with 3 hunter-killer missiles.', 0);
    expect(group?.type).toBe('optional');
    expect(group?.label).toMatch(/3×/);
  });

  it('parses per-model equip add-on', () => {
    const group = parseOptionDescription('Any number of models can each be equipped with 1 hunter-killer missile.', 0);
    expect(group?.type).toBe('per-model');
    expect(group?.choices[0].label).toBe('hunter-killer missile');
  });

  it('parses paired weapon replacement', () => {
    const group = parseOptionDescription(
      'This model’s 2 twin heavy flamers can be replaced with 2 twin heavy bolters.',
      0,
    );
    expect(group?.type).toBe('exclusive');
    expect(group?.replaces).toBe('twin heavy flamers');
    expect(group?.choices[0].label).toBe('twin heavy bolters');
  });

  it('parses ratio per-model replacement', () => {
    const group = parseOptionDescription(
      'For every 5 models in this unit, up to 2 Plague Marines can each have their boltgun replaced with 1 plasma gun.',
      0,
    );
    expect(group?.type).toBe('per-model');
    expect(group?.maxModels).toBe(2);
  });

  it('parses conditional unit-size option', () => {
    const group = parseOptionDescription(
      'If this unit contains 10 models, 1 Corsair Voidscarred’s shuriken rifle can be replaced with 1 fusion gun.',
      0,
    );
    expect(group?.type).toBe('per-model');
    expect(group?.maxModels).toBe(1);
  });

  it('parses up-to list with duplicates', () => {
    const group = parseOptionDescription(
      'This model can be equipped with up to two of the following, and can take duplicates:1 gun drone 1 marker drone',
      0,
    );
    expect(group?.type).toBe('optional');
    expect(group?.maxModels).toBe(2);
    expect(group?.choices.length).toBeGreaterThan(1);
  });

  it('skips notes and asterisk lines', () => {
    expect(parseOptionDescription('* This unit can only take one of these options.', 0)).toBeNull();
    expect(parseOptionDescription('None', 0)).toBeNull();
    expect(parseOptionDescription('If this unit contains a Captain, it cannot take this wargear.', 0)).toBeNull();
  });
});

describe('wargearFromSelections', () => {
  const datasheet: Datasheet = {
    id: '1',
    name: 'Redemptor Dreadnought',
    points: { source: 'mfm', version: '1.0', pricing: [], wargear: [{ item: 'Macro plasma incinerator', points: 10 }] },
    options: [
      {
        description:
          'This model’s heavy onslaught gatling cannon can be replaced with 1 macro plasma incinerator.',
      },
    ],
  };

  it('derives MFM wargear from parsed selection', () => {
    const groups = parseDatasheetLoadout(datasheet);
    const wargear = wargearFromSelections(datasheet, groups, [{ groupId: groups[0].id, choiceId: groups[0].choices[0].id }]);
    expect(wargear).toEqual([{ item: 'Macro plasma incinerator', points: 10 }]);
  });
});

describe('getParseCoverageStats', () => {
  it('reports parsed option count', () => {
    const datasheet: Datasheet = {
      id: '1',
      name: 'Test',
      options: [
        { description: 'This model can be equipped with 1 Plasmagun.' },
        { description: '* designer note' },
        { description: 'None' },
      ],
    };
    expect(getParseCoverageStats(datasheet)).toEqual({ parsed: 1, total: 3 });
  });
});
