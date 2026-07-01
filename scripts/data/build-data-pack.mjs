#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { PATHS } from './lib/config.mjs';
import { readCheckResult, readLock, writeLock } from './lib/lock.mjs';
import { fetchMfmData } from './lib/mfm-fetch.mjs';
import { mergeMfmIntoWahapediaPacks } from './lib/mfm-merge.mjs';
import { buildWahapediaPacks } from './lib/wahapedia-build.mjs';
import { fetchWahapediaCsv } from './lib/wahapedia-fetch.mjs';

function bumpPackVersion(current) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) return '0.1.0';

  const [, major, minor, patch] = match.map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

async function main() {
  const check = await readCheckResult();
  if (!check) {
    throw new Error('Missing check result — run data:check first');
  }

  if (!check.needsRebuild) {
    console.log('No source changes detected; skipping build.');
    return;
  }

  const lock = await readLock();
  const builtAt = new Date().toISOString();
  const packVersion = bumpPackVersion(lock.packVersion);

  const wahapedia = check.sources.wahapedia;
  const mfm = check.sources.mfm;

  await mkdir(PATHS.rawDir, { recursive: true });
  await mkdir(PATHS.packsDir, { recursive: true });

  console.log('Fetching Wahapedia CSV exports...');
  const wahapediaFetch = await fetchWahapediaCsv();

  console.log('Building Wahapedia faction packs...');
  const wahapediaPacks = await buildWahapediaPacks();

  console.log('Fetching and parsing MFM from official site...');
  const mfmMeta = await fetchMfmData();

  const wahapediaIndex = JSON.parse(
    await readFile(`${PATHS.packsDir}/wahapedia/index.json`, 'utf8'),
  );

  console.log('Merging MFM points into Wahapedia packs...');
  const mergeStats = await mergeMfmIntoWahapediaPacks(wahapediaIndex, mfmMeta);

  console.log('Slimming oversized faction packs...');
  const { spawnSync } = await import('node:child_process');
  spawnSync(process.execPath, ['scripts/data/slim-large-packs.mjs'], { stdio: 'inherit' });

  const manifest = {
    packVersion,
    builtAt,
    attribution: {
      wahapedia: 'https://wahapedia.ru/',
      mfm: 'https://mfm.warhammer-community.com/',
    },
    sources: {
      wahapedia: {
        edition: 'wh40k11ed',
        lastUpdate: wahapediaFetch.lastUpdate ?? wahapedia.lastUpdate,
        hash: wahapedia.hash,
        files: wahapediaFetch.files,
      },
      mfm: {
        version: mfmMeta.version,
        contentHash: mfmMeta.contentHash,
        hash: mfm.hash,
        factionCount: mfmMeta.factionCount,
        status: 'merged',
      },
    },
    wahapedia: {
      factionCount: wahapediaPacks.factionCount,
      datasheetCount: wahapediaPacks.datasheetCount,
      coreStratagemCount: wahapediaPacks.coreStratagemCount,
      indexPath: 'wahapedia/index.json',
      factions: wahapediaPacks.factions,
    },
    mfm: {
      indexPath: 'mfm/index.json',
      merge: mergeStats,
    },
    status: 'merged',
  };

  await writeFile(PATHS.manifest, `${JSON.stringify(manifest, null, 2)}\n`);

  await writeLock({
    packVersion,
    wahapedia: {
      edition: 'wh40k11ed',
      lastUpdate: wahapediaFetch.lastUpdate ?? wahapedia.lastUpdate,
      checkedAt: builtAt,
    },
    mfm: {
      version: mfmMeta.version,
      lastUpdated: builtAt.slice(0, 10),
      contentHash: mfmMeta.contentHash,
      hash: mfm.hash,
      checkedAt: builtAt,
    },
  });

  console.log(
    `Built data pack v${packVersion} (${wahapediaPacks.factionCount} factions, ` +
      `${mergeStats.totalMatched} units with MFM points)`,
  );
}

main().catch((error) => {
  console.error('build-data-pack failed:', error);
  process.exit(1);
});
