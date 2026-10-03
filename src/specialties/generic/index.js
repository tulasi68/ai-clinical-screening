import { GENERIC_QUESTIONS } from './questions.js';

export default {
  code: 'generic',
  label: 'General screening',
  // Only non-GM specialties. Never include general_medicine / gm / general.
  aliases: [
    'gynecology', 'cardiology', 'pediatrics', 'orthopedics', 'dermatology',
    'ophthalmology', 'dentistry', 'psychiatry', 'urology', 'gastroenterology',
    'pulmonology', 'neurology', 'endocrinology', 'nephrology', 'general_surgery',
    'ayurveda', 'other',
  ],
  questions: GENERIC_QUESTIONS,
  fallbacks: [],
  persona: null,
  consolidateInstructions: null,
  buildContract: null,
};
