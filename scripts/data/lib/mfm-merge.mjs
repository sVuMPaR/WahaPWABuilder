import { resolveMfmSlug, slugFromWahapediaLink } from './mfm-slugs.mjs';

/**
 * Normalize unit/detachment names for cross-source matching.
 * @param {string} name
 */
export function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @param {Record<string, any>} mfmFaction
 */
function indexMfmEnhancements(mfmFaction) {
  /** @type {Map<string, any>} */
  const map = new Map();
  for (const detachment of mfmFaction.detachments ?? []) {
    for (const enhancement of detachment.enhancements ?? []) {
      if (enhancement?.name) map.set(normalizeName(enhancement.name), enhancement);
    }
  }
  for (const enhancement of mfmFaction.enhancements ?? []) {
    if (enhancement?.name) map.set(normalizeName(enhancement.name), enhancement);
  }
  return map;
}

/**
 * @param {Record<string, any>} mfmFaction
 */
function indexMfmUnits(mfmFaction) {
  /** @type {Map<string, any>} */
  const byName = new Map();
  for (const unit of mfmFaction.units ?? []) {
    byName.set(normalizeName(unit.name), unit);
  }
  return byName;
}

/**
 * @param {any[]} items
 */
function indexByName(items) {
  /** @type {Map<string, any>} */
  const map = new Map();
  for (const item of items ?? []) {
    if (item?.name) map.set(normalizeName(item.name), item);
  }
  return map;
}

/**
 * @param {Record<string, any>} wahapediaFaction
 * @param {Record<string, any>} mfmFaction
 */
export function mergeMfmIntoFaction(wahapediaFaction, mfmFaction) {
  const mfmUnits = indexMfmUnits(mfmFaction);
  const mfmDetachments = indexByName(mfmFaction.detachments);
  const mfmEnhancements = indexMfmEnhancements(mfmFaction);

  let matchedUnits = 0;
  let unmatchedUnits = 0;

  const datasheets = (wahapediaFaction.datasheets ?? []).map((datasheet) => {
    const mfmUnit = mfmUnits.get(normalizeName(datasheet.name));
    if (!mfmUnit) {
      unmatchedUnits++;
      return datasheet;
    }

    matchedUnits++;
    return {
      ...datasheet,
      points: {
        source: 'mfm',
        version: mfmFaction.version,
        pricing: mfmUnit.pricing,
        ...(mfmUnit.role ? { role: mfmUnit.role } : {}),
        ...(mfmUnit.attachTo ? { attachTo: mfmUnit.attachTo } : {}),
        ...(mfmUnit.wargear ? { wargear: mfmUnit.wargear } : {}),
        ...(mfmUnit.legends ? { legends: true } : {}),
        ...(mfmUnit.groupTitle ? { groupTitle: mfmUnit.groupTitle } : {}),
      },
    };
  });

  const detachments = (wahapediaFaction.detachments ?? []).map((detachment) => {
    const mfmDetachment = mfmDetachments.get(normalizeName(detachment.name));
    if (!mfmDetachment) return detachment;

    const enhancementPoints = indexByName(mfmDetachment.enhancements);
    return {
      ...detachment,
      points: {
        dp: mfmDetachment.dp,
        objective: mfmDetachment.objective,
        unique: mfmDetachment.unique ?? null,
      },
      enhancements: (detachment.enhancements ?? []).map((enhancement) => {
        const mfmEnhancement = enhancementPoints.get(normalizeName(enhancement.name));
        return mfmEnhancement
          ? {
              ...enhancement,
              points: {
                cost: mfmEnhancement.points,
                ...(mfmEnhancement.leaderTo ? { leaderTo: mfmEnhancement.leaderTo } : {}),
              },
            }
          : enhancement;
      }),
    };
  });

  const enhancements = (wahapediaFaction.enhancements ?? []).map((enhancement) => {
    const mfmEnhancement = mfmEnhancements.get(normalizeName(enhancement.name));
    return mfmEnhancement
      ? {
          ...enhancement,
          points: {
            cost: mfmEnhancement.points,
            ...(mfmEnhancement.leaderTo ? { leaderTo: mfmEnhancement.leaderTo } : {}),
          },
        }
      : enhancement;
  });

  return {
    faction: {
      ...wahapediaFaction,
      datasheets,
      detachments,
      enhancements,
      mfm: {
        slug: mfmFaction.slug,
        version: mfmFaction.version,
        matchedUnits,
        unmatchedUnits,
        unitCount: mfmFaction.units?.length ?? 0,
      },
    },
    matchedUnits,
    unmatchedUnits,
  };
}

/**
 * @param {Array<{ id: string, link?: string, path: string }>} wahapediaIndex
 */
export async function mergeMfmIntoWahapediaPacks(wahapediaIndex, mfmMeta) {
  const { readFile, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { PATHS } = await import('./config.mjs');

  let totalMatched = 0;
  let totalUnmatched = 0;
  let factionsWithMfm = 0;
  const summary = [];

  for (const entry of wahapediaIndex) {
    const wahapediaSlug = slugFromWahapediaLink(entry.link);
    const slug = resolveMfmSlug(wahapediaSlug);
    if (!slug) continue;

    const mfmPath = join(PATHS.packsDir, 'mfm', 'factions', `${slug}.json`);
    let mfmFaction;
    try {
      mfmFaction = JSON.parse(await readFile(mfmPath, 'utf8'));
    } catch {
      continue;
    }

    const wahapediaPath = join(PATHS.packsDir, 'wahapedia', entry.path);
    const wahapediaFaction = JSON.parse(await readFile(wahapediaPath, 'utf8'));
    const { faction, matchedUnits, unmatchedUnits } = mergeMfmIntoFaction(
      wahapediaFaction,
      mfmFaction,
    );

    await writeFile(wahapediaPath, `${JSON.stringify(faction)}\n`);

    totalMatched += matchedUnits;
    totalUnmatched += unmatchedUnits;
    factionsWithMfm++;
    summary.push({
      id: entry.id,
      slug,
      matchedUnits,
      unmatchedUnits,
    });

    console.log(`  merged MFM → ${entry.id} (${matchedUnits}/${wahapediaFaction.datasheetCount} units)`);
  }

  return {
    version: mfmMeta.version,
    contentHash: mfmMeta.contentHash,
    factionsWithMfm,
    totalMatched,
    totalUnmatched,
    summary,
  };
}
