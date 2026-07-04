import type { Datasheet, LoadoutSelection, MfmWargearOption, ParsedLoadoutChoice, ParsedLoadoutGroup } from '../types';

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^this model'?s?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return normalizeName(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
    const norm = normalizeName(item);
    const found = mfmOptions.find((option) => {
      const optionNorm = normalizeName(option.item);
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

export function parseOptionDescription(
  description: string,
  index: number,
  mfmOptions: MfmWargearOption[] = [],
): ParsedLoadoutGroup | null {
  const text = description.trim();
  const groupId = `opt-${index}`;

  let match: RegExpMatchArray | null;

  match = text.match(/^Any number of models can each have their (.+?) replaced with (?:1 |one )(.+?)\.?$/i);
  if (match) {
    const { label, items } = parseChoiceItems(match[2]);
    return {
      id: groupId,
      type: 'per-model',
      label: `Any model: replace ${cleanSubject(match[1])} → ${label}`,
      rawText: text,
      replaces: cleanSubject(match[1]),
      choices: [buildChoice(groupId, label, items, mfmOptions, 0)],
    };
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
      if (choice.mfmItem) referenced.add(normalizeName(choice.mfmItem));
      for (const item of choice.items) {
        const matched = matchMfmForItems([item], mfmOptions);
        for (const entry of matched) referenced.add(normalizeName(entry.item));
      }
    }
  }

  return mfmOptions.filter((option) => !referenced.has(normalizeName(option.item)));
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
