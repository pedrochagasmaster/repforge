/** Accent- and case-insensitive authored-name search; never a storage trust check.
 * @param {unknown} value */
export const foldSearch=value=>String(value??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
