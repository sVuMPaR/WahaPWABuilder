/** @typedef {{ lastUpdate: string | null, checkedAt: string | null, edition?: string }} WahapediaLock */
/** @typedef {{ version: string | null, lastUpdated: string | null, checkedAt: string | null, contentHash?: string | null }} MfmLock */
/** @typedef {{ packVersion: string, wahapedia: WahapediaLock, mfm: MfmLock }} SourcesLock */

/** @type {{ wahapedia: { baseUrl: string, lastUpdateFile: string }, mfm: { baseUrl: string } }} */
export const SOURCES = {
  wahapedia: {
    baseUrl: 'https://wahapedia.ru/wh40k11ed/',
    lastUpdateFile: 'Last_update.csv',
  },
  mfm: {
    baseUrl: 'https://mfm.warhammer-community.com/',
  },
};

export const PATHS = {
  lock: 'data/sources.lock.json',
  checkResult: 'data/.check-result.json',
  rawDir: 'data/.raw',
  packsDir: 'data/packs',
  manifest: 'data/packs/manifest.json',
};
