import { load } from 'cheerio';

const VERSION_RE = /v(\d+\.\d+)/;
const ORDINAL_RE = /(\d+)(?:st|nd|rd|th)/gi;
const UNIQUE_RE = /^\s*unique:\s*/i;
const TRAILING_POINTS_RE = /([\d,]+)\s*pts\s*$/i;
const PLAIN_SIZE_RE = /^\d+ models?$/i;
const PARENT_TITLE_SELECTOR = 'h3.font-header:not([class*="break-after"])';

function clean(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function titleCase(text) {
  return clean(text)
    .toLowerCase()
    .replace(/(^|[\s'’(-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

function leadingInt(text) {
  const match = text.match(/-?\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function parseRange(label) {
  const ordinals = [...label.matchAll(ORDINAL_RE)].map((m) => Number.parseInt(m[1], 10));
  if (ordinals.length === 0) return '[1,)';
  const from = ordinals[0];
  if (/\bto\b/i.test(label) && ordinals.length >= 2) return `[${from},${ordinals[1]}]`;
  if (label.includes('+')) return `[${from},)`;
  return `[${from},${from}]`;
}

function parseCostRow(unitName, text) {
  const match = text.match(TRAILING_POINTS_RE);
  const size = match ? clean(text.slice(0, match.index)) : '';
  if (!match || !size) {
    throw new Error(`Unit "${unitName}": unreadable cost row "${text}"`);
  }

  const points = Number.parseInt(match[1].replace(/,/g, ''), 10);
  const models = (size.match(/\d+/g) ?? []).reduce((sum, n) => sum + Number.parseInt(n, 10), 0);

  if (size.startsWith('+')) {
    const item = clean(size.replace(/^\+\s*\d*\s*/, ''));
    return item ? { models, points, desc: item, addon: true } : { models, points, addon: true };
  }

  return PLAIN_SIZE_RE.test(size) ? { models, points } : { models, points, desc: size };
}

function parseRole(card) {
  const imgs = card.find('img[src$="leader.svg"], img[src$="support.svg"]');
  if (imgs.length === 0) return {};
  if (imgs.length > 1) throw new Error('Unexpected multiple role blocks on one unit');

  const img = imgs.first();
  const role = (img.attr('src') ?? '').includes('leader') ? 'leader' : 'support';
  const attachTo = clean(img.parent().nextAll('span').first().text())
    .split(',')
    .map((part) => titleCase(part))
    .filter(Boolean);

  return attachTo.length > 0 ? { role, attachTo } : {};
}

function parseWargear($, card) {
  const cog = card.find('img[src$="cog.svg"]').first();
  if (cog.length === 0) return [];

  return cog
    .parent()
    .parent()
    .find('ul li')
    .map((_i, li) => {
      const spans = $(li).find('span');
      const item = clean(spans.first().text()).replace(/^per\s+/i, '');
      const points = leadingInt(clean(spans.last().text()));
      return item && points !== null ? { item, points } : null;
    })
    .get()
    .filter(Boolean);
}

function parseVersion($) {
  const match = $('body').text().match(VERSION_RE);
  if (!match) throw new Error('Could not find MFM version stamp (vX.Y) on the page');
  return match[1];
}

/** Replay React Suspense template completions from hidden S: blocks. */
function hydrate($) {
  const completions = new Map();
  $('div[hidden][id^="S:"]').each((_i, el) => {
    completions.set(($(el).attr('id') ?? '').slice(2), $(el));
  });

  let changed = true;
  for (let guard = 0; changed && guard < 100; guard++) {
    changed = false;
    $('template[id]').each((_i, el) => {
      const suffix = ($(el).attr('id') ?? '').split(':')[1];
      const src = suffix ? completions.get(suffix) : undefined;
      if (src) {
        $(el).replaceWith(src.html() ?? '');
        changed = true;
      }
    });
  }

  $('div[hidden][id^="S:"]').remove();
}

function parseUnit($, nameDiv) {
  const name = titleCase(nameDiv.text());
  const card = nameDiv.parent();
  const pricing = [];

  card.find('div.bg-slate-200').each((_i, labelEl) => {
    const label = titleCase($(labelEl).text());
    const costs = $(labelEl)
      .nextAll('ul.leaders')
      .first()
      .find('li')
      .map((_j, li) => parseCostRow(name, clean($(li).text())))
      .get();

    if (costs.length > 0) {
      pricing.push({ range: parseRange(label), label, costs });
    }
  });

  if (pricing.length === 0) throw new Error(`Unit "${name}" has no pricing tiers`);

  const wargear = parseWargear($, card);
  return {
    name,
    pricing,
    ...parseRole(card),
    ...(wargear.length > 0 ? { wargear } : {}),
  };
}

function parseDetachment($, nameSpan) {
  const name = titleCase(nameSpan.text());
  const header = nameSpan.parent();
  const card = header.parent();
  const dp = leadingInt(clean(header.find('span').last().text()));
  const objective = clean(card.children('div[style]').first().text()) || null;
  const unique = titleCase(
    clean(card.children('div.bg-slate-200').first().text()).replace(UNIQUE_RE, ''),
  );

  const enhancements = card
    .find('ul.leaders li')
    .map((_i, li) => {
      const spans = $(li).find('div').last().find('span');
      const enhName = clean(spans.first().text());
      const points = leadingInt(clean(spans.last().text()));
      if (!enhName || points === null) return null;

      const leaderTo = clean(
        $(li)
          .parent()
          .find('span')
          .filter((_j, span) => clean($(span).text()) === 'LEADER:')
          .first()
          .nextAll('span')
          .first()
          .text(),
      )
        .split(',')
        .map((part) => titleCase(part))
        .filter(Boolean);

      return { name: enhName, points, ...(leaderTo.length > 0 ? { leaderTo } : {}) };
    })
    .get()
    .filter(Boolean);

  return {
    name,
    dp,
    objective,
    ...(unique ? { unique } : {}),
    enhancements,
  };
}

export function parseMfmIndex(html) {
  const $ = load(html);
  const version = parseVersion($);
  const seen = new Map();

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/^\/en\/([a-z0-9-]+)$/);
    if (!match) return;
    const slug = match[1];
    const text = clean($(el).text());
    if (text && !seen.has(slug)) seen.set(slug, text);
  });

  if (seen.size === 0) throw new Error('No faction links found on the MFM index page');

  return {
    version,
    factions: [...seen.entries()].map(([slug, name]) => ({ slug, name })),
  };
}

export function parseMfmFaction(html, slug, name, knownFactions = new Set()) {
  const $ = load(html);
  const version = parseVersion($);
  hydrate($);

  const unitGroups = [];
  const groupTitles = [];
  let currentGroup;

  $('h3.font-header, div.bg-slate-500.text-xl').each((_i, el) => {
    if (el.tagName === 'h3') {
      const isSection = ($(el).attr('class') ?? '').includes('break-after');
      currentGroup = isSection ? undefined : titleCase($(el).text());
      if (currentGroup) groupTitles.push(currentGroup);
    } else {
      unitGroups.push(currentGroup);
    }
  });

  const units = $('div.bg-slate-500.text-xl')
    .map((i, el) => {
      const unit = parseUnit($, $(el));
      const group = unitGroups[i];
      return group ? { ...unit, groupTitle: group } : unit;
    })
    .get();

  if (units.length === 0) {
    throw new Error(`No units found for "${slug}" — page structure may have changed`);
  }

  const detachments = $('span.text-xl.break-all')
    .map((_i, el) => parseDetachment($, $(el)))
    .get();

  const parent = groupTitles.find(
    (title) => title.toLowerCase() !== name.toLowerCase() && knownFactions.has(title.toLowerCase()),
  );

  return {
    slug,
    name,
    version,
    ...(parent ? { parent } : {}),
    detachments,
    units,
  };
}

export function parseMfmVersion(html) {
  return parseVersion(load(html));
}
