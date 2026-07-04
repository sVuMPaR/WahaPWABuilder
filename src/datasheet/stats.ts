import type { Datasheet, DatasheetModelProfile } from '../types';

export function getPrimaryProfile(datasheet: Datasheet): DatasheetModelProfile | null {
  return datasheet.models?.[0] ?? null;
}

export function hasUnitStats(datasheet: Datasheet): boolean {
  const profile = getPrimaryProfile(datasheet);
  return Boolean(profile?.m || profile?.t || profile?.sv);
}

function formatInvSave(profile: DatasheetModelProfile): string {
  if (!profile.invSv || profile.invSv === '-') return '';
  const suffix = profile.invSvDescr ? '*' : '';
  return ` / ${profile.invSv}+${suffix}`;
}

export function formatStatsPreview(datasheet: Datasheet): string {
  const profile = getPrimaryProfile(datasheet);
  if (!profile) return '';

  const parts: string[] = [];
  if (profile.m) parts.push(`M${profile.m}`);
  if (profile.t) parts.push(`T${profile.t}`);
  if (profile.sv) parts.push(`Sv${profile.sv}${formatInvSave(profile)}`);
  if (profile.w) parts.push(`W${profile.w}`);
  if (profile.ld) parts.push(`Ld${profile.ld}`);
  if (profile.oc) parts.push(`OC${profile.oc}`);

  return parts.join(' · ');
}

export function formatStatsRow(profile: DatasheetModelProfile): string {
  const inv = formatInvSave(profile);
  return [profile.m, profile.t, profile.sv ? `${profile.sv}${inv}` : '', profile.w, profile.ld, profile.oc]
    .filter(Boolean)
    .map((value, index) => {
      const labels = ['M', 'T', 'Sv', 'W', 'Ld', 'OC'];
      return `${labels[index]} ${value}`;
    })
    .join(' · ');
}
