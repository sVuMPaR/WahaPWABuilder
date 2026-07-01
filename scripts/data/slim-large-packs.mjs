#!/usr/bin/env node
/**
 * Strip heavy datasheet fields from oversized faction packs (e.g. Space Marines ~53MB).
 * Keeps roster-builder fields; full wargear/abilities remain in raw build if needed later.
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from './lib/config.mjs';

const SIZE_THRESHOLD_BYTES = 5 * 1024 * 1024;

const DATASHEET_KEYS = [
  'id',
  'name',
  'role',
  'legend',
  'keywords',
  'points',
  'enhancements',
  'leaderAttachments',
  'leaderHead',
  'leaderFooter',
];

function slimEnhancement(enhancement) {
  return {
    id: enhancement.id,
    name: enhancement.name,
    cost: enhancement.cost,
    detachmentId: enhancement.detachmentId,
    detachment: enhancement.detachment,
    points: enhancement.points,
  };
}

function slimDatasheet(datasheet) {
  const slim = {};
  for (const key of DATASHEET_KEYS) {
    if (datasheet[key] === undefined) continue;
    if (key === 'enhancements') {
      slim.enhancements = datasheet.enhancements.map(slimEnhancement);
    } else {
      slim[key] = datasheet[key];
    }
  }
  return slim;
}

function slimPack(pack) {
  return {
    ...pack,
    datasheets: pack.datasheets.map(slimDatasheet),
    _slim: true,
  };
}

async function main() {
  const factionsDir = join(PATHS.packsDir, 'wahapedia', 'factions');
  const files = (await readdir(factionsDir)).filter((name) => name.endsWith('.json'));
  let slimmed = 0;

  for (const file of files) {
    const filePath = join(factionsDir, file);
    const { size } = await stat(filePath);
    if (size < SIZE_THRESHOLD_BYTES) continue;

    const pack = JSON.parse(await readFile(filePath, 'utf8'));
    const slim = slimPack(pack);
    const output = `${JSON.stringify(slim)}\n`;
    await writeFile(filePath, output);

    const saved = ((size - Buffer.byteLength(output)) / size) * 100;
    console.log(`Slimmed ${file}: ${(size / 1024 / 1024).toFixed(1)}MB → ${(Buffer.byteLength(output) / 1024).toFixed(0)}KB (${saved.toFixed(0)}% smaller)`);
    slimmed++;
  }

  if (slimmed === 0) {
    console.log('No faction packs exceeded size threshold.');
  }
}

main().catch((error) => {
  console.error('slim-large-packs failed:', error);
  process.exit(1);
});
