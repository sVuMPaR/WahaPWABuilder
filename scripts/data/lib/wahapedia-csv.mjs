/**
 * @param {string} header
 */
export function toCamelCase(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

/**
 * @param {string} html
 */
export function stripHtml(html) {
  if (!html) return '';

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse Wahapedia pipe-delimited CSV into an array of row objects.
 * @param {string} input
 */
export function parseWahapediaCsv(input) {
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split('|').slice(0, -1).map(toCamelCase);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split('|').slice(0, -1);
    if (columns.every((value) => value === '')) continue;

    /** @type {Record<string, string>} */
    const row = {};
    for (let col = 0; col < headers.length; col++) {
      row[headers[col]] = stripHtml(columns[col] ?? '');
    }
    rows.push(row);
  }

  return rows;
}
