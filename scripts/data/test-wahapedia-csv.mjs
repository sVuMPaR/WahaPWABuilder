#!/usr/bin/env node
import { parseWahapediaCsv, stripHtml, toCamelCase } from './lib/wahapedia-csv.mjs';

const sample = `id|name|link|
NEC|Necrons|https://example.com|
`;

const rows = parseWahapediaCsv(sample);
if (rows.length !== 1 || rows[0].id !== 'NEC' || rows[0].name !== 'Necrons') {
  console.error('parseWahapediaCsv failed basic parse');
  process.exit(1);
}

const html = stripHtml('<b>Test</b> value');
if (html !== 'Test value') {
  console.error('stripHtml failed');
  process.exit(1);
}

if (toCamelCase('faction_id') !== 'factionId') {
  console.error('toCamelCase failed');
  process.exit(1);
}

console.log('wahapedia-csv tests passed');
