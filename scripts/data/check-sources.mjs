#!/usr/bin/env node
import { SOURCES } from './lib/config.mjs';
import { fetchText, parseMfmMeta, parseWahapediaLastUpdate, sha256 } from './lib/fetch.mjs';
import { readLock, writeCheckResult } from './lib/lock.mjs';

const force = process.argv.includes('--force');

async function checkWahapedia(lock) {
  const url = `${SOURCES.wahapedia.baseUrl}${SOURCES.wahapedia.lastUpdateFile}`;
  const csv = await fetchText(url);
  const lastUpdate = parseWahapediaLastUpdate(csv);
  const hash = sha256(csv);

  if (!lastUpdate) {
    throw new Error(`Could not parse Wahapedia last update from ${url}`);
  }

  const changed =
    force ||
    lock.wahapedia.lastUpdate !== lastUpdate ||
    lock.wahapedia.edition !== 'wh40k11ed';

  return {
    source: 'wahapedia',
    url,
    lastUpdate,
    hash,
    previous: lock.wahapedia.lastUpdate,
    changed,
  };
}

async function checkMfm(lock) {
  const url = SOURCES.mfm.metaUrl;
  const yaml = await fetchText(url);
  const { version, lastUpdated } = parseMfmMeta(yaml);
  const hash = sha256(yaml);

  if (!version || !lastUpdated) {
    throw new Error(`Could not parse MFM meta from ${url}`);
  }

  const changed =
    force ||
    lock.mfm.version !== version ||
    lock.mfm.lastUpdated !== lastUpdated;

  return {
    source: 'mfm',
    url,
    version,
    lastUpdated,
    hash,
    previous: {
      version: lock.mfm.version,
      lastUpdated: lock.mfm.lastUpdated,
    },
    changed,
  };
}

async function main() {
  const lock = await readLock();
  const checkedAt = new Date().toISOString();

  const [wahapedia, mfm] = await Promise.all([checkWahapedia(lock), checkMfm(lock)]);
  const needsRebuild = wahapedia.changed || mfm.changed;

  const result = {
    checkedAt,
    force,
    needsRebuild,
    sources: { wahapedia, mfm },
  };

  await writeCheckResult(result);

  console.log('Data source check:');
  console.log(`  Wahapedia: ${wahapedia.lastUpdate} (changed: ${wahapedia.changed})`);
  console.log(`  MFM: v${mfm.version} / ${mfm.lastUpdated} (changed: ${mfm.changed})`);
  console.log(`  Needs rebuild: ${needsRebuild}`);

  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `needs_rebuild=${needsRebuild}\n` +
        `wahapedia_changed=${wahapedia.changed}\n` +
        `mfm_changed=${mfm.changed}\n`,
    );
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('check-sources failed:', error);
  process.exit(1);
});
