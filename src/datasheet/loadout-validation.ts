import type {
  Datasheet,
  LoadoutSelection,
  LoadoutValidationIssue,
  ParsedLoadoutChoice,
  ParsedLoadoutGroup,
} from '../types';
import {
  normalizeItemName,
  parseDefaultLoadoutItems,
  resolveChoice,
  splitReplaceSubject,
} from './loadout-parser';

function itemMatches(candidate: string, equipped: string): boolean {
  const left = normalizeItemName(candidate);
  const right = normalizeItemName(equipped);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function itemInList(item: string, list: Iterable<string>): boolean {
  for (const entry of list) {
    if (itemMatches(item, entry)) return true;
  }
  return false;
}

function removeFromLoadout(loadout: Set<string>, toRemove: string[]): void {
  for (const item of [...loadout]) {
    if (toRemove.some((target) => itemMatches(target, item))) {
      loadout.delete(item);
    }
  }
}

function addToLoadout(loadout: Set<string>, toAdd: string[]): void {
  for (const item of toAdd) {
    loadout.add(item);
  }
}

export function computeEffectiveLoadout(
  defaultItems: string[],
  groups: ParsedLoadoutGroup[],
  selections: LoadoutSelection[],
): Set<string> {
  const loadout = new Set(defaultItems);

  for (const group of groups) {
    const selection = selections.find((entry) => entry.groupId === group.id);
    const choice = resolveChoice(groups, group.id, selection?.choiceId ?? null);
    if (!choice) continue;

    if (group.replaces) {
      removeFromLoadout(loadout, splitReplaceSubject(group.replaces));
    }
    addToLoadout(loadout, choice.items);
  }

  return loadout;
}

export function isChoiceAvailable(
  group: ParsedLoadoutGroup,
  choice: ParsedLoadoutChoice,
  groups: ParsedLoadoutGroup[],
  selections: LoadoutSelection[],
  defaultItems: string[],
): { ok: boolean; reason?: string } {
  if (group.type === 'note') {
    return { ok: false, reason: 'Rules note only' };
  }

  const otherSelections = selections.filter((entry) => entry.groupId !== group.id);
  const loadout = computeEffectiveLoadout(defaultItems, groups, otherSelections);

  if (group.requiresAbsent?.length) {
    for (const required of group.requiresAbsent) {
      if (itemInList(required, loadout)) {
        return { ok: false, reason: `Requires ${required} to be absent` };
      }
    }
  }

  if (group.replaces) {
    const replaceItems = splitReplaceSubject(group.replaces);
    const missing = replaceItems.filter((item) => !itemInList(item, loadout));
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Cannot replace ${missing.join(', ')} — not in current loadout`,
      };
    }
  }

  for (const otherGroup of groups) {
    if (otherGroup.id === group.id) continue;
    const otherSelection = selections.find((entry) => entry.groupId === otherGroup.id);
    const otherChoice = resolveChoice(groups, otherGroup.id, otherSelection?.choiceId ?? null);
    if (!otherChoice) continue;

    const duplicate = choice.items.some((item) =>
      otherChoice.items.some((otherItem) => itemMatches(item, otherItem)),
    );
    if (duplicate && group.type !== 'per-model' && otherGroup.type !== 'per-model') {
      return { ok: false, reason: `Conflicts with ${otherChoice.label}` };
    }
  }

  return { ok: true };
}

export function validateLoadoutSelections(
  datasheet: Datasheet,
  groups: ParsedLoadoutGroup[],
  selections: LoadoutSelection[],
): LoadoutValidationIssue[] {
  const issues: LoadoutValidationIssue[] = [];
  const defaultItems = parseDefaultLoadoutItems(datasheet.loadout);

  for (const group of groups) {
    const selection = selections.find((entry) => entry.groupId === group.id);
    const choice = resolveChoice(groups, group.id, selection?.choiceId ?? null);
    if (!choice) continue;

    const availability = isChoiceAvailable(group, choice, groups, selections, defaultItems);
    if (!availability.ok) {
      issues.push({
        severity: 'error',
        message: `${group.label}: ${availability.reason ?? 'Invalid selection'}`,
        groupId: group.id,
      });
    }
  }

  const activeReplaceTargets = new Map<string, string>();
  for (const group of groups) {
    if (!group.replaces) continue;
    const selection = selections.find((entry) => entry.groupId === group.id);
    if (!selection?.choiceId) continue;

    for (const item of splitReplaceSubject(group.replaces)) {
      const key = normalizeItemName(item);
      const existingGroupId = activeReplaceTargets.get(key);
      if (existingGroupId && existingGroupId !== group.id) {
        const other = groups.find((entry) => entry.id === existingGroupId);
        issues.push({
          severity: 'error',
          message: `"${other?.label ?? 'Another option'}" and "${group.label}" both replace ${item}`,
          groupId: group.id,
        });
      } else {
        activeReplaceTargets.set(key, group.id);
      }
    }
  }

  for (const group of groups) {
    const selection = selections.find((entry) => entry.groupId === group.id);
    const choice = resolveChoice(groups, group.id, selection?.choiceId ?? null);
    if (!choice || !group.replaces) continue;

    for (const item of splitReplaceSubject(group.replaces)) {
      if (!itemInList(item, defaultItems)) {
        issues.push({
          severity: 'warning',
          message: `${group.label} replaces ${item}, which is not in the default loadout`,
          groupId: group.id,
        });
      }
    }
  }

  return issues;
}

export function collectSelectionsFromModal(
  groups: ParsedLoadoutGroup[],
  root: ParentNode,
): LoadoutSelection[] {
  return groups.map((group) => {
    if (group.type === 'exclusive') {
      const selected = root.querySelector<HTMLInputElement>(`input[name="loadout-${group.id}"]:checked`);
      const choiceId = selected?.value ? selected.value : null;
      return { groupId: group.id, choiceId };
    }

    const checked = root.querySelector<HTMLInputElement>(
      `.loadout-checkbox[data-group-id="${group.id}"]:checked`,
    );
    return { groupId: group.id, choiceId: checked?.dataset.choiceId ?? null };
  });
}
