/** Map clinical specialty codes onto the cascading pack file to load. */
const PACK_ALIASES = {
  general_medicine: 'primary_care',
  gm: 'primary_care',
  general: 'primary_care',
  internal_medicine: 'primary_care',
  family_medicine: 'primary_care',
  primarycare: 'primary_care',
  primary: 'primary_care',
  pc: 'primary_care',
};

export function packCodeForSpecialty(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  return PACK_ALIASES[c] || c;
}
