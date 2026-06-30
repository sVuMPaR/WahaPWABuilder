import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from './config.mjs';
import { csvFileKey } from './wahapedia-files.mjs';

const JSON_DIR = join(PATHS.rawDir, 'wahapedia', 'json');
const OUT_DIR = join(PATHS.packsDir, 'wahapedia');
const FACTIONS_DIR = join(OUT_DIR, 'factions');

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string | undefined | null} keyFn
 * @param {boolean} [multi]
 */
function indexBy(items, keyFn, multi = false) {
  /** @type {Map<string, any>} */
  const map = new Map();

  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;

    if (multi) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    } else {
      map.set(key, item);
    }
  }

  return map;
}

/**
 * @param {string} key
 */
async function readJsonTable(key) {
  const raw = await readFile(join(JSON_DIR, `${key}.json`), 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {Record<string, any>[]} links
 * @param {Map<string, any>} lookup
 * @param {string} linkKey
 */
function resolveLinks(links, lookup, linkKey) {
  return links
    .map((link) => {
      const target = lookup.get(link[linkKey]);
      return target ? { ...link, ...target } : link;
    })
    .filter(Boolean);
}

export async function buildWahapediaPacks() {
  const tables = {
    factions: await readJsonTable(csvFileKey('Factions.csv')),
    datasheets: await readJsonTable(csvFileKey('Datasheets.csv')),
    models: await readJsonTable(csvFileKey('Datasheets_models.csv')),
    wargear: await readJsonTable(csvFileKey('Datasheets_wargear.csv')),
    options: await readJsonTable(csvFileKey('Datasheets_options.csv')),
    unitComposition: await readJsonTable(csvFileKey('Datasheets_unit_composition.csv')),
    modelCosts: await readJsonTable(csvFileKey('Datasheets_models_cost.csv')),
    datasheetAbilities: await readJsonTable(csvFileKey('Datasheets_abilities.csv')),
    datasheetKeywords: await readJsonTable(csvFileKey('Datasheets_keywords.csv')),
    datasheetStratagems: await readJsonTable(csvFileKey('Datasheets_stratagems.csv')),
    datasheetEnhancements: await readJsonTable(csvFileKey('Datasheets_enhancements.csv')),
    datasheetDetachmentAbilities: await readJsonTable(csvFileKey('Datasheets_detachment_abilities.csv')),
    datasheetLeaders: await readJsonTable(csvFileKey('Datasheets_leader.csv')),
    abilities: await readJsonTable(csvFileKey('Abilities.csv')),
    stratagems: await readJsonTable(csvFileKey('Stratagems.csv')),
    enhancements: await readJsonTable(csvFileKey('Enhancements.csv')),
    detachments: await readJsonTable(csvFileKey('Detachments.csv')),
    detachmentAbilities: await readJsonTable(csvFileKey('Detachment_abilities.csv')),
  };

  await mkdir(FACTIONS_DIR, { recursive: true });

  const abilitiesById = indexBy(tables.abilities, (row) => row.id);
  const stratagemsById = indexBy(tables.stratagems, (row) => row.id);
  const enhancementsById = indexBy(tables.enhancements, (row) => row.id);
  const detachmentAbilitiesById = indexBy(tables.detachmentAbilities, (row) => row.id);

  const modelsByDatasheet = indexBy(tables.models, (row) => row.datasheetId, true);
  const wargearByDatasheet = indexBy(tables.wargear, (row) => row.datasheetId, true);
  const optionsByDatasheet = indexBy(tables.options, (row) => row.datasheetId, true);
  const unitCompositionByDatasheet = indexBy(tables.unitComposition, (row) => row.datasheetId, true);
  const modelCostsByDatasheet = indexBy(tables.modelCosts, (row) => row.datasheetId, true);
  const datasheetAbilitiesByDatasheet = indexBy(tables.datasheetAbilities, (row) => row.datasheetId, true);
  const datasheetKeywordsByDatasheet = indexBy(tables.datasheetKeywords, (row) => row.datasheetId, true);
  const datasheetStratagemsByDatasheet = indexBy(tables.datasheetStratagems, (row) => row.datasheetId, true);
  const datasheetEnhancementsByDatasheet = indexBy(tables.datasheetEnhancements, (row) => row.datasheetId, true);
  const datasheetDetachmentAbilitiesByDatasheet = indexBy(
    tables.datasheetDetachmentAbilities,
    (row) => row.datasheetId,
    true,
  );
  const datasheetLeadersByLeader = indexBy(tables.datasheetLeaders, (row) => row.leaderId, true);

  const datasheetsByFaction = indexBy(tables.datasheets, (row) => row.factionId, true);
  const detachmentsByFaction = indexBy(tables.detachments, (row) => row.factionId, true);
  const enhancementsByFaction = indexBy(tables.enhancements, (row) => row.factionId, true);
  const stratagemsByFaction = indexBy(tables.stratagems, (row) => row.factionId, true);
  const abilitiesByFaction = indexBy(tables.abilities, (row) => row.factionId, true);

  const coreStratagems = tables.stratagems.filter((row) => !row.factionId);

  /** @type {any[]} */
  const index = [];

  for (const faction of tables.factions) {
    const factionDatasheets = datasheetsByFaction.get(faction.id) ?? [];
    if (factionDatasheets.length === 0) continue;

    const enrichedDatasheets = factionDatasheets.map((datasheet) => {
      const abilityLinks = datasheetAbilitiesByDatasheet.get(datasheet.id) ?? [];
      const resolvedAbilities = abilityLinks.map((link) => {
        if (link.abilityId) {
          const ability = abilitiesById.get(link.abilityId);
          return ability ? { ...link, ...ability } : link;
        }
        return link;
      });

      return {
        ...datasheet,
        models: modelsByDatasheet.get(datasheet.id) ?? [],
        wargear: wargearByDatasheet.get(datasheet.id) ?? [],
        options: optionsByDatasheet.get(datasheet.id) ?? [],
        unitComposition: unitCompositionByDatasheet.get(datasheet.id) ?? [],
        modelCosts: modelCostsByDatasheet.get(datasheet.id) ?? [],
        abilities: resolvedAbilities,
        keywords: datasheetKeywordsByDatasheet.get(datasheet.id) ?? [],
        stratagems: resolveLinks(
          datasheetStratagemsByDatasheet.get(datasheet.id) ?? [],
          stratagemsById,
          'stratagemId',
        ),
        enhancements: resolveLinks(
          datasheetEnhancementsByDatasheet.get(datasheet.id) ?? [],
          enhancementsById,
          'enhancementId',
        ),
        detachmentAbilities: resolveLinks(
          datasheetDetachmentAbilitiesByDatasheet.get(datasheet.id) ?? [],
          detachmentAbilitiesById,
          'detachmentAbilityId',
        ),
        leaderAttachments: datasheetLeadersByLeader.get(datasheet.id) ?? [],
      };
    });

    const pack = {
      id: faction.id,
      name: faction.name,
      link: faction.link,
      datasheetCount: enrichedDatasheets.length,
      detachmentCount: (detachmentsByFaction.get(faction.id) ?? []).length,
      datasheets: enrichedDatasheets,
      detachments: detachmentsByFaction.get(faction.id) ?? [],
      enhancements: enhancementsByFaction.get(faction.id) ?? [],
      stratagems: stratagemsByFaction.get(faction.id) ?? [],
      abilities: abilitiesByFaction.get(faction.id) ?? [],
    };

    await writeFile(join(FACTIONS_DIR, `${faction.id}.json`), `${JSON.stringify(pack)}\n`);

    index.push({
      id: faction.id,
      name: faction.name,
      link: faction.link,
      path: `factions/${faction.id}.json`,
      datasheetCount: pack.datasheetCount,
      detachmentCount: pack.detachmentCount,
    });

    console.log(`  built faction ${faction.id} (${pack.datasheetCount} datasheets)`);
  }

  index.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(join(OUT_DIR, 'core-stratagems.json'), `${JSON.stringify(coreStratagems)}\n`);

  return {
    factionCount: index.length,
    datasheetCount: tables.datasheets.length,
    coreStratagemCount: coreStratagems.length,
    factions: index,
  };
}
