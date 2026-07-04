import type { Datasheet, LoadoutSelection, MfmWargearOption, ParsedLoadoutChoice, ParsedLoadoutGroup } from '../types';

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export function normalizeItemName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^this model'?s?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return normalizeItemName(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseCount(raw: string): number {
  const lower = raw.toLowerCase();
  return WORD_NUMBERS[lower] ?? Number.parseInt(raw, 10);
}

export function splitReplaceSubject(subject: string): string[] {
  return subject
    .split(/\s+and\s+(?:1\s+)?/i)
    .map((part) => part.trim().replace(/^1\s+/, '').replace(/\.$/, ''))
    .filter(Boolean);
}

export function parseDefaultLoadoutItems(loadout?: string): string[] {
  if (!loadout) return [];

  const equipped = loadout.match(/equipped with:\s*(.+)$/i)?.[1] ?? loadout;
  return equipped
    .split(';')
    .map((part) => part.trim().replace(/^1\s+/, '').replace(/\.$/, ''))
    .filter(Boolean);
}

function parseChoiceItems(text: string): { label: string; items: string[] } {
  const cleaned = text.trim().replace(/\.$/, '');
  const items = cleaned
    .split(/\s+and\s+(?:1\s+)?/i)
    .map((part) => part.trim().replace(/^1\s+/, ''))
    .filter(Boolean);

  return {
    label: items.join(' + '),
    items,
  };
}

function splitNumberedChoices(text: string): string[] {
  const trimmed = text.trim().replace(/\.$/, '');
  const parts = trimmed.split(/(?<!\band)\s+(?=\d+\s+[a-zA-Z"'(])/);
  if (parts.length <= 1 && !/^\d+\s/.test(trimmed)) return [trimmed];
  return parts.map((part) => part.replace(/^\d+\s+/, '').trim()).filter(Boolean);
}

function matchMfmForItems(items: string[], mfmOptions: MfmWargearOption[]): MfmWargearOption[] {
  const matched: MfmWargearOption[] = [];

  for (const item of items) {
    const norm = normalizeItemName(item);
    const found = mfmOptions.find((option) => {
      const optionNorm = normalizeItemName(option.item);
      return optionNorm === norm || optionNorm.includes(norm) || norm.includes(optionNorm);
    });
    if (found && !matched.some((entry) => entry.item === found.item)) {
      matched.push(found);
    }
  }

  return matched;
}

function buildChoice(
  groupId: string,
  label: string,
  items: string[],
  mfmOptions: MfmWargearOption[],
  index: number,
): ParsedLoadoutChoice {
  const matched = matchMfmForItems(items, mfmOptions);
  const points = matched.reduce((sum, entry) => sum + entry.points, 0);

  return {
    id: `${groupId}-${index}`,
    label,
    items,
    points,
    ...(matched.length === 1 ? { mfmItem: matched[0].item } : {}),
  };
}

function cleanSubject(subject: string): string {
  return subject
    .replace(/^this model'?s?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRulesNote(text: string): boolean {
  if (text === 'None' || text === 'None.') return true;
  if (/^\*+/.test(text)) return true;
  if (/^This weapon cannot be replaced/i.test(text)) return true;
  if (/^You cannot select the same/i.test(text)) return true;
  if (/^If this unit contains/i.test(text)) {
    if (/\bcannot\b/i.test(text)) return true;
    return !/\bcan (?:be equipped|be replaced|have|each)\b/i.test(text);
  }
  return false;
}

function buildPerModelGroup(
  groupId: string,
  subject: string,
  replaces: string,
  replacement: string,
  mfmOptions: MfmWargearOption[],
  maxModels?: number,
): ParsedLoadoutGroup {
  const { label, items } = parseChoiceItems(replacement);
  const replaceLabel = cleanSubject(replaces);

  return {
    id: groupId,
    type: 'per-model',
    label: maxModels
      ? `Up to ${maxModels} ${subject}: replace ${replaceLabel} → ${label}`
      : `${subject}: replace ${replaceLabel} → ${label}`,
    rawText: `${subject} replace ${replaces} → ${replacement}`,
    replaces: replaceLabel,
    ...(maxModels ? { maxModels } : {}),
    choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
  };
}

const COUNT_TOKEN = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)';

function parseEquippedCount(raw: string): number {
  return parseCount(raw.replace(/^up to\s+/i, ''));
}

export function parseOptionDescription(
  description: string,
  index: number,
  mfmOptions: MfmWargearOption[] = [],
): ParsedLoadoutGroup | null {
  const text = description.trim().replace(/\u2019/g, "'");
  const groupId = `opt-${index}`;

  if (isRulesNote(text)) return null;

  let match: RegExpMatchArray | null;

  match = text.match(
    new RegExp(
      `^For every (\\d+) models(?: in this unit)?, up to (\\d+|two|three|four|five|six|seven|eight|nine|ten) (.+?) can each have their (.+?) replaced with (?:1 |one )(.+?)\\.?$`,
      'i',
    ),
  );
  if (match) {
    return buildPerModelGroup(
      groupId,
      match[3],
      match[4],
      match[5],
      mfmOptions,
      parseCount(match[2]),
    );
  }

  match = text.match(
    new RegExp(
      `^For every (\\d+) models(?: in this unit)?, (?:it|this unit|1 model) can (?:be equipped with|have) (?:1 |one )(.+?)\\.?$`,
      'i',
    ),
  );
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'ratio-optional',
      label: `Every ${match[1]} models: add ${label}`,
      rawText: text,
      ratioPerModels: Number(match[1]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(
    /^For every (\d+) models(?: in this unit)?, (?:it|this unit) can have (?:1 |one )(.+?)\.?$/i,
  );
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'ratio-optional',
      label: `Every ${match[1]} models: add ${label}`,
      rawText: text,
      ratioPerModels: Number(match[1]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^Any number of models can each be equipped with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[1]);
    return {
      id: groupId,
      type: 'per-model',
      label: `Any model: add ${label}`,
      rawText: text,
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^Up to (\d+|two|three|four|five|six|seven|eight|nine|ten) models can each be equipped with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'optional',
      label: `Up to ${match[1]} models: add ${label}`,
      rawText: text,
      maxModels: parseCount(match[1]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(
    new RegExp(`^This model'?s? ${COUNT_TOKEN} (.+?) can be replaced with ${COUNT_TOKEN} (.+?)\\.?$`, 'i'),
  );
  if (match) {
    const { label, items } = parseChoiceItems(match[4]);
    return {
      id: groupId,
      type: 'exclusive',
      label: `Replace ${parseCount(match[1])}× ${cleanSubject(match[2])} → ${label}`,
      rawText: text,
      replaces: cleanSubject(match[2]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(
    /^If this unit contains (\d+|two|three|four|five|six|seven|eight|nine|ten) models, 1 (.+?) can be replaced with (?:1 |one )(.+?)\.?$/i,
  );
  if (match) {
    const subject = cleanSubject(match[2]);
    const { label, items } = parseChoiceItems(match[3]);
    return {
      id: groupId,
      type: 'per-model',
      label: `At ${match[1]} models — ${subject}: replace → ${label}`,
      rawText: text,
      replaces: subject,
      maxModels: 1,
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(
    /^This model can be equipped with up to (two|three|four|five|\d+) of the following(?:, and can take duplicates)?:\s*(.+)$/is,
  );
  if (match) {
    const maxPick = parseEquippedCount(match[1]);
    const choices = splitNumberedChoices(match[2]).map((part, choiceIndex) => {
      const { label, items } = parseChoiceItems(part);
      return buildChoice(groupId, label, items, mfmOptions, choiceIndex);
    });
    return {
      id: groupId,
      type: 'optional',
      label: `Pick up to ${maxPick} (duplicates allowed)`,
      rawText: text,
      maxModels: maxPick,
      choices,
    };
  }

  match = text.match(
    /^Up to (\d+|two|three|four|five|six|seven|eight|nine|ten) (.+?) can each (?:have their|replace their) (.+?) replaced with (?:1 |one )(.+?)\.?$/i,
  );
  if (match) {
    return buildPerModelGroup(
      groupId,
      match[2],
      match[3],
      match[4],
      mfmOptions,
      parseCount(match[1]),
    );
  }

  match = text.match(/^All of the models in this unit can each have their (.+?) replaced with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    return buildPerModelGroup(groupId, 'All models', match[1], match[2], mfmOptions);
  }

  match = text.match(/^Any number of models can each have their (.+?) replaced with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    return buildPerModelGroup(groupId, 'Any model', match[1], match[2], mfmOptions);
  }

  match = text.match(/^Any number of (.+?) can each replace their (.+?) with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    return buildPerModelGroup(groupId, match[1], match[2], match[3], mfmOptions);
  }

  match = text.match(/^Any number of (.+?) can each have their (.+?) replaced with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    return buildPerModelGroup(groupId, match[1], match[2], match[3], mfmOptions);
  }

  match = text.match(/^(.+?) can be replaced with one of the following:\s*(.+)$/is);
  if (match) {
    const choices = splitNumberedChoices(match[2]).map((part, choiceIndex) => {
      const { label, items } = parseChoiceItems(part);
      return buildChoice(groupId, label, items, mfmOptions, choiceIndex);
    });

    return {
      id: groupId,
      type: 'exclusive',
      label: `Replace ${cleanSubject(match[1])}`,
      rawText: text,
      replaces: cleanSubject(match[1]),
      choices,
    };
  }

  match = text.match(/^If this model is not equipped with (.+?), it can be equipped with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'optional',
      label: `If no ${cleanSubject(match[1])}: add ${label}`,
      rawText: text,
      requiresAbsent: splitReplaceSubject(match[1]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(
    new RegExp(`^This model can be equipped with ${COUNT_TOKEN} (.+?)\\.?$`, 'i'),
  );
  if (match) {
    const count = parseCount(match[1]);
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'optional',
      label: count > 1 ? `Optional: ${count}× ${label}` : `Optional: ${label}`,
      rawText: text,
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^This model can be equipped with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[1]);
    return {
      id: groupId,
      type: 'optional',
      label: `Optional: ${label}`,
      rawText: text,
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^This model'?s? (.+?) can be replaced with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'exclusive',
      label: `Replace ${cleanSubject(match[1])} → ${label}`,
      rawText: text,
      replaces: cleanSubject(match[1]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^(.+?) can be replaced with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'exclusive',
      label: `Replace ${cleanSubject(match[1])} → ${label}`,
      rawText: text,
      replaces: cleanSubject(match[1]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(
    new RegExp(`^(.+?) can be equipped with ${COUNT_TOKEN} (.+?)\\.?$`, 'i'),
  );
  if (match && !/^this model$/i.test(cleanSubject(match[1]))) {
    const count = parseCount(match[2]);
    const { label, items } = parseChoiceItems(match[3]);
    return {
      id: groupId,
      type: 'optional',
      label: count > 1 ? `${cleanSubject(match[1])}: add ${count}× ${label}` : `${cleanSubject(match[1])}: add ${label}`,
      rawText: text,
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^(.+?) can be equipped with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'optional',
      label: `${cleanSubject(match[1])}: add ${label}`,
      rawText: text,
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^One model in this unit can be equipped with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[1]);
    return {
      id: groupId,
      type: 'optional',
      label: `One model: add ${label}`,
      rawText: text,
      maxModels: 1,
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
  }

  match = text.match(/^One model in this unit can (?:have|replace) (?:their )?(.+?) (?:replaced )?with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    return buildPerModelGroup(groupId, 'One model', match[1], match[2], mfmOptions, 1);
  }

  return null;
}

export function parseDatasheetLoadout(datasheet: Datasheet): ParsedLoadoutGroup[] {
  const mfmOptions = datasheet.points?.wargear ?? [];
  const groups: ParsedLoadoutGroup[] = [];

  for (const [index, option] of (datasheet.options ?? []).entries()) {
    const parsed = parseOptionDescription(option.description, index, mfmOptions);
    if (parsed) groups.push(parsed);
  }

  return groups;
}

export function getUnparsedOptions(datasheet: Datasheet): string[] {
  const mfmOptions = datasheet.points?.wargear ?? [];
  return (datasheet.options ?? [])
    .filter((option, index) => !parseOptionDescription(option.description, index, mfmOptions))
    .map((option) => option.description);
}

export function getStandaloneMfmOptions(
  datasheet: Datasheet,
  groups: ParsedLoadoutGroup[],
): MfmWargearOption[] {
  const mfmOptions = datasheet.points?.wargear ?? [];
  const referenced = new Set<string>();

  for (const group of groups) {
    for (const choice of group.choices) {
      if (choice.mfmItem) referenced.add(normalizeItemName(choice.mfmItem));
      for (const item of choice.items) {
        const matched = matchMfmForItems([item], mfmOptions);
        for (const entry of matched) referenced.add(normalizeItemName(entry.item));
      }
    }
  }

  return mfmOptions.filter((option) => !referenced.has(normalizeItemName(option.item)));
}

export function getDefaultLoadoutSelections(groups: ParsedLoadoutGroup[]): LoadoutSelection[] {
  return groups.map((group) => ({ groupId: group.id, choiceId: null }));
}

export function resolveChoice(
  groups: ParsedLoadoutGroup[],
  groupId: string,
  choiceId: string | null,
): ParsedLoadoutChoice | null {
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) return null;
  if (!choiceId) return null;
  return group.choices.find((choice) => choice.id === choiceId) ?? null;
}

export function wargearFromSelections(
  datasheet: Datasheet,
  groups: ParsedLoadoutGroup[],
  selections: LoadoutSelection[],
  extraWargear: MfmWargearOption[] = [],
): MfmWargearOption[] {
  const mfmOptions = datasheet.points?.wargear ?? [];
  const resolved = new Map<string, MfmWargearOption>();

  for (const selection of selections) {
    const choice = resolveChoice(groups, selection.groupId, selection.choiceId);
    if (!choice) continue;

    const matched = choice.mfmItem
      ? mfmOptions.filter((option) => option.item === choice.mfmItem)
      : matchMfmForItems(choice.items, mfmOptions);

    for (const item of matched) {
      resolved.set(item.item, item);
    }
  }

  for (const item of extraWargear) {
    resolved.set(item.item, item);
  }

  return [...resolved.values()];
}

export function formatSelectionSummary(
  groups: ParsedLoadoutGroup[],
  selections: LoadoutSelection[],
  extraWargear: MfmWargearOption[] = [],
): string {
  const parts: string[] = [];

  for (const selection of selections) {
    const choice = resolveChoice(groups, selection.groupId, selection.choiceId);
    if (choice) parts.push(choice.label);
  }

  for (const item of extraWargear) {
    parts.push(item.item);
  }

  return parts.join('; ');
}

export function choiceLabelId(label: string): string {
  return slugify(label);
}

export function getParseCoverageStats(datasheet: Datasheet): { parsed: number; total: number } {
  const total = datasheet.options?.length ?? 0;
  const parsed = parseDatasheetLoadout(datasheet).length;
  return { parsed, total };
}
