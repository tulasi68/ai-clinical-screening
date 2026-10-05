// Central registry.
// ENT is NOT registered — handled by flow.js.
// general_medicine / primary_care → cascading pack in question-packs/primary_care.json
// Other non-ENT specialties → generic module + their JSON pack (when populated).

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

/** Codes that use the generic/JSON pack path (NOT ENT). */
export const GENERIC_SPECIALTY_CODES = new Set([
  'primary_care',
  'general_medicine',
  'gynecology', 'cardiology', 'pediatrics', 'orthopedics', 'dermatology',
  'ophthalmology', 'dentistry', 'psychiatry', 'urology', 'gastroenterology',
  'pulmonology', 'neurology', 'endocrinology', 'nephrology', 'general_surgery',
  'ayurveda', 'other', 'generic',
]);

const REGISTRY = {
  generic,
  primary_care: generic,
  general_medicine: generic,
};

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
  if (s && (REGISTRY[s] || GENERIC_SPECIALTY_CODES.has(s))) return s;

  const fromUser = specialtyFromUsername(username);
  if (fromUser) return fromUser;

  const cd = String(clinicDefault || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (cd === 'ent') return 'ent';
  if (cd === 'general_medicine' || cd === 'gm' || cd === 'general') return 'general_medicine';
  if (cd === 'primary_care' || cd === 'primarycare') return 'primary_care';
  if (cd && (REGISTRY[cd] || GENERIC_SPECIALTY_CODES.has(cd))) return cd;

  return 'general_medicine';
}

function specialtyModuleFor(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  const packCode = packCodeForSpecialty(c);
  const questions = typeof generic.questionsForSpecialty === 'function'
    ? generic.questionsForSpecialty(packCode)
    : generic.questions;
  return {
    ...generic,
    code: c || packCode,
    label: c === 'general_medicine' ? 'General Medicine' : (c || packCode),
    questions,
    packCode,
  };
}

export function getSpecialtyModule(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (!c || c === 'ent') return null;

  // General medicine and primary care both drive the primary_care cascading pack.
  if (
    c === 'general_medicine' ||
    c === 'gm' ||
    c === 'general' ||
    c === 'internal_medicine' ||
    c === 'family_medicine' ||
    c === 'primary_care' ||
    c === 'primarycare' ||
    c === 'primary' ||
    c === 'pc'
  ) {
    return specialtyModuleFor(
      c === 'primary_care' || c === 'primarycare' || c === 'primary' || c === 'pc'
        ? 'primary_care'
        : 'general_medicine'
    );
  }

  if (GENERIC_SPECIALTY_CODES.has(c)) return specialtyModuleFor(c);
  if (REGISTRY[c]) return specialtyModuleFor(c);

  // Unknown non-ENT specialty → primary_care cascading (safer than ENT ear flow).
  return specialtyModuleFor('general_medicine');
}

export function isRegistered(code) {
  const c = String(code || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (c === 'ent') return true;
  if (c === 'general_medicine' || c === 'gm' || c === 'general' || c === 'primary_care') return true;
  return Boolean(REGISTRY[c]) || GENERIC_SPECIALTY_CODES.has(c);
}

export function listSpecialties() {
  return [
    { code: 'general_medicine', label: 'General Medicine', aliases: ['gm', 'general', 'primary_care'] },
    { code: 'primary_care', label: 'Primary Care', aliases: ['primarycare', 'primary', 'pc'] },
    { code: 'generic', label: 'General screening', aliases: [...GENERIC_SPECIALTY_CODES].filter((x) => x !== 'generic' && x !== 'general_medicine' && x !== 'primary_care') },
  ];
}
