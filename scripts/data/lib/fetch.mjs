import { createHash } from 'node:crypto';

/**
 * @param {string} text
 */
export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Wahapedia Last_update.csv is pipe-delimited; first row is a header line.
 * @param {string} csv
 * @returns {string | null}
 */
export function parseWahapediaLastUpdate(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;

  const dataLine = lines[1];
  const value = dataLine.split('|')[0]?.trim();
  return value || null;
}

/**
 * Minimal YAML field extractor for MFM meta (version + lastUpdated).
 * @deprecated Use parseMfmVersion from mfm-parse.mjs against the official site.
 * @param {string} yaml
 * @returns {{ version: string | null, lastUpdated: string | null }}
 */
export function parseMfmMeta(yaml) {
  const version = yaml.match(/^version:\s*"?([^"\n]+)"?/m)?.[1]?.trim() ?? null;
  const lastUpdated = yaml.match(/^lastUpdated:\s*([^\n]+)/m)?.[1]?.trim() ?? null;
  return { version, lastUpdated };
}

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 */
export async function fetchText(url, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WahaPWABuilder-data-ci/0.1' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
