import { cp } from 'node:fs/promises';

await cp('data/packs', 'dist/data', { recursive: true });
console.log('Copied data/packs → dist/data');
