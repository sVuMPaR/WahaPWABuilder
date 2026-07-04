import { describe, expect, it } from 'vitest';
import {
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
