import type { Datasheet, FactionPack, Roster } from '../types';
import { countDatasheetCopies } from './points';
import { rosterGrandTotal, isOverLimit } from './points';

export interface DatasheetKeyword {
  keyword: string;
  isFactionKeyword?: string | boolean;
  model?: string;
  datasheetId?: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

export function getKeywords(datasheet: Datasheet): string[] {
  return (datasheet.keywords ?? [])
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      return entry.keyword ?? '';
    })
    .filter(Boolean);
}

export function hasKeyword(datasheet: Datasheet, keyword: string): boolean {
  const target = keyword.toLowerCase();
  return getKeywords(datasheet).some((entry) => entry.toLowerCase() === target);
}

export function isEpicHero(datasheet: Datasheet): boolean {
  return hasKeyword(datasheet, 'Epic Hero');
}

export function isBattleline(datasheet: Datasheet): boolean {
  return hasKeyword(datasheet, 'Battleline');
}

export function maxUnitCopies(datasheet: Datasheet): number {
  if (isEpicHero(datasheet)) return 1;
  if (isBattleline(datasheet)) return 6;
  return 3;
}

export function copyLimitLabel(datasheet: Datasheet): string {
  if (isEpicHero(datasheet)) return 'Epic Hero (max 1)';
  if (isBattleline(datasheet)) return 'Battleline (max 6)';
  return 'max 3';
}

export function canAddUnitCopy(
  roster: Roster,
  datasheet: Datasheet,
): { ok: true } | { ok: false; message: string } {
  const copies = countDatasheetCopies(roster, datasheet.id);
  const max = maxUnitCopies(datasheet);

  if (copies >= max) {
    return {
      ok: false,
      message: `${datasheet.name}: already at the limit (${max} ${isEpicHero(datasheet) ? 'Epic Hero' : isBattleline(datasheet) ? 'Battleline' : 'copies'})`,
    };
  }

  return { ok: true };
}

export function isCharacter(datasheet: Datasheet): boolean {
  return hasKeyword(datasheet, 'Character');
}

export function rosterHasCharacter(roster: Roster, datasheets: Map<string, Datasheet>): boolean {
  return roster.units.some((unit) => {
    const datasheet = datasheets.get(unit.datasheetId);
    if (!datasheet) return false;
    if (unit.mfmRole === 'leader' || unit.mfmRole === 'support') return true;
    return isCharacter(datasheet);
  });
}

export function isRosterLegal(roster: Roster, datasheets: Map<string, Datasheet>): boolean {
  return getRosterValidationIssues(roster, datasheets).every((issue) => issue.severity !== 'error');
}

export function getRosterErrors(roster: Roster, datasheets: Map<string, Datasheet>): ValidationIssue[] {
  return getRosterValidationIssues(roster, datasheets).filter((issue) => issue.severity === 'error');
}

export function getRosterValidationIssues(
  roster: Roster,
  datasheets: Map<string, Datasheet>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const counts = new Map<string, number>();

  for (const unit of roster.units) {
    counts.set(unit.datasheetId, (counts.get(unit.datasheetId) ?? 0) + 1);
  }

  for (const [datasheetId, count] of counts) {
    const datasheet = datasheets.get(datasheetId);
    if (!datasheet) continue;

    const max = maxUnitCopies(datasheet);
    if (count > max) {
      issues.push({
        severity: 'error',
        message: `${datasheet.name}: ${count} copies (limit ${max})`,
      });
    }
  }

  for (const unit of roster.units) {
    if (unit.mfmRole && !unit.attachedToUnitId) {
      issues.push({
        severity: 'error',
        message: `${unit.name} must be attached to a bodyguard unit`,
      });
    }
  }

  if (roster.units.length > 0 && !rosterHasCharacter(roster, datasheets)) {
    issues.push({
      severity: 'error',
      message: 'Army must include at least one Character unit',
    });
  }

  if (isOverLimit(roster)) {
    issues.push({
      severity: 'error',
      message: `Over point limit by ${rosterGrandTotal(roster) - roster.pointLimit} pts`,
    });
  }

  return issues;
}

export function factionHasKeywordData(pack: FactionPack): boolean {
  return pack.datasheets.some((datasheet) => (datasheet.keywords?.length ?? 0) > 0);
}
