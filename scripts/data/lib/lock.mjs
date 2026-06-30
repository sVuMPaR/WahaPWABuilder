import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PATHS } from './config.mjs';

/**
 * @returns {Promise<import('./config.mjs').SourcesLock>}
 */
export async function readLock() {
  const raw = await readFile(PATHS.lock, 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {import('./config.mjs').SourcesLock} lock
 */
export async function writeLock(lock) {
  await mkdir('data', { recursive: true });
  await writeFile(PATHS.lock, `${JSON.stringify(lock, null, 2)}\n`);
}

/**
 * @param {Record<string, unknown>} result
 */
export async function writeCheckResult(result) {
  await mkdir('data', { recursive: true });
  await writeFile(PATHS.checkResult, `${JSON.stringify(result, null, 2)}\n`);
}

/**
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function readCheckResult() {
  try {
    const raw = await readFile(PATHS.checkResult, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
