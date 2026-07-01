#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMfmFaction } from './lib/mfm-parse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(join(__dirname, 'fixtures/mfm-necrons.html'), 'utf8');
const faction = parseMfmFaction(fixture, 'necrons', 'Necrons', new Set(['necrons']));

if (faction.units.length < 50) {
  console.error(`Expected at least 50 units, got ${faction.units.length}`);
  process.exit(1);
}

if (faction.detachments.length < 10) {
  console.error(`Expected at least 10 detachments, got ${faction.detachments.length}`);
  process.exit(1);
}

const warriors = faction.units.find((unit) => unit.name === 'Necron Warriors');
if (!warriors) {
  console.error('Necron Warriors not found');
  process.exit(1);
}

const tenModels = warriors.pricing[0]?.costs.find((cost) => cost.models === 10);
if (!tenModels || tenModels.points !== 80) {
  console.error('Unexpected Necron Warriors pricing', warriors.pricing);
  process.exit(1);
}

const murdermindDet = faction.detachments.find((d) => d.name === 'Cursed Legion');
const murdermind = murdermindDet?.enhancements.find((e) => e.name === 'Murdermind');
if (!murdermind?.leaderTo?.length) {
  console.error('Murdermind leaderTo not parsed');
  process.exit(1);
}

console.log(
  `mfm-parse tests passed (${faction.units.length} units, ${faction.detachments.length} detachments)`,
);
