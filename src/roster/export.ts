import { enhancementTotalPoints } from './enhancements';
import { getAttachedUnitName } from './leaders';
import { rosterTotalPoints } from './points';
import type { Roster } from '../types';

export function formatRosterAsText(roster: Roster): string {
  const lines: string[] = [];
  const unitPoints = rosterTotalPoints(roster);
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
      lines.push(`  - ${unit.name} (${models}, ${unit.points} pts)${attachment}`);
    }
  }

  lines.push('');
  lines.push(`Total: ${total} / ${roster.pointLimit} pts`);
  if (roster.packVersion) lines.push(`Data pack v${roster.packVersion}`);

  return lines.join('\n');
}

export async function copyRosterToClipboard(roster: Roster): Promise<void> {
  const text = formatRosterAsText(roster);
  await navigator.clipboard.writeText(text);
}

export async function shareRoster(roster: Roster): Promise<boolean> {
  const text = formatRosterAsText(roster);
  if (navigator.share) {
    await navigator.share({ title: roster.name, text });
    return true;
  }
  await copyRosterToClipboard(roster);
  return false;
}
