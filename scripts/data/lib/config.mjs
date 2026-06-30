/** @typedef {{ lastUpdate: string | null, checkedAt: string | null, edition?: string }} WahapediaLock */
/** @typedef {{ version: string | null, lastUpdated: string | null, checkedAt: string | null }} MfmLock */
/** @typedef {{ packVersion: string, wahapedia: WahapediaLock, mfm: MfmLock }} SourcesLock */

/** @type {{ wahapedia: { baseUrl: string, lastUpdateFile: string }, mfm: { metaUrl: string } }} */
export const SOURCES = {
  wahapedia: {
    baseUrl: 'https://wahapedia.ru/wh40k11ed/',
    lastUpdateFile: 'Last_update.csv',
  },
  mfm: {
    // Version canary only — data is fetched/parsed by our own build step, not copied from this repo.
    metaUrl: 'https://raw.githubusercontent.com/BSData/wh40k-11e-mfm/main/data/meta.yaml',
  },
};

export const PATHS = {
  lock: 'data/sources.lock.json',
  checkResult: 'data/.check-result.json',
  rawDir: 'data/.raw',
  packsDir: 'data/packs',
  manifest: 'data/packs/manifest.json',
};
