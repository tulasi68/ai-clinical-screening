// Central registry.
// ENT is NOT registered — handled by flow.js.
// general_medicine → dedicated GM question pack
// All other non-ENT specialties → generic 5-question pack

import generalMedicine from './general_medicine/index.js';
import generic from './generic/index.js';

const USERNAME_PREFIXES = {
  genmed: 'general_medicine',
  gm:     'general_medicine',
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

/** Codes that use the generic 5-question pack (NOT general_medicine). */
export const GENERIC_SPECIALTY_CODES = new Set([
  'gynecology', 'cardiology', 'pediatrics', 'orthopedics', 'dermatology',
  'ophthalmology', 'dentistry', 'psychiatry', 'urology', 'gastroenterology',
  'pulmonology', 'neurology', 'endocrinology', 'nephrology', 'general_surgery',
  'ayurveda', 'other', 'generic',
]);

const SPECIALTY_MODULES = [
  generalMedicine,
  generic,
];

const REGISTRY = {};
for (const mod of SPECIALTY_MODULES) {
  if (!mod || !mod.code) continue;
  REGISTRY[mod.code] = mod;
  for (const alias of mod.aliases || []) {
    // Never let generic aliases overwrite general_medicine
    if (alias === 'general_medicine' || alias === 'gm') continue;
    REGISTRY[alias] = mod;
  }
}

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
  if (s && (REGISTRY[s] || GENERIC_SPECIALTY_CODES.has(s))) return s;

  const fromUser = specialtyFromUsername(username);
  if (fromUser) return fromUser;

  const cd = String(clinicDefault || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (cd === 'ent') return 'ent';
  if (cd === 'general_medicine' || cd === 'gm' || cd === 'general') return 'general_medicine';
  if (cd && (REGISTRY[cd] || GENERIC_SPECIALTY_CODES.has(cd))) return cd;

  return 'general_medicine';
}

/**
 * Get the module for a specialty code.
 * - ent → null (flow.js ENT path)
 * - general_medicine / gm / general → GM module (never generic)
 * - known other specialties → generic pack
 * - unknown → general_medicine (safer than generic for clinical content)
 */
export function getSpecialtyModule(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (!c || c === 'ent') return null;

  if (
    c === 'general_medicine' ||
    c === 'gm' ||
    c === 'general' ||
    c === 'internal_medicine' ||
    c === 'family_medicine'
  ) {
    return REGISTRY.general_medicine || null;
  }

  if (REGISTRY[c]) return REGISTRY[c];

  if (GENERIC_SPECIALTY_CODES.has(c)) {
    return REGISTRY.generic || null;
  }

  // Unknown non-ENT → prefer GM (full clinical questions), not generic
  return REGISTRY.general_medicine || REGISTRY.generic || null;
}

export function isRegistered(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (c === 'ent') return true;
  if (c === 'general_medicine' || c === 'gm' || c === 'general') return true;
  return Boolean(REGISTRY[c]) || GENERIC_SPECIALTY_CODES.has(c);
}

export function listSpecialties() {
  const seen = new Set();
  const out = [];
  for (const mod of SPECIALTY_MODULES) {
    if (!mod || seen.has(mod.code)) continue;
    seen.add(mod.code);
    out.push({ code: mod.code, label: mod.label, aliases: mod.aliases || [] });
  }
  return out;
}
