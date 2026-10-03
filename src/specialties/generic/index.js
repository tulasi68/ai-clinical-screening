import { GENERIC_QUESTIONS } from './questions.js';

export default {
  code: 'generic',
  label: 'General screening',
  aliases: [
    'gynecology', 'cardiology', 'pediatrics', 'orthopedics', 'dermatology',
    'ophthalmology', 'dentistry', 'psychiatry', 'urology', 'gastroenterology',
    'pulmonology', 'neurology', 'endocrinology', 'nephrology', 'general_surgery',
    'ayurveda', 'other',
  ],

  questions: GENERIC_QUESTIONS,

  // No Sarvam follow-ups for the generic pack — fixed questions only.
  fallbacks: [],
  persona: null,
  consolidateInstructions: null,
  buildContract: null,
};
