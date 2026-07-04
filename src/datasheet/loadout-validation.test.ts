import { describe, expect, it } from 'vitest';
import type { Datasheet, ParsedLoadoutChoice, ParsedLoadoutGroup } from '../types';
import {
  computeEffectiveLoadout,
  isChoiceAvailable,
  validateLoadoutSelections,
} from './loadout-validation';

const plasmagunChoice: ParsedLoadoutChoice = {
  id: 'g1-c0',
  label: 'Plasmagun',
  items: ['Plasmagun'],
  points: 5,
};

const plasmaGunChoice: ParsedLoadoutChoice = {
  id: 'g2-c0',
  label: 'Plasma Gun',
  items: ['Plasma Gun'],
  points: 0,
};

const optionalGroup: ParsedLoadoutGroup = {
  id: 'g1',
  type: 'optional',
  label: 'Optional',
  rawText: '',
  choices: [plasmagunChoice],
};

const replaceGroup: ParsedLoadoutGroup = {
  id: 'g2',
  type: 'per-model',
  label: 'Replace',
  rawText: '',
  replaces: 'Boltgun',
  choices: [plasmaGunChoice],
};

const datasheet: Datasheet = {
  id: '1',
  name: 'Squad',
  loadout: 'Every model is equipped with: Boltgun.',
};

describe('loadout validation', () => {
  it('computes effective loadout with additions and replacements', () => {
    const effective = computeEffectiveLoadout(['Boltgun', 'Boltgun'], [optionalGroup, replaceGroup], [
      { groupId: 'g1', choiceId: 'g1-c0' },
      { groupId: 'g2', choiceId: 'g2-c0' },
    ]);
    expect([...effective]).toEqual(['Plasmagun', 'Plasma Gun']);
  });

  it('blocks replace when target is missing', () => {
    const availability = isChoiceAvailable(
      replaceGroup,
      plasmaGunChoice,
      [replaceGroup],
      [],
      ['Chainsword'],
    );
    expect(availability.ok).toBe(false);
    expect(availability.reason).toMatch(/Boltgun/i);
  });

  it('validates conflicting replace selections', () => {
    const exclusiveA: ParsedLoadoutGroup = {
      id: 'g3',
      type: 'exclusive',
      label: 'Replace pistol',
      rawText: '',
      replaces: 'Bolt Pistol',
      choices: [{ id: 'g3-c0', label: 'Plasma Pistol', items: ['Plasma Pistol'], points: 0 }],
    };
    const exclusiveB: ParsedLoadoutGroup = {
      id: 'g4',
      type: 'exclusive',
      label: 'Replace pistol again',
      rawText: '',
      replaces: 'Bolt Pistol',
      choices: [{ id: 'g4-c0', label: 'Grav Pistol', items: ['Grav Pistol'], points: 0 }],
    };
    const issues = validateLoadoutSelections(
      { ...datasheet, loadout: 'This model is equipped with: Bolt Pistol.' },
      [exclusiveA, exclusiveB],
      [
        { groupId: 'g3', choiceId: 'g3-c0' },
        { groupId: 'g4', choiceId: 'g4-c0' },
      ],
    );
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
  });

  it('respects requiresAbsent condition', () => {
    const conditional: ParsedLoadoutGroup = {
      id: 'g5',
      type: 'optional',
      label: 'Conditional',
      rawText: '',
      requiresAbsent: ['Storm Shield'],
      choices: [{ id: 'g5-c0', label: 'Meltagun', items: ['Meltagun'], points: 0 }],
    };
    const blocked = isChoiceAvailable(
      conditional,
      conditional.choices[0],
      [conditional],
      [],
      ['Storm Shield'],
    );
    expect(blocked.ok).toBe(false);

    const allowed = isChoiceAvailable(
      conditional,
      conditional.choices[0],
      [conditional],
      [],
      ['Boltgun'],
    );
    expect(allowed.ok).toBe(true);
  });
});
