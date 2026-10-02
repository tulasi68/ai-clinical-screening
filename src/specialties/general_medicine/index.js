import { GM_QUESTIONS } from './questions.js';
import { GM_FALLBACKS } from './fallbacks.js';
import { GENERAL_MEDICINE_PERSONA } from './persona.js';

export default {
  code: 'general_medicine',
  label: 'General Medicine',
  aliases: ['gm', 'general', 'internal_medicine', 'family_medicine'],

  // Linear flow with showIf branching on individual questions.
  // The driver (continueModuleSession in server.js) walks this array in order
  // and asks the first question whose `showIf(answerHelper)` returns true
  // and which hasn't been answered yet.
  questions: GM_QUESTIONS,

  // Deterministic follow-ups when Sarvam is unavailable.
  fallbacks: GM_FALLBACKS,

  // Sarvam system prompt for the free-form follow-up stage.
  persona: GENERAL_MEDICINE_PERSONA,

  // Optional overrides — null = use the generic Consolidate logic.
  consolidateInstructions: null,
  buildContract: null,
};
