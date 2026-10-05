/**
 * Map specialty codes → question-pack file name.
 *
 * - ENT is handled inline in flow.js (not here).
 * - general_medicine uses the dedicated GM module (not a JSON pack).
 * - All other non-ENT specialties share primary_care.json cascading questions
 *   until they get their own populated pack.
 */
const PACK_ALIASES = {
  // Explicit primary-care labels
  primarycare: 'primary_care',
  primary: 'primary_care',
  pc: 'primary_care',

  // "Others" → primary_care cascading pack
  gynecology: 'primary_care',
  cardiology: 'primary_care',
  pediatrics: 'primary_care',
  orthopedics: 'primary_care',
  dermatology: 'primary_care',
  ophthalmology: 'primary_care',
  dentistry: 'primary_care',
  psychiatry: 'primary_care',
  urology: 'primary_care',
  gastroenterology: 'primary_care',
  pulmonology: 'primary_care',
  neurology: 'primary_care',
  endocrinology: 'primary_care',
  nephrology: 'primary_care',
  general_surgery: 'primary_care',
  ayurveda: 'primary_care',
  other: 'primary_care',
  generic: 'primary_care',
};

export function packCodeForSpecialty(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  // Never rewrite general_medicine / ent — those are not JSON-pack paths.
  if (!c || c === 'ent' || c === 'general_medicine' || c === 'gm' || c === 'general'
    || c === 'internal_medicine' || c === 'family_medicine') {
    return c || '';
  }
  return PACK_ALIASES[c] || 'primary_care';
}
