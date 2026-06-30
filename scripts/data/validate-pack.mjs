#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { PATHS } from './lib/config.mjs';

async function main() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(PATHS.manifest, 'utf8'));
  } catch {
    console.log('No manifest found — nothing to validate yet.');
    return;
  }

  const errors = [];

  if (!manifest.packVersion) errors.push('manifest.packVersion is required');
  if (!manifest.builtAt) errors.push('manifest.builtAt is required');
  if (!manifest.sources?.wahapedia?.lastUpdate) errors.push('manifest.sources.wahapedia.lastUpdate is required');
  if (!manifest.sources?.mfm?.version) errors.push('manifest.sources.mfm.version is required');
  if (!manifest.attribution?.wahapedia) errors.push('manifest.attribution.wahapedia is required');

  if (errors.length > 0) {
    console.error('Validation failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(`Validated data pack v${manifest.packVersion}`);
}

main().catch((error) => {
  console.error('validate-pack failed:', error);
  process.exit(1);
});
