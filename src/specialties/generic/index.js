import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERIC_QUESTIONS } from './questions.js';

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
    // This keeps today's behaviour unchanged until a specialty pack is populated.
    return Array.isArray(pack?.questions) && pack.questions.length
      ? pack.questions
      : null;
  } catch (err) {
    console.warn('Specialty JSON pack unavailable; using generic questions:', code, err?.message || err);
    return null;
  }
}

export function questionsForSpecialty(code) {
  return loadQuestionPack(code) || GENERIC_QUESTIONS;
}

export default {
  code: 'generic',
  label: 'General screening',
  // Only non-GM specialties. Never include general_medicine / gm / general.
  aliases: JSON_SPECIALTIES,
  questions: GENERIC_QUESTIONS,
  questionsForSpecialty,
  fallbacks: [],
  persona: null,
  consolidateInstructions: null,
  buildContract: null,
};
