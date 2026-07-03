import { mkdir, cp } from 'node:fs/promises';

/** Stage small catalog files into public/ so Workbox can precache them for offline. */
await mkdir('public/data/wahapedia', { recursive: true });
await cp('data/packs/manifest.json', 'public/data/manifest.json');
await cp('data/packs/wahapedia/index.json', 'public/data/wahapedia/index.json');
console.log('Staged manifest + faction index for PWA precache');
