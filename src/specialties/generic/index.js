import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GENERIC_QUESTIONS } from './questions.js';
import { cascadingQuestionDef, isCascadingPack, nextCascadingQuestion } from './cascading.js';
import { packCodeForSpecialty } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const JSON_SPECIALTIES = [
  'primary_care',
  'gynecology', 'cardiology', 'pediatrics', 'orthopedics', 'dermatology',
  'ophthalmology', 'dentistry', 'psychiatry', 'urology', 'gastroenterology',
  'pulmonology', 'neurology', 'endocrinology', 'nephrology', 'general_surgery',
  'ayurveda', 'other',
];

// Prefer static require for the populated cascading pack so Vercel always bundles it.
let PRIMARY_CARE_PACK = null;
try {
  PRIMARY_CARE_PACK = require('../question-packs/primary_care.json');
} catch (err) {
  console.warn('primary_care.json static load failed:', err?.message || err);
}

const packCache = new Map();

function loadQuestionPack(code) {
  const packCode = packCodeForSpecialty(code);
  if (packCache.has(packCode)) return packCache.get(packCode);

  let result = null;

  if (packCode === 'primary_care' && PRIMARY_CARE_PACK && isCascadingPack(PRIMARY_CARE_PACK)) {
    result = { type: 'cascading', pack: PRIMARY_CARE_PACK };
    packCache.set(packCode, result);
    return result;
  }

  if (!JSON_SPECIALTIES.includes(packCode)) {
    packCache.set(packCode, null);
    return null;
  }

  const candidates = [
    path.join(__dirname, '..', 'question-packs', packCode + '.json'),
    path.join(process.cwd(), 'src', 'specialties', 'question-packs', packCode + '.json'),
    path.join(process.cwd(), 'specialties', 'question-packs', packCode + '.json'),
  ];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, 'utf8');
      const pack = JSON.parse(raw);
      if (isCascadingPack(pack)) {
        result = { type: 'cascading', pack };
      } else if (Array.isArray(pack?.questions) && pack.questions.length) {
        result = { type: 'questions', questions: pack.questions };
      } else {
        // Draft / empty pack (level1 null) — do not treat as success.
        result = null;
      }
      if (result) {
        packCache.set(packCode, result);
        return result;
      }
    } catch (err) {
      console.warn('Specialty JSON pack read failed:', packCode, file, err?.message || err);
    }
  }

  // Last resort: require() so bundlers include the file when present.
  try {
    const pack = require('../question-packs/' + packCode + '.json');
    if (isCascadingPack(pack)) result = { type: 'cascading', pack };
    else if (Array.isArray(pack?.questions) && pack.questions.length) result = { type: 'questions', questions: pack.questions };
  } catch {
    /* pack not present or not cascading */
  }

  if (!result) {
    console.warn('Specialty JSON pack unavailable or empty; using generic questions:', packCode);
  }
  packCache.set(packCode, result);
  return result;
}

function sessionSpecialtyCode(session) {
  const fromPatient = String(session?.patient?.specialty || '').toLowerCase().trim().replace(/\s+/g, '_');
  const fromMod = String(session?.__packCode || '').toLowerCase().trim().replace(/\s+/g, '_');
  return packCodeForSpecialty(fromPatient || fromMod || 'primary_care');
}

export function questionsForSpecialty(code) {
  const loaded = loadQuestionPack(code);
  return loaded?.type === 'questions' ? loaded.questions : GENERIC_QUESTIONS;
}

export default {
  code: 'generic',
  label: 'General screening',
  aliases: JSON_SPECIALTIES.concat(['general_medicine', 'gm', 'general']),
  questions: GENERIC_QUESTIONS,
  questionsForSpecialty,
  nextQuestion: (session) => {
    const code = sessionSpecialtyCode(session);
    const loaded = loadQuestionPack(code);
    if (loaded?.type === 'cascading') return nextCascadingQuestion(loaded.pack, session);
    if (loaded?.type === 'questions') {
      return loaded.questions.find((q) => !((session.conversation || []).some((x) => x.role === 'patient' && x.qid === q.id))) || null;
    }
    // Fallback linear generic questions only when no cascading pack exists.
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
