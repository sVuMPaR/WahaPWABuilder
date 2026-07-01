/** CSV exports available for Warhammer 40k 11th edition on Wahapedia. */
export const WAHAPEDIA_CSV_FILES = [
  'Factions.csv',
  'Source.csv',
  'Datasheets.csv',
  'Datasheets_abilities.csv',
  'Datasheets_keywords.csv',
  'Datasheets_models.csv',
  'Datasheets_options.csv',
  'Datasheets_wargear.csv',
  'Datasheets_unit_composition.csv',
  'Datasheets_models_cost.csv',
  'Datasheets_stratagems.csv',
  'Datasheets_enhancements.csv',
  'Datasheets_detachment_abilities.csv',
  'Datasheets_leader.csv',
  'Stratagems.csv',
  'Abilities.csv',
  'Enhancements.csv',
  'Detachments.csv',
  'Detachment_abilities.csv',
  'Last_update.csv',
];

/**
 * @param {string} fileName
 */
export function csvFileKey(fileName) {
  return fileName.replace(/\.csv$/i, '').toLowerCase().replace(/_/g, '-');
}
