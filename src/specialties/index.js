// Central registry.
// ENT is NOT registered — handled by flow.js (ear path).
// general_medicine → dedicated GM question module (already complete).
// All other non-ENT specialties → primary_care.json cascading pack.

import generalMedicine from './general_medicine/index.js';
import generic from './generic/index.js';
import { packCodeForSpecialty } from './packCodes.js';

export { packCodeForSpecialty } from './packCodes.js';

const USERNAME_PREFIXES = {
  genmed: 'general_medicine',
  gm:     'general_medicine',
  primarycare: 'primary_care',
  primary: 'primary_care',
  pc: 'primary_care',
  gyno:   'gynecology',
  gyn:    'gynecology',
  obg:    'gynecology',
  card:   'cardiology',
  cardio: 'cardiology',
  peds:   'pediatrics',
  paed:   'pediatrics',
  pedia:  'pediatrics',
  ortho:  'orthopedics',
  derm:   'dermatology',
  derma:  'dermatology',
  ophth:  'ophthalmology',
  eye:    'ophthalmology',
  dent:   'dentistry',
  psych:  'psychiatry',
  uro:    'urology',
  gastro: 'gastroenterology',
  gi:     'gastroenterology',
  pulm:   'pulmonology',
  pulmo:  'pulmonology',
  chest:  'pulmonology',
  neuro:  'neurology',
  endo:   'endocrinology',
  nephro: 'nephrology',
  surg:   'general_surgery',
  ayur:   'ayurveda',
};

/** Non-ENT, non-GM codes that use the primary_care cascading JSON pack. */
export const PRIMARY_CARE_PACK_CODES = new Set([
  'primary_care',
  'gynecology', 'cardiology', 'pediatrics', 'orthopedics', 'dermatology',
  'ophthalmology', 'dentistry', 'psychiatry', 'urology', 'gastroenterology',
  'pulmonology', 'neurology', 'endocrinology', 'nephrology', 'general_surgery',
  'ayurveda', 'other', 'generic',
]);

// Back-compat export name used elsewhere.
export const GENERIC_SPECIALTY_CODES = PRIMARY_CARE_PACK_CODES;

const REGISTRY = {};
for (const mod of [generalMedicine, generic]) {
  if (!mod || !mod.code) continue;
  REGISTRY[mod.code] = mod;
  for (const alias of mod.aliases || []) {
    // Do not let generic aliases override the dedicated GM module.
    if (alias === 'general_medicine' || alias === 'gm' || alias === 'general'
      || alias === 'internal_medicine' || alias === 'family_medicine') continue;
    REGISTRY[alias] = mod;
  }
}
// Ensure GM is registered under its aliases.
REGISTRY.general_medicine = generalMedicine;
REGISTRY.gm = generalMedicine;
REGISTRY.general = generalMedicine;
REGISTRY.internal_medicine = generalMedicine;
REGISTRY.family_medicine = generalMedicine;

export function specialtyFromUsername(username) {
  const raw = String(username || '').toLowerCase().trim();
  if (!raw) return null;
  const u = raw.replace(/[_-]/g, '');

  const m1 = u.match(/^([a-z]+?)(staff|doctor|admin)\d*$/);
  if (m1) {
    const code = USERNAME_PREFIXES[m1[1]];
    if (code) return code;
  }

  const m2 = u.match(/^(staff|doctor|admin)([a-z]+?)\d*$/);
  if (m2) {
    const code = USERNAME_PREFIXES[m2[2]];
    if (code) return code;
  }

  return null;
}

export function resolveSpecialty({ specialty, username, clinicDefault } = {}) {
  const s = String(specialty || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (s === 'ent') return 'ent';
  if (s === 'general_medicine' || s === 'gm' || s === 'general' || s === 'internal_medicine' || s === 'family_medicine') {
    return 'general_medicine';
  }
  if (s === 'primary_care' || s === 'primarycare' || s === 'primary' || s === 'pc') {
    return 'primary_care';
  }
  if (s && (PRIMARY_CARE_PACK_CODES.has(s) || REGISTRY[s])) return s;

  const fromUser = specialtyFromUsername(username);
  if (fromUser) return fromUser;

  const cd = String(clinicDefault || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (cd === 'ent') return 'ent';
  if (cd === 'general_medicine' || cd === 'gm' || cd === 'general') return 'general_medicine';
  if (cd === 'primary_care' || cd === 'primarycare') return 'primary_care';
  if (cd && (PRIMARY_CARE_PACK_CODES.has(cd) || REGISTRY[cd])) return cd;

  return 'general_medicine';
}

function primaryCareModule(code) {
  const c = String(code || 'primary_care').toLowerCase().trim().replace(/\s+/g, '_');
  return {
    ...generic,
    code: c,
    label: c === 'primary_care' ? 'Primary Care' : c,
    packCode: 'primary_care',
  };
}

export function getSpecialtyModule(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');

  // ENT → null (server continues with protected inline ear flow).
  if (!c || c === 'ent') return null;

  // General medicine → dedicated GM module (already complete).
  if (
    c === 'general_medicine' ||
    c === 'gm' ||
    c === 'general' ||
    c === 'internal_medicine' ||
    c === 'family_medicine'
  ) {
    return REGISTRY.general_medicine || generalMedicine;
  }

  // Everyone else (primary_care, cardiology, gyno, other, unknown, …)
  // → primary_care.json cascading questions.
  if (PRIMARY_CARE_PACK_CODES.has(c) || REGISTRY[c]) {
    return primaryCareModule(c);
  }

  return primaryCareModule(c || 'other');
}

export function isRegistered(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (c === 'ent') return true;
  if (c === 'general_medicine' || c === 'gm' || c === 'general') return true;
  if (c === 'primary_care') return true;
  return PRIMARY_CARE_PACK_CODES.has(c) || Boolean(REGISTRY[c]);
}

export function listSpecialties() {
  return [
    { code: 'ent', label: 'ENT', aliases: [] },
    { code: 'general_medicine', label: 'General Medicine', aliases: ['gm', 'general', 'internal_medicine', 'family_medicine'] },
    { code: 'primary_care', label: 'Primary Care (shared pack for other specialties)', aliases: [...PRIMARY_CARE_PACK_CODES].filter((x) => x !== 'primary_care') },
  ];
}
