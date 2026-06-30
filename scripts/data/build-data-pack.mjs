#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { PATHS } from './lib/config.mjs';
import { readCheckResult, readLock, writeLock } from './lib/lock.mjs';

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

  // Skeleton: persist source fingerprints only. Real CSV/MFM fetch + transform goes here.
  await writeFile(
    `${PATHS.rawDir}/wahapedia.meta.json`,
    `${JSON.stringify({ lastUpdate: wahapedia.lastUpdate, hash: wahapedia.hash, url: wahapedia.url }, null, 2)}\n`,
  );
  await writeFile(
    `${PATHS.rawDir}/mfm.meta.json`,
    `${JSON.stringify({ version: mfm.version, lastUpdated: mfm.lastUpdated, hash: mfm.hash, url: mfm.url }, null, 2)}\n`,
  );

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
        lastUpdate: wahapedia.lastUpdate,
        hash: wahapedia.hash,
      },
      mfm: {
        version: mfm.version,
        lastUpdated: mfm.lastUpdated,
        hash: mfm.hash,
      },
    },
    factions: [],
    status: 'skeleton',
  };

  await writeFile(PATHS.manifest, `${JSON.stringify(manifest, null, 2)}\n`);

  await writeLock({
    packVersion,
    wahapedia: {
      edition: 'wh40k11ed',
      lastUpdate: wahapedia.lastUpdate,
      checkedAt: builtAt,
    },
    mfm: {
      version: mfm.version,
      lastUpdated: mfm.lastUpdated,
      checkedAt: builtAt,
    },
  });

  console.log(`Built data pack skeleton v${packVersion}`);
}

main().catch((error) => {
  console.error('build-data-pack failed:', error);
  process.exit(1);
});
