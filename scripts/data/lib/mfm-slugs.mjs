/**
 * Wahapedia link slug → MFM faction slug.
 * Needed when Wahapedia URL paths do not match MFM paths.
 */
export const MFM_SLUG_ALIASES = {
  't-au-empire': 'tau-empire',
  'emperor-s-children': 'emperors-children',
  'adeptus-titanicus': 'titan-legions',
};

/**
 * @param {string | undefined | null} link
 */
export function slugFromWahapediaLink(link) {
  if (!link) return null;
  const match = link.match(/factions\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * @param {string | null | undefined} wahapediaSlug
 */
export function resolveMfmSlug(wahapediaSlug) {
  if (!wahapediaSlug) return null;
  return MFM_SLUG_ALIASES[wahapediaSlug] ?? wahapediaSlug;
}
