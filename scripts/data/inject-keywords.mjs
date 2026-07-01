#!/usr/bin/env node
/**
 * Merge Datasheets_keywords into faction pack datasheets (restores keywords on slim packs).
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from './lib/config.mjs';
import { csvFileKey } from './lib/wahapedia-files.mjs';

const KEYWORDS_JSON = join(PATHS.rawDir, 'wahapedia', 'json', `${csvFileKey('Datasheets_keywords.csv')}.json`);
const FACTIONS_DIR = join(PATHS.packsDir, 'wahapedia', 'factions');

async function main() {
  let keywordRows;
  try {
    keywordRows = JSON.parse(await readFile(KEYWORDS_JSON, 'utf8'));
  } catch {
    console.log('Keywords table not found — run data:check / data:build first. Skipping.');
    return;
  }

  /** @type {Map<string, object[]>} */
  const byDatasheet = new Map();
  for (const row of keywordRows) {
    const id = row.datasheetId ?? row.datasheet_id;
    if (!id) continue;
    if (!byDatasheet.has(id)) byDatasheet.set(id, []);
    byDatasheet.get(id).push({
      datasheetId: id,
      keyword: row.keyword,
      model: row.model ?? '',
      isFactionKeyword: row.isFactionKeyword ?? row.is_faction_keyword ?? 'false',
    });
  }

  const files = (await readdir(FACTIONS_DIR)).filter((name) => name.endsWith('.json'));
  let updated = 0;

  for (const file of files) {
    const filePath = join(FACTIONS_DIR, file);
    const pack = JSON.parse(await readFile(filePath, 'utf8'));
    let changed = false;

    pack.datasheets = pack.datasheets.map((datasheet) => {
      const keywords = byDatasheet.get(datasheet.id);
      if (!keywords?.length) return datasheet;
      changed = true;
      return { ...datasheet, keywords };
    });

    if (changed) {
      await writeFile(filePath, `${JSON.stringify(pack)}\n`);
      updated++;
      console.log(`  keywords → ${file}`);
    }
  }

  console.log(updated ? `Injected keywords into ${updated} faction pack(s).` : 'No faction packs updated.');
}

main().catch((error) => {
  console.error('inject-keywords failed:', error);
  process.exit(1);
});
