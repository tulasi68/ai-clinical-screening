// Central registry. Adding a specialty:
//   1. Create src/specialties/<code>/index.js following the module contract
//   2. Import it here and add to SPECIALTY_MODULES
//   3. Add username prefixes to USERNAME_PREFIXES
// Nothing else in the codebase needs to change.
//
// NOTE: ENT is intentionally NOT registered here — it lives in flow.js/ai.js
// and continues to use the original code path. Migration to a module is deferred.

import generalMedicine from './general_medicine/index.js';
// import gynecology from './gynecology/index.js';
// import cardiology from './cardiology/index.js';
// import pediatrics from './pediatrics/index.js';
// ... add remaining as you build them

// ─────────────────────────────────────────────────────────────
// Username prefix → specialty code
// Handles: genmedstaff1, gynodoctor2, cardstaff1, entstaff10,
//          staff_gm1, doctor_gm1 (role-first form)
// ─────────────────────────────────────────────────────────────
const USERNAME_PREFIXES = {
  genmed: 'general_medicine',
  gm:     'general_medicine',
  // ent:    'ent',           // ← registered only if/when ENT migrates to a module
  gyno:   'gynecology',
  gyn:    'gynecology',
  obg:    'gynecology',
  card:   'cardiology',
  peds:   'pediatrics',
  paed:   'pediatrics',
  ortho:  'orthopedics',
  derm:   'dermatology',
  ophth:  'ophthalmology',
  eye:    'ophthalmology',
  dent:   'dentistry',
  psych:  'psychiatry',
  uro:    'urology',
  gastro: 'gastroenterology',
  gi:     'gastroenterology',
  pulm:   'pulmonology',
  chest:  'pulmonology',
  neuro:  'neurology',
  endo:   'endocrinology',
  nephro: 'nephrology',
  surg:   'general_surgery',
  ayur:   'ayurveda',
};

const SPECIALTY_MODULES = [
  generalMedicine,
  // gynecology,
  // ...
];

const REGISTRY = {};
for (const mod of SPECIALTY_MODULES) {
  if (!mod || !mod.code) continue;
  REGISTRY[mod.code] = mod;
  for (const alias of mod.aliases || []) REGISTRY[alias] = mod;
}

/**
 * Extract a specialty code from a username.
 * Supports both prefix-first and role-first forms:
 *   gynostaff1, gynodoctor2, cardstaff10
 *   staff_gm1, doctor_gm1, staff-gyno2
 */
export function specialtyFromUsername(username) {
  const raw = String(username || '').toLowerCase().trim();
  if (!raw) return null;
  const u = raw.replace(/[_-]/g, '');

  // prefix-first: genmedstaff1, gynodoctor2, cardstaff10
  const m1 = u.match(/^([a-z]+?)(staff|doctor|admin)\d*$/);
  if (m1) {
    const code = USERNAME_PREFIXES[m1[1]];
    if (code && REGISTRY[code]) return code;
  }

  // role-first: staffgm1, doctorgyno2
  const m2 = u.match(/^(staff|doctor|admin)([a-z]+?)\d*$/);
  if (m2) {
    const code = USERNAME_PREFIXES[m2[2]];
    if (code && REGISTRY[code]) return code;
  }

  return null;
}

/**
 * Resolve which specialty to use for a session.
 * Priority:
 *   1. explicit specialty (MediLoop always sends this)
 *   2. username prefix
 *   3. clinic default specialty
 *   4. general_medicine as last resort
 */
export function resolveSpecialty({ specialty, username, clinicDefault } = {}) {
  const s = String(specialty || '').toLowerCase().trim();
  if (s && REGISTRY[s]) return s;

  const fromUser = specialtyFromUsername(username);
  if (fromUser) return fromUser;

  const cd = String(clinicDefault || '').toLowerCase().trim();
  if (cd && REGISTRY[cd]) return cd;

  return REGISTRY.general_medicine ? 'general_medicine' : Object.keys(REGISTRY)[0] || null;
}

/**
 * Get the module for a specialty code. Falls back to general_medicine.
 * Returns null if no module is registered at all.
 */
export function getSpecialtyModule(code) {
  const c = String(code || '').toLowerCase().trim();
  if (REGISTRY[c]) return REGISTRY[c];
  if (REGISTRY.general_medicine) return REGISTRY.general_medicine;
  const first = Object.values(REGISTRY)[0];
  return first || null;
}

export function isRegistered(code) {
  return Boolean(REGISTRY[String(code || '').toLowerCase().trim()]);
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
