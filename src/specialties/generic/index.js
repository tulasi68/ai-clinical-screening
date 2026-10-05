import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GENERIC_QUESTIONS } from './questions.js';
import { cascadingQuestionDef, isCascadingPack, nextCascadingQuestion } from './cascading.js';
import { packCodeForSpecialty } from '../packCodes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Static require so Vercel always bundles the populated cascading pack.
let PRIMARY_CARE_PACK = null;
try {
  PRIMARY_CARE_PACK = require('../question-packs/primary_care.json');
} catch (err) {
  console.warn('primary_care.json static load failed:', err?.message || err);
}

const packCache = new Map();

function loadQuestionPack(code) {
  // All "other" specialties resolve to primary_care pack file.
  const packCode = packCodeForSpecialty(code) || 'primary_care';
  // Never load a JSON pack for GM / ENT via this path.
  if (
    packCode === 'general_medicine' ||
    packCode === 'gm' ||
    packCode === 'general' ||
    packCode === 'ent' ||
    !packCode
  ) {
    return null;
  }

  if (packCache.has(packCode)) return packCache.get(packCode);

  let result = null;

  if (packCode === 'primary_care' && PRIMARY_CARE_PACK && isCascadingPack(PRIMARY_CARE_PACK)) {
    result = { type: 'cascading', pack: PRIMARY_CARE_PACK };
    packCache.set(packCode, result);
    return result;
  }

  const candidates = [
    path.join(__dirname, '..', 'question-packs', packCode + '.json'),
    path.join(process.cwd(), 'src', 'specialties', 'question-packs', packCode + '.json'),
  ];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (isCascadingPack(pack)) {
        result = { type: 'cascading', pack };
      } else if (Array.isArray(pack?.questions) && pack.questions.length) {
        result = { type: 'questions', questions: pack.questions };
      }
      if (result) {
        packCache.set(packCode, result);
        return result;
      }
    } catch (err) {
      console.warn('Specialty JSON pack read failed:', packCode, file, err?.message || err);
    }
  }

  // Empty specialty-specific pack → fall back to primary_care cascading.
  if (packCode !== 'primary_care' && PRIMARY_CARE_PACK && isCascadingPack(PRIMARY_CARE_PACK)) {
    result = { type: 'cascading', pack: PRIMARY_CARE_PACK };
    packCache.set(packCode, result);
    return result;
  }

  console.warn('Specialty JSON pack unavailable; using linear generic questions:', packCode);
  packCache.set(packCode, null);
  return null;
}

function sessionSpecialtyCode(session) {
  const fromPatient = String(session?.patient?.specialty || '').toLowerCase().trim().replace(/\s+/g, '_');
  // GM / ENT should never reach this module; if they do, do not rewrite to primary_care.
  if (
    fromPatient === 'general_medicine' ||
    fromPatient === 'gm' ||
    fromPatient === 'general' ||
    fromPatient === 'ent'
  ) {
    return fromPatient;
  }
  return packCodeForSpecialty(fromPatient || 'primary_care') || 'primary_care';
}

export function questionsForSpecialty(code) {
  const loaded = loadQuestionPack(code);
  return loaded?.type === 'questions' ? loaded.questions : GENERIC_QUESTIONS;
}

export default {
  code: 'generic',
  label: 'Primary care / other specialties',
  // Do NOT list general_medicine aliases here — GM has its own module.
  aliases: [
    'primary_care', 'gynecology', 'cardiology', 'pediatrics', 'orthopedics',
    'dermatology', 'ophthalmology', 'dentistry', 'psychiatry', 'urology',
    'gastroenterology', 'pulmonology', 'neurology', 'endocrinology',
    'nephrology', 'general_surgery', 'ayurveda', 'other',
  ],
  questions: GENERIC_QUESTIONS,
  questionsForSpecialty,
  nextQuestion: (session) => {
    const code = sessionSpecialtyCode(session);
    const loaded = loadQuestionPack(code);
    if (loaded?.type === 'cascading') return nextCascadingQuestion(loaded.pack, session);
    if (loaded?.type === 'questions') {
      return loaded.questions.find((q) => !((session.conversation || []).some((x) => x.role === 'patient' && x.qid === q.id))) || null;
    }
    return GENERIC_QUESTIONS.find((q) => !((session.conversation || []).some((x) => x.role === 'patient' && x.qid === q.id))) || null;
  },
  questionDef: (session, qid) => {
    const code = sessionSpecialtyCode(session);
    const loaded = loadQuestionPack(code);
    if (loaded?.type === 'cascading') return cascadingQuestionDef(loaded.pack, session, qid);
    if (loaded?.type === 'questions') return loaded.questions.find((q) => q.id === qid) || null;
    return GENERIC_QUESTIONS.find((q) => q.id === qid) || null;
  },
  fallbacks: [],
  persona: null,
  consolidateInstructions: null,
  buildContract: null,
};
