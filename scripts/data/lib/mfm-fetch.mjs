import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SOURCES, PATHS } from './config.mjs';
import { fetchText, sha256 } from './fetch.mjs';
import { parseMfmFaction, parseMfmIndex } from './mfm-parse.mjs';

const RAW_DIR = join(PATHS.rawDir, 'mfm');
const HTML_DIR = join(RAW_DIR, 'html');
const JSON_DIR = join(PATHS.packsDir, 'mfm', 'factions');
const FETCH_CONCURRENCY = 3;

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

export async function fetchMfmData({ factionSlug } = {}) {
  const baseUrl = SOURCES.mfm.baseUrl;
  const indexUrl = `${baseUrl}en`;
  const indexHtml = await fetchText(indexUrl);
  const index = parseMfmIndex(indexHtml);

  await mkdir(HTML_DIR, { recursive: true });
  await mkdir(JSON_DIR, { recursive: true });
  await writeFile(join(RAW_DIR, 'index.html'), indexHtml);

  const targets = factionSlug
    ? index.factions.filter((faction) => faction.slug === factionSlug)
    : index.factions;

  if (targets.length === 0) {
    throw new Error(`Unknown MFM faction slug: ${factionSlug}`);
  }

  const knownFactions = new Set(index.factions.map((faction) => faction.name.toLowerCase()));
  const factions = [];
  const hashes = [];

  await forEachConcurrent(targets, FETCH_CONCURRENCY, async (faction) => {
    const url = `${baseUrl}en/${faction.slug}`;
    const html = await fetchText(url);
    const hash = sha256(html);
    hashes.push(`${faction.slug}:${hash}`);

    await writeFile(join(HTML_DIR, `${faction.slug}.html`), html);

    const parsed = parseMfmFaction(html, faction.slug, faction.name, knownFactions);
    await writeFile(join(JSON_DIR, `${faction.slug}.json`), `${JSON.stringify(parsed)}\n`);

    factions.push({
      slug: faction.slug,
      name: faction.name,
      unitCount: parsed.units.length,
      detachmentCount: parsed.detachments.length,
      hash,
    });

    console.log(`  fetched MFM ${faction.slug} (${parsed.units.length} units)`);
  });

  hashes.sort();
  const contentHash = sha256(hashes.join('\n'));

  const meta = {
    version: index.version,
    factionCount: factions.length,
    contentHash,
    factions,
  };

  await writeFile(join(RAW_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(join(PATHS.packsDir, 'mfm', 'index.json'), `${JSON.stringify(meta, null, 2)}\n`);

  return meta;
}
