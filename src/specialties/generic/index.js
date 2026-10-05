import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERIC_QUESTIONS } from './questions.js';
import { cascadingQuestionDef, isCascadingPack, nextCascadingQuestion } from './cascading.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JSON_SPECIALTIES = [
  'gynecology', 'cardiology', 'pediatrics', 'orthopedics', 'dermatology',
  'ophthalmology', 'dentistry', 'psychiatry', 'urology', 'gastroenterology',
  'pulmonology', 'neurology', 'endocrinology', 'nephrology', 'general_surgery',
  'ayurveda', 'other',
];

function loadQuestionPack(code) {
  if (!JSON_SPECIALTIES.includes(code)) return null;

  const file = path.join(__dirname, 'question-packs', code + '.json');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const pack = JSON.parse(raw);
    // Empty/draft packs deliberately fall back to the existing generic flow.
    // A populated cascading pack is handled by nextQuestion/questionDef below.
    if (isCascadingPack(pack)) return { type: 'cascading', pack };
    return Array.isArray(pack?.questions) && pack.questions.length
      ? { type: 'questions', questions: pack.questions }
      : null;
  } catch (err) {
    console.warn('Specialty JSON pack unavailable; using generic questions:', code, err?.message || err);
    return null;
  }
}

export function questionsForSpecialty(code) {
  const loaded = loadQuestionPack(code);
  return loaded?.type === 'questions' ? loaded.questions : GENERIC_QUESTIONS;
}

export default {
  code: 'generic',
  label: 'General screening',
  // Only non-GM specialties. Never include general_medicine / gm / general.
  aliases: JSON_SPECIALTIES,
  questions: GENERIC_QUESTIONS,
questionsForSpecialty,
  nextQuestion: (session) => {
    const code = String(session?.patient?.specialty || '').toLowerCase().trim().replace(/\\s+/g, '_');
    const loaded = loadQuestionPack(code);
    if (loaded?.type === 'cascading') return nextCascadingQuestion(loaded.pack, session);
    return GENERIC_QUESTIONS.find((q) => !((session.conversation || []).some((x) => x.role === 'patient' && x.qid === q.id))) || null;
  },
  questionDef: (session, qid) => {
    const code = String(session?.patient?.specialty || '').toLowerCase().trim().replace(/\\s+/g, '_');
    const loaded = loadQuestionPack(code);
    if (loaded?.type === 'cascading') return cascadingQuestionDef(loaded.pack, session, qid);
    return GENERIC_QUESTIONS.find((q) => q.id === qid) || null;
  },
  fallbacks: [],
  persona: null,
  consolidateInstructions: null,
  buildContract: null,
};
