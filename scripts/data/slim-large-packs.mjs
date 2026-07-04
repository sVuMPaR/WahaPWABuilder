#!/usr/bin/env node
/**
 * Strip heavy datasheet fields from oversized faction packs (e.g. Space Marines ~53MB).
 * Keeps roster-builder + unit detail fields (stats, wargear, abilities).
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
  'loadout',
  'keywords',
  'models',
  'wargear',
  'options',
  'abilities',
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

function slimModel(model) {
  return {
    name: model.name,
    m: model.m,
    t: model.t,
    sv: model.sv,
    invSv: model.invSv,
    invSvDescr: model.invSvDescr,
    w: model.w,
    ld: model.ld,
    oc: model.oc,
    baseSize: model.baseSize,
    baseSizeDescr: model.baseSizeDescr,
  };
}

function slimWeapon(weapon) {
  return {
    name: weapon.name,
    range: weapon.range,
    type: weapon.type,
    a: weapon.a,
    bsWs: weapon.bsWs,
    s: weapon.s,
    ap: weapon.ap,
    d: weapon.d,
    description: weapon.description,
  };
}

function slimAbility(ability) {
  return {
    name: ability.name,
    description: ability.description,
    type: ability.type,
  };
}

function slimOption(option) {
  return {
    button: option.button,
    description: option.description,
  };
}

function slimDatasheet(datasheet) {
  const slim = {};
  for (const key of DATASHEET_KEYS) {
    if (datasheet[key] === undefined) continue;
    if (key === 'enhancements') {
      slim.enhancements = datasheet.enhancements.map(slimEnhancement);
    } else if (key === 'models') {
      slim.models = datasheet.models.map(slimModel);
    } else if (key === 'wargear') {
      slim.wargear = datasheet.wargear.map(slimWeapon);
    } else if (key === 'abilities') {
      slim.abilities = datasheet.abilities.map(slimAbility);
    } else if (key === 'options') {
      slim.options = datasheet.options.map(slimOption);
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
    console.log(`Slimmed ${file}: ${(size / 1024 / 1024).toFixed(1)}MB → ${(Buffer.byteLength(output) / 1024 / 1024).toFixed(2)}MB (${saved.toFixed(0)}% smaller)`);
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
