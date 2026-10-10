import { GENERIC_QUESTIONS } from './questions.js';
import { cascadingQuestionDef, isCascadingPack, nextCascadingQuestion } from './cascading.js';
import { packCodeForSpecialty } from '../packCodes.js';
import PRIMARY_CARE_PACK from '../question-packs/primary_care.json';
import GYNECOLOGY_PACK from '../question-packs/gynecology.json';
import PEDIATRICS_PACK from '../question-packs/pediatrics.json';

// Static map so the same module works in Node AND Cloudflare Workers VFS.
const STATIC_PACKS = {
  primary_care: PRIMARY_CARE_PACK,
  gynecology: GYNECOLOGY_PACK,
  pediatrics: PEDIATRICS_PACK,
};

const packCache = new Map();

function loadQuestionPack(code) {
  // All non-GM/non-ENT specialties resolve to a cascading pack name.
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

  // Prefer the specialty-specific pack; fall back to primary_care.
  const candidate = STATIC_PACKS[packCode] || STATIC_PACKS.primary_care;
  if (isCascadingPack(candidate)) {
    const result = { type: 'cascading', pack: candidate };
    packCache.set(packCode, result);
    return result;
  }

  console.warn('No cascading pack available; using linear generic questions:', packCode);
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
