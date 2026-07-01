import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SOURCES, PATHS } from './config.mjs';
import { fetchText, sha256 } from './fetch.mjs';
import { WAHAPEDIA_CSV_FILES, csvFileKey } from './wahapedia-files.mjs';
import { parseWahapediaCsv } from './wahapedia-csv.mjs';

const CSV_DIR = join(PATHS.rawDir, 'wahapedia', 'csv');
const JSON_DIR = join(PATHS.rawDir, 'wahapedia', 'json');
const FETCH_CONCURRENCY = 4;

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} worker
 */
async function forEachConcurrent(items, concurrency, worker) {
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index++;
      await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

/**
 * @returns {Promise<{ files: Record<string, { hash: string, rowCount: number }>, lastUpdate: string | null }>}
 */
export async function fetchWahapediaCsv() {
  await mkdir(CSV_DIR, { recursive: true });
  await mkdir(JSON_DIR, { recursive: true });

  const baseUrl = SOURCES.wahapedia.baseUrl;
  /** @type {Record<string, { hash: string, rowCount: number }>} */
  const files = {};
  let lastUpdate = null;

  await forEachConcurrent(WAHAPEDIA_CSV_FILES, FETCH_CONCURRENCY, async (fileName) => {
    const url = `${baseUrl}${fileName}`;
    const csv = await fetchText(url);
    const hash = sha256(csv);
    const key = csvFileKey(fileName);

    await writeFile(join(CSV_DIR, key), csv);

    const rows = parseWahapediaCsv(csv);
    await writeFile(join(JSON_DIR, `${key}.json`), `${JSON.stringify(rows)}\n`);

    files[key] = { hash, rowCount: rows.length };

    if (fileName === 'Last_update.csv' && rows[0]?.lastUpdate) {
      lastUpdate = rows[0].lastUpdate;
    }

    console.log(`  fetched ${fileName} (${rows.length} rows)`);
  });

  return { files, lastUpdate };
}
