/** One authored-name collation for search and custom definition reuse. Catalog
 * UUIDs remain identity; this never remaps a built-in movement by its name.
 * @param {unknown} value */
export const foldExerciseName=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
