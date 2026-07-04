import { unitLoadoutSummary } from '../datasheet/loadout';
import { unitTotalPoints } from '../datasheet/wargear';
import { enhancementTotalPoints } from './enhancements';
import { getAttachedUnitName } from './leaders';
import { rosterUnitsPoints } from './points';
import type { Datasheet, Roster } from '../types';
import type { ValidationIssue } from './validation';

export function formatRosterAsText(
  roster: Roster,
  validationIssues?: ValidationIssue[],
  datasheets?: Map<string, Datasheet>,
): string {
  const lines: string[] = [];
  const unitPoints = rosterUnitsPoints(roster);
  const enhancementPoints = enhancementTotalPoints(roster);
  const total = unitPoints + enhancementPoints;

  lines.push(`${roster.name}`);
  lines.push(`${roster.factionName} · ${roster.pointLimit} pts (${roster.battleSize.replace('-', ' ')})`);
  if (roster.detachmentName) lines.push(`Detachment: ${roster.detachmentName}`);
  lines.push('');

  if (roster.enhancements?.length) {
    lines.push('Enhancements:');
    for (const enhancement of roster.enhancements) {
      lines.push(`  - ${enhancement.name} on ${enhancement.unitName} (${enhancement.points} pts)`);
    }
    lines.push('');
  }

  lines.push('Units:');
  if (roster.units.length === 0) {
    lines.push('  (empty)');
  } else {
    for (const unit of roster.units) {
      const models = unit.models === 1 ? '1 model' : `${unit.models} models`;
      const attached = getAttachedUnitName(roster, unit);
      const attachment = attached ? ` → ${attached}` : '';
      const datasheet = datasheets?.get(unit.datasheetId);
      const loadout = datasheet
        ? unitLoadoutSummary(unit, datasheet)
        : unit.wargear?.map((entry) => entry.item).join(', ') ?? '';
      const loadoutSuffix = loadout ? ` · ${loadout}` : '';
      lines.push(`  - ${unit.name} (${models}, ${unitTotalPoints(unit)} pts)${loadoutSuffix}${attachment}`);
    }
  }

  lines.push('');
  lines.push(`Total: ${total} / ${roster.pointLimit} pts`);

  const errors = validationIssues?.filter((issue) => issue.severity === 'error') ?? [];
  if (errors.length) {
    lines.push('');
    lines.push('⚠ List has rule errors:');
    for (const issue of errors) lines.push(`  - ${issue.message}`);
  }

  if (roster.packVersion) lines.push(`Data pack v${roster.packVersion}`);

  return lines.join('\n');
}

export async function copyRosterToClipboard(
  roster: Roster,
  validationIssues?: ValidationIssue[],
  datasheets?: Map<string, Datasheet>,
): Promise<void> {
  const text = formatRosterAsText(roster, validationIssues, datasheets);
  await navigator.clipboard.writeText(text);
}

export async function shareRoster(
  roster: Roster,
  validationIssues?: ValidationIssue[],
  datasheets?: Map<string, Datasheet>,
): Promise<boolean> {
  const text = formatRosterAsText(roster, validationIssues, datasheets);
  if (navigator.share) {
    await navigator.share({ title: roster.name, text });
    return true;
  }
  await copyRosterToClipboard(roster, validationIssues, datasheets);
  return false;
}
