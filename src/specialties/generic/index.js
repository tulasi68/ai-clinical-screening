import { GENERIC_QUESTIONS } from './questions.js';
import { cascadingQuestionDef, isCascadingPack, nextCascadingQuestion } from './cascading.js';
import { packCodeForSpecialty } from '../packCodes.js';
import PRIMARY_CARE_PACK from '../question-packs/primary_care.json';

const packCache = new Map();

function loadQuestionPack(code) {
  // All non-GM/non-ENT specialties currently share the primary-care pack.
  const packCode = packCodeForSpecialty(code) || 'primary_care';

  // GM / ENT are handled by their dedicated modules.
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

  // Keep the question pack statically imported so the same module works
  // in Vercel Node.js and Cloudflare Workers. Do not use fs/path/import.meta
  // filesystem resolution here because Workers have no deployment filesystem.
  if (packCode === 'primary_care' && isCascadingPack(PRIMARY_CARE_PACK)) {
    const result = { type: 'cascading', pack: PRIMARY_CARE_PACK };
    packCache.set(packCode, result);
    return result;
  }

  // Any future/unknown generic specialty falls back to the same primary-care pack.
  if (isCascadingPack(PRIMARY_CARE_PACK)) {
    const result = { type: 'cascading', pack: PRIMARY_CARE_PACK };
    packCache.set(packCode, result);
    return result;
  }

  console.warn('Primary-care question pack unavailable; using linear generic questions:', packCode);
  packCache.set(packCode, null);
  return null;
}

function sessionSpecialtyCode(session) {
  const fromPatient = String(session?.patient?.specialty || '').toLowerCase().trim().replace(/\s+/g, '_');

  // GM / ENT should never reach this module; if they do, preserve the code.
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
