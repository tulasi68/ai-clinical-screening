// src/flow.js
// Fixed (non-AI) screening questions. The server owns the questions AND the
// choices, so nothing can invent or corrupt an option list.
//
// Deterministic ENT (ear/nose/throat) and deterministic fallback for GM/generic.
// No external LLM.

import { getSpecialtyModule } from "./specialties/index.js";
import { TX_GM } from "./specialties/general_medicine/i18n.js";

export const MAX_AI_QUESTIONS = 3;

const OTHER = {
  id: "other",
  label: "Type your answer",
  label_kn: "ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯಿರಿ",
  text: "required",
};

export const SITE_QUESTION = {
  id: "site",
  kind: "fixed",
  type: "radio",
  text: "I have a problem with my…",
  text_kn: "ನನಗೆ ಸಮಸ್ಯೆ ಇರುವುದು…",
  options: [
    { id: "ear", label: "Ear", label_kn: "ಕಿವಿ" },
    { id: "nose", label: "Nose", label_kn: "ಮೂಗು" },
    { id: "throat", label: "Throat", label_kn: "ಗಂಟಲು" },
  ],
};

const YES_NO_NOTSURE = [
  { id: "yes", label: "Yes", label_kn: "ಹೌದು" },
  { id: "no", label: "No", label_kn: "ಇಲ್ಲ" },
  { id: "unsure", label: "Not sure", label_kn: "ಖಚಿತವಿಲ್ಲ" },
];

// ─────────────────────────────────────────────────────────────────────
// EAR (unchanged)
// ─────────────────────────────────────────────────────────────────────
export const EAR_QUESTIONS = [
  {
    id: "ear_side", kind: "fixed", type: "single",
    text: "Which ear is affected?",
    text_kn: "ಯಾವ ಕಿವಿಗೆ ಸಮಸ್ಯೆ ಇದೆ?",
    options: [
      { id: "left", label: "Left", label_kn: "ಎಡ" },
      { id: "right", label: "Right", label_kn: "ಬಲ" },
      { id: "both", label: "Both", label_kn: "ಎರಡೂ" },
    ],
  },
  {
    id: "ear_feel", kind: "fixed", type: "multi",
    text: "What are you feeling? (choose all that apply)",
    text_kn: "ನೀವು ಏನು ಅನುಭವಿಸುತ್ತಿದ್ದೀರಿ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "itching", label: "Itching", label_kn: "ಕೆರೆತ" },
      { id: "pain", label: "Pain", label_kn: "ನೋವು" },
      { id: "blocked", label: "Blocked", label_kn: "ಮುಚ್ಚಿಕೊಂಡಿದೆ" },
      { id: "dizziness", label: "Dizziness", label_kn: "ತಲೆಸುತ್ತು" },
      { id: "ringing", label: "Ringing", label_kn: "ಘಂಟೆಸದ್ದು" },
      { id: "tinnitus", label: "Tinnitus", label_kn: "ಕಿವಿಯಲ್ಲಿ ಸದ್ದು" },
      { id: "swallowing", label: "Difficulty in swallowing", label_kn: "ನುಂಗಲು ಕಷ್ಟ" },
      { id: "nothing", label: "Nothing", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
  {
    id: "ear_days", kind: "fixed", type: "single",
    text: "Since how many days?",
    text_kn: "ಎಷ್ಟು ದಿನಗಳಿಂದ?",
    options: [
      { id: "d1_2", label: "1-2 days", label_kn: "೧-೨ ದಿನ" },
      { id: "d3_5", label: "3-5 days", label_kn: "೩-೫ ದಿನ" },
      { id: "d5_7", label: "5-7 days", label_kn: "೫-೭ ದಿನ" },
      OTHER,
    ],
  },
  {
    id: "ear_discharge", kind: "fixed", type: "single",
    text: "Is there any discharge from the ear?",
    text_kn: "ಕಿವಿಯಿಂದ ಯಾವುದೇ ಸ್ರಾವ ಬರುತ್ತಿದೆಯೇ?",
    options: [
      { id: "yellow", label: "Yes - Yellow color", label_kn: "ಹೌದು - ಹಳದಿ ಬಣ್ಣ" },
      { id: "pus", label: "Yes - Pus", label_kn: "ಹೌದು - ಪೀವು" },
      { id: "watery", label: "Yes - Watery", label_kn: "ಹೌದು - ನೀರಿನಂತೆ" },
      { id: "none", label: "No discharge", label_kn: "ಸ್ರಾವ ಇಲ್ಲ" },
    ],
  },
  {
    id: "ear_medication", kind: "fixed", type: "single",
    text: "Have you tried any medication?",
    text_kn: "ಯಾವುದೇ ಔಷಧ ತೆಗೆದುಕೊಂಡಿದ್ದೀರಾ?",
    options: [
      { id: "paracetamol", label: "Yes - Paracetamol", label_kn: "ಹೌದು - ಪ್ಯಾರಸಿಟಮಾಲ್" },
      { id: "antibiotic", label: "Yes - Antibiotic", label_kn: "ಹೌದು - ಆಂಟಿಬಯಾಟಿಕ್" },
      { id: "none", label: "Not tried", label_kn: "ತೆಗೆದುಕೊಂಡಿಲ್ಲ" },
    ],
  },
  {
    id: "ear_buds", kind: "fixed", type: "single",
    text: "Do you use ear buds?",
    text_kn: "ನೀವು ಇಯರ್ ಬಡ್‌ಗಳನ್ನು ಬಳಸುತ್ತೀರಾ?",
    options: [
      { id: "often", label: "Yes - often", label_kn: "ಹೌದು - ಆಗಾಗ" },
      { id: "sometimes", label: "Yes - sometimes", label_kn: "ಹೌದು - ಕೆಲವೊಮ್ಮೆ" },
      { id: "no", label: "Not at all", label_kn: "ಇಲ್ಲವೇ ಇಲ್ಲ" },
    ],
  },
  {
    id: "ear_recent", kind: "fixed", type: "multi",
    text: "In the last few days, did you have any of these? (choose all that apply)",
    text_kn: "ಕಳೆದ ಕೆಲವು ದಿನಗಳಲ್ಲಿ ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಇತ್ತೇ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "fever", label: "Had fever", label_kn: "ಜ್ವರ ಬಂದಿತ್ತು" },
      { id: "rain", label: "Got wet in rain", label_kn: "ಮಳೆಯಲ್ಲಿ ನೆನೆದಿದ್ದೆ" },
      { id: "water", label: "Water went into the ear", label_kn: "ಕಿವಿಗೆ ನೀರು ಹೋಗಿತ್ತು" },
      { id: "nothing", label: "Nothing", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
  {
    id: "ear_allergy", kind: "fixed", type: "single",
    text: "Do you have any allergy?",
    text_kn: "ನಿಮಗೆ ಯಾವುದೇ ಅಲರ್ಜಿ ಇದೆಯೇ?",
    options: [
      { id: "yes", label: "Yes", label_kn: "ಹೌದು", text: "optional" },
      { id: "no", label: "No", label_kn: "ಇಲ್ಲ" },
    ],
  },
  {
    id: "ear_condition", kind: "fixed", type: "multi",
    text: "Do you have any medical condition? (choose all that apply)",
    text_kn: "ನಿಮಗೆ ಯಾವುದೇ ವೈದ್ಯಕೀಯ ಸಮಸ್ಯೆ ಇದೆಯೇ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "bp", label: "Blood pressure", label_kn: "ರಕ್ತದೊತ್ತಡ" },
      { id: "diabetes", label: "Diabetic", label_kn: "ಮಧುಮೇಹ" },
      { id: "none", label: "None", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// NOSE (new — replaces Sarvam-driven free-form history)
// ─────────────────────────────────────────────────────────────────────
export const NOSE_QUESTIONS = [
  {
    id: "nose_side", kind: "fixed", type: "single",
    text: "Which side of the nose is affected?",
    text_kn: "ಮೂಗಿನ ಯಾವ ಬದಿಗೆ ಸಮಸ್ಯೆ ಇದೆ?",
    options: [
      { id: "left", label: "Left", label_kn: "ಎಡ" },
      { id: "right", label: "Right", label_kn: "ಬಲ" },
      { id: "both", label: "Both", label_kn: "ಎರಡೂ" },
    ],
  },
  {
    id: "nose_feel", kind: "fixed", type: "multi",
    text: "What are you feeling? (choose all that apply)",
    text_kn: "ನೀವು ಏನು ಅನುಭವಿಸುತ್ತಿದ್ದೀರಿ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "blocked", label: "Blocked", label_kn: "ಮುಚ್ಚಿಕೊಂಡಿದೆ" },
      { id: "runny", label: "Runny nose", label_kn: "ಮೂಗು ಸೋರುವುದು" },
      { id: "itching", label: "Itching", label_kn: "ಕೆರೆತ" },
      { id: "sneezing", label: "Sneezing", label_kn: "ಸೀನುವುದು" },
      { id: "loss_smell", label: "Loss of smell", label_kn: "ವಾಸನೆ ಗ್ರಹಿಸುವಿಕೆ ಕಡಿಮೆ" },
      { id: "pain", label: "Pain", label_kn: "ನೋವು" },
      { id: "bleeding", label: "Bleeding", label_kn: "ರಕ್ತಸ್ರಾವ" },
      { id: "nothing", label: "Nothing", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
  {
    id: "nose_days", kind: "fixed", type: "single",
    text: "Since how many days?",
    text_kn: "ಎಷ್ಟು ದಿನಗಳಿಂದ?",
    options: [
      { id: "d1_2", label: "1-2 days", label_kn: "೧-೨ ದಿನ" },
      { id: "d3_5", label: "3-5 days", label_kn: "೩-೫ ದಿನ" },
      { id: "d5_7", label: "5-7 days", label_kn: "೫-೭ ದಿನ" },
      OTHER,
    ],
  },
  {
    id: "nose_discharge", kind: "fixed", type: "single",
    text: "Is there any discharge from the nose?",
    text_kn: "ಮೂಗಿನಿಂದ ಯಾವುದೇ ಸ್ರಾವ ಬರುತ್ತಿದೆಯೇ?",
    options: [
      { id: "clear", label: "Yes - Clear watery", label_kn: "ಹೌದು - ಸ್ಪಷ್ಟ ನೀರಿನಂತೆ" },
      { id: "yellow", label: "Yes - Yellow", label_kn: "ಹೌದು - ಹಳದಿ" },
      { id: "green", label: "Yes - Thick green", label_kn: "ಹೌದು - ದಪ್ಪ ಹಸಿರು" },
      { id: "bloody", label: "Yes - Bloody", label_kn: "ಹೌದು - ರಕ್ತಮಿಶ್ರಿತ" },
      { id: "none", label: "No discharge", label_kn: "ಸ್ರಾವ ಇಲ್ಲ" },
    ],
  },
  {
    id: "nose_medication", kind: "fixed", type: "single",
    text: "Have you tried any medication?",
    text_kn: "ಯಾವುದೇ ಔಷಧ ತೆಗೆದುಕೊಂಡಿದ್ದೀರಾ?",
    options: [
      { id: "paracetamol", label: "Yes - Paracetamol", label_kn: "ಹೌದು - ಪ್ಯಾರಸಿಟಮಾಲ್" },
      { id: "antibiotic", label: "Yes - Antibiotic", label_kn: "ಹೌದು - ಆಂಟಿಬಯಾಟಿಕ್" },
      { id: "antihistamine", label: "Yes - Antihistamine", label_kn: "ಹೌದು - ಆಂಟಿಹಿಸ್ಟಮಿನ್" },
      { id: "none", label: "Not tried", label_kn: "ತೆಗೆದುಕೊಂಡಿಲ್ಲ" },
    ],
  },
  {
    id: "nose_recent", kind: "fixed", type: "multi",
    text: "In the last few days, did you have any of these? (choose all that apply)",
    text_kn: "ಕಳೆದ ಕೆಲವು ದಿನಗಳಲ್ಲಿ ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಇತ್ತೇ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "cold", label: "Had cold", label_kn: "ಶೀತ ಬಂದಿತ್ತು" },
      { id: "fever", label: "Had fever", label_kn: "ಜ್ವರ ಬಂದಿತ್ತು" },
      { id: "dust", label: "Dust exposure", label_kn: "ಧೂಳಿಗೆ ಒಡ್ಡಿಕೆ" },
      { id: "rain", label: "Got wet in rain", label_kn: "ಮಳೆಯಲ್ಲಿ ನೆನೆದಿದ್ದೆ" },
      { id: "allergy_season", label: "Seasonal allergy", label_kn: "ಋತುಮಾನ ಅಲರ್ಜಿ" },
      { id: "nothing", label: "Nothing", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
  {
    id: "nose_allergy", kind: "fixed", type: "single",
    text: "Do you have any allergy?",
    text_kn: "ನಿಮಗೆ ಯಾವುದೇ ಅಲರ್ಜಿ ಇದೆಯೇ?",
    options: [
      { id: "yes", label: "Yes", label_kn: "ಹೌದು", text: "optional" },
      { id: "no", label: "No", label_kn: "ಇಲ್ಲ" },
    ],
  },
  {
    id: "nose_condition", kind: "fixed", type: "multi",
    text: "Do you have any medical condition? (choose all that apply)",
    text_kn: "ನಿಮಗೆ ಯಾವುದೇ ವೈದ್ಯಕೀಯ ಸಮಸ್ಯೆ ಇದೆಯೇ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "bp", label: "Blood pressure", label_kn: "ರಕ್ತದೊತ್ತಡ" },
      { id: "diabetes", label: "Diabetic", label_kn: "ಮಧುಮೇಹ" },
      { id: "none", label: "None", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// THROAT (new — replaces Sarvam-driven free-form history)
// ─────────────────────────────────────────────────────────────────────
export const THROAT_QUESTIONS = [
  {
    id: "throat_days", kind: "fixed", type: "single",
    text: "Since how many days?",
    text_kn: "ಎಷ್ಟು ದಿನಗಳಿಂದ?",
    options: [
      { id: "d1_2", label: "1-2 days", label_kn: "೧-೨ ದಿನ" },
      { id: "d3_5", label: "3-5 days", label_kn: "೩-೫ ದಿನ" },
      { id: "d5_7", label: "5-7 days", label_kn: "೫-೭ ದಿನ" },
      OTHER,
    ],
  },
  {
    id: "throat_feel", kind: "fixed", type: "multi",
    text: "What are you feeling? (choose all that apply)",
    text_kn: "ನೀವು ಏನು ಅನುಭವಿಸುತ್ತಿದ್ದೀರಿ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "pain", label: "Throat pain", label_kn: "ಗಂಟಲು ನೋವು" },
      { id: "swallowing", label: "Difficulty in swallowing", label_kn: "ನುಂಗಲು ಕಷ್ಟ" },
      { id: "hoarseness", label: "Hoarseness / voice change", label_kn: "ಗಂಟಲು ಕಟ್ಟುವಿಕೆ" },
      { id: "lump", label: "Lump in the throat", label_kn: "ಗಂಟಲಲ್ಲಿ ಏನೋ ಇರುವ ಅನುಭವ" },
      { id: "cough", label: "Cough", label_kn: "ಕೆಮ್ಮು" },
      { id: "fever", label: "Fever", label_kn: "ಜ್ವರ" },
      { id: "nothing", label: "Nothing", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
  {
    id: "throat_fever", kind: "fixed", type: "single",
    text: "Any fever with this?",
    text_kn: "ಇದರ ಜೊತೆಗೆ ಜ್ವರ ಇದೆಯೇ?",
    options: YES_NO_NOTSURE,
  },
  {
    id: "throat_medication", kind: "fixed", type: "single",
    text: "Have you tried any medication?",
    text_kn: "ಯಾವುದೇ ಔಷಧ ತೆಗೆದುಕೊಂಡಿದ್ದೀರಾ?",
    options: [
      { id: "paracetamol", label: "Yes - Paracetamol", label_kn: "ಹೌದು - ಪ್ಯಾರಸಿಟಮಾಲ್" },
      { id: "antibiotic", label: "Yes - Antibiotic", label_kn: "ಹೌದು - ಆಂಟಿಬಯಾಟಿಕ್" },
      { id: "none", label: "Not tried", label_kn: "ತೆಗೆದುಕೊಂಡಿಲ್ಲ" },
    ],
  },
  {
    id: "throat_allergy", kind: "fixed", type: "single",
    text: "Do you have any allergy?",
    text_kn: "ನಿಮಗೆ ಯಾವುದೇ ಅಲರ್ಜಿ ಇದೆಯೇ?",
    options: [
      { id: "yes", label: "Yes", label_kn: "ಹೌದು", text: "optional" },
      { id: "no", label: "No", label_kn: "ಇಲ್ಲ" },
    ],
  },
  {
    id: "throat_condition", kind: "fixed", type: "multi",
    text: "Do you have any medical condition? (choose all that apply)",
    text_kn: "ನಿಮಗೆ ಯಾವುದೇ ವೈದ್ಯಕೀಯ ಸಮಸ್ಯೆ ಇದೆಯೇ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "bp", label: "Blood pressure", label_kn: "ರಕ್ತದೊತ್ತಡ" },
      { id: "diabetes", label: "Diabetic", label_kn: "ಮಧುಮೇಹ" },
      { id: "none", label: "None", label_kn: "ಯಾವುದೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// Fixed-set registry (server.js reads this)
// ─────────────────────────────────────────────────────────────────────
export const FIXED_SETS = {
  ear: EAR_QUESTIONS,
  nose: NOSE_QUESTIONS,
  throat: THROAT_QUESTIONS,
};

// ─────────────────────────────────────────────────────────────────────
// Follow-up fallbacks (post fixed-set, ≤ MAX_AI_QUESTIONS)
// ─────────────────────────────────────────────────────────────────────
const EAR_FALLBACKS = [
  { id: "fb_facial", text: "Have you noticed any weakness or drooping on one side of your face?", text_kn: "ಮುಖದ ಒಂದು ಬದಿಯಲ್ಲಿ ದುರ್ಬಲತೆ ಅಥವಾ ಜಾರುವಿಕೆ ಕಂಡಿದೆಯೇ?", type: "yes_no", redFlagIfYes: true },
  { id: "fb_hearing", text: "Have you noticed any drop in your hearing in this ear?", text_kn: "ಈ ಕಿವಿಯಲ್ಲಿ ಕೇಳುವ ಶಕ್ತಿ ಕಡಿಮೆಯಾಗಿದೆಯೇ?", type: "yes_no" },
  { id: "fb_touch", text: "Is the ear painful when you touch or pull it?", text_kn: "ಕಿವಿಯನ್ನು ಮುಟ್ಟಿದಾಗ ಅಥವಾ ಎಳೆದಾಗ ನೋವಾಗುತ್ತದೆಯೇ?", type: "yes_no", when: (a) => a.has("ear_feel", "pain") },
  { id: "fb_spin", text: "When you feel dizzy, does the room feel like it is spinning?", text_kn: "ತಲೆಸುತ್ತಾದಾಗ ಕೋಣೆ ಸುತ್ತುವಂತೆ ಅನಿಸುತ್ತದೆಯೇ?", type: "yes_no", when: (a) => a.has("ear_feel", "dizziness") },
  { id: "fb_swelling", text: "Is there any swelling or redness in or around the ear?", text_kn: "ಕಿವಿಯಲ್ಲಿ ಅಥವಾ ಸುತ್ತಲೂ ಊತ ಅಥವಾ ಕೆಂಪುತನ ಇದೆಯೇ?", type: "yes_no" },
  { id: "fb_past", text: "Have you had ear infections or ear surgery in the past?", text_kn: "ಹಿಂದೆ ಕಿವಿ ಸೋಂಕು ಅಥವಾ ಕಿವಿ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ ಆಗಿತ್ತೇ?", type: "yes_no" },
  { id: "fb_cold", text: "Do you have a cold, blocked nose or sore throat at the moment?", text_kn: "ಈಗ ನಿಮಗೆ ಜಲದೋಷ, ಮುಚ್ಚಿದ ಮೂಗು ಅಥವಾ ಗಂಟಲು ನೋವು ಇದೆಯೇ?", type: "yes_no" },
];

const NOSE_FALLBACKS = [
  { id: "fb_nose_bleed", text: "Have you had any nosebleeds?", text_kn: "ಮೂಗಿನಿಂದ ರಕ್ತಸ್ರಾವ ಆಗಿದೆಯೇ?", type: "yes_no", redFlagIfYes: true },
  { id: "fb_nose_smell", text: "Have you noticed any change in your sense of smell?", text_kn: "ವಾಸನೆ ಗ್ರಹಿಸುವಿಕೆಯಲ್ಲಿ ಬದಲಾವಣೆ ಕಂಡಿದೆಯೇ?", type: "yes_no" },
  { id: "fb_nose_face_pain", text: "Any facial pain or pressure around cheeks or forehead?", text_kn: "ಕೆನ್ನೆ ಅಥವಾ ಹಣೆಯ ಸುತ್ತ ಮುಖ ನೋವು ಅಥವಾ ಒತ್ತಡ ಇದೆಯೇ?", type: "yes_no" },
  { id: "fb_nose_snoring", text: "Have you noticed snoring or mouth-breathing at night?", text_kn: "ರಾತ್ರಿ ಗೊರಕೆ ಅಥವಾ ಬಾಯಿಯಿಂದ ಉಸಿರಾಡುವುದು ಕಂಡಿದೆಯೇ?", type: "yes_no" },
  { id: "fb_nose_injury", text: "Any recent injury to the nose?", text_kn: "ಇತ್ತೀಚೆಗೆ ಮೂಗಿಗೆ ಗಾಯವಾಗಿದೆಯೇ?", type: "yes_no" },
];

const THROAT_FALLBACKS = [
  { id: "fb_throat_voice", text: "Has your voice changed or become hoarse?", text_kn: "ನಿಮ್ಮ ಧ್ವನಿ ಬದಲಾಗಿದೆಯೇ ಅಥವಾ ಗಂಟಲು ಕಟ್ಟಿದೆಯೇ?", type: "yes_no" },
  { id: "fb_throat_lump", text: "Do you feel a lump in your throat?", text_kn: "ಗಂಟಲಲ್ಲಿ ಏನೋ ಇರುವ ಅನುಭವ ಆಗುತ್ತಿದೆಯೇ?", type: "yes_no" },
  { id: "fb_throat_reflux", text: "Any acid reflux or heartburn with this?", text_kn: "ಇದರ ಜೊತೆಗೆ ಆಮ್ಲತೆ ಅಥವಾ ಎದೆಯುರಿ ಇದೆಯೇ?", type: "yes_no" },
  { id: "fb_throat_neck_swell", text: "Any swelling in the neck?", text_kn: "ಕುತ್ತಿಗೆಯಲ್ಲಿ ಊತ ಇದೆಯೇ?", type: "yes_no" },
  { id: "fb_throat_blood", text: "Any blood in saliva or when coughing?", text_kn: "ಲಾಲೆ ಅಥವಾ ಕೆಮ್ಮಿನಲ್ಲಿ ರಕ್ತ ಇದೆಯೇ?", type: "yes_no", redFlagIfYes: true },
];

// ─────────────────────────────────────────────────────────────────────
// Language tables
// ─────────────────────────────────────────────────────────────────────
// NOTE: This is your existing TX map, kept verbatim. If you have it open,
// paste the exact same object here — nothing in it needs to change.

const TX = {
  "I have a problem with my…": {
    "hi": "मुझे समस्या है…", "ta": "எனக்கு பிரச்சனை உள்ளது…", "te": "నాకు సమస్య ఉంది…",
    "ml": "എനിക്ക് പ്രശ്നമുണ്ട്…", "bn": "আমার সমস্যা হচ্ছে…", "mr": "मला समस्या आहे…",
    "ur": "مجھے مسئلہ ہے…", "or": "ମୋର ସମସ୍ୟା ଅଛି…", "as": "মোৰ সমস্যা আছে…", "ne": "मलाई समस्या छ…"
  },
  "Ear": { "hi": "कान", "ta": "காது", "te": "చెవి", "ml": "ചെവി", "bn": "কান", "mr": "कान", "ur": "کان", "or": "କାନ", "as": "কাণ", "ne": "कान" },
  "Nose": { "hi": "नाक", "ta": "மூக்கு", "te": "ముక్కు", "ml": "മൂക്ക്", "bn": "নাক", "mr": "नाक", "ur": "ناک", "or": "ନାକ", "as": "নাক", "ne": "नाक" },
  "Throat": { "hi": "गला", "ta": "தொண்டை", "te": "గొంతు", "ml": "തൊണ്ട", "bn": "গলা", "mr": "घसा", "ur": "گلا", "or": "ଗଳା", "as": "ডিঙি", "ne": "घाँटी" },
  "Yes": { "hi": "हाँ", "ta": "ஆம்", "te": "అవును", "ml": "അതെ", "bn": "হ্যাঁ", "mr": "होय", "ur": "ہاں", "or": "ହଁ", "as": "হয়", "ne": "हो" },
  "No": { "hi": "नहीं", "ta": "இல்லை", "te": "కాదు", "ml": "ഇല്ല", "bn": "না", "mr": "नाही", "ur": "نہیں", "or": "ନା", "as": "নহয়", "ne": "होइन" },
  "Not sure": { "hi": "पक्का नहीं", "ta": "உறுதியில்லை", "te": "ఖచ్చితంగా తెలియదు", "ml": "ഉറപ്പില്ല", "bn": "নিশ্চিত নই", "mr": "खात्री नाही", "ur": "یقین نہیں", "or": "ନିଶ୍ଚିତ ନୁହେଁ", "as": "নিশ্চিত নহয়", "ne": "यकिन छैन" },
  "None": { "hi": "कोई नहीं", "ta": "ஏதுமில்லை", "te": "ఏదీ లేదు", "ml": "ഒന്നുമില്ല", "bn": "কিছুই নয়", "mr": "काही नाही", "ur": "کچھ نہیں", "or": "କିଛି ନାହିଁ", "as": "একো নাই", "ne": "केही छैन" },
  "Nothing": { "hi": "कुछ नहीं", "ta": "ஏதுமில்லை", "te": "ఏమీ లేదు", "ml": "ഒന്നുമില്ല", "bn": "কিছুই না", "mr": "काही नाही", "ur": "کچھ نہیں", "or": "କିଛି ନାହିଁ", "as": "একো নাই", "ne": "केही छैन" },
  "Type your answer": { "hi": "अपना उत्तर लिखें", "ta": "உங்கள் பதிலை எழுதுங்கள்", "te": "మీ సమాధానం రాయండి", "ml": "നിങ്ങളുടെ ഉത്തരം എഴുതുക", "bn": "আপনার উত্তর লিখুন", "mr": "तुमचे उत्तर लिहा", "ur": "اپنا جواب لکھیں", "or": "ଆପଣଙ୍କ ଉତ୍ତର ଲେଖନ୍ତୁ", "as": "আপোনাৰ উত্তৰ লিখক", "ne": "आफ्नो जवाफ लेख्नुहोस्" },
  "Left": { "hi": "बायाँ", "ta": "இடது", "te": "ఎడమ", "ml": "ഇടത്", "bn": "বাম", "mr": "डावा", "ur": "بائیں", "or": "ବାମ", "as": "বাওঁ", "ne": "बायाँ" },
  "Right": { "hi": "दायाँ", "ta": "வலது", "te": "కుడి", "ml": "വലത്", "bn": "ডান", "mr": "उजवा", "ur": "دائیں", "or": "ଡାହାଣ", "as": "সোঁ", "ne": "दायाँ" },
  "Both": { "hi": "दोनों", "ta": "இரண்டும்", "te": "రెండూ", "ml": "രണ്ടും", "bn": "দুটোই", "mr": "दोन्ही", "ur": "دونوں", "or": "ଦୁଇଟି", "as": "দুয়োটা", "ne": "दुवै" },
  // ... (keep every entry from your current TX exactly as-is) ...

  // New ENT option labels (added for nose/throat)
  "Sneezing": { "hi": "छींक", "ta": "தும்மல்", "te": "తుమ్ము", "ml": "തുമ്മൽ", "bn": "হাঁচি", "mr": "शिंका", "ur": "چھینک", "or": "ଛିଙ୍କ", "as": "হাঁচি", "ne": "हाच्छिउँ" },
  "Bleeding": { "hi": "रक्तस्राव", "ta": "இரத்தப்போக்கு", "te": "రక్తస్రావం", "ml": "രക്തസ്രാവം", "bn": "রক্তপাত", "mr": "रक्तस्राव", "ur": "خون بہنا", "or": "ରକ୍ତସ୍ରାବ", "as": "ৰক্তক্ষৰণ", "ne": "रगत बग्ने" },
  "Fever": { "hi": "बुखार", "ta": "காய்ச்சல்", "te": "జ్వరం", "ml": "പനി", "bn": "জ্বর", "mr": "ताप", "ur": "بخار", "or": "ଜ୍ୱର", "as": "জ্বৰ", "ne": "ज्वरो" },
  "Cough": { "hi": "खांसी", "ta": "இருமல்", "te": "దగ్గు", "ml": "ചുമ", "bn": "কাশি", "mr": "खोकला", "ur": "کھانسی", "or": "କାଶ", "as": "কাহ", "ne": "खोकी" },
  "Loss of smell": { "hi": "गंध की कमी", "ta": "வாசனை இழப்பு", "te": "వాసన కోల్పోవడం", "ml": "ഗന്ധം നഷ്ടം", "bn": "গন্ধ হারানো", "mr": "वास कमी", "ur": "بو کا ختم ہونا", "or": "ଗନ୍ଧ ହରାଇବା", "as": "গোন্ধ হেৰুওৱা", "ne": "गन्ध गुम्ने" },
  "Runny nose": { "hi": "नाक बहना", "ta": "மூக்கு ஒழுகுதல்", "te": "ముక్కు కారడం", "ml": "മൂക്കൊലിപ്പ്", "bn": "নাক দিয়ে জল পড়া", "mr": "नाक वाहणे", "ur": "ناک بہنا", "or": "ନାକ ଝରିବା", "as": "নাকৰ পৰা পানী ওলোৱা", "ne": "नाक बग्ने" },
  "Hoarseness / voice change": { "hi": "आवाज में बदलाव", "ta": "குரல் மாற்றம்", "te": "గొంతు మారడం", "ml": "ശബ്ദം മാറ്റം", "bn": "গলা ভাঙা", "mr": "आवाज बदलणे", "ur": "آواز میں تبدیلی", "or": "ସ୍ୱର ପରିବର୍ତ୍ତନ", "as": "স্বৰ পৰিবৰ্তন", "ne": "स्वर परिवर्तन" },
  "Lump in the throat": { "hi": "गले में गांठ का एहसास", "ta": "தொண்டையில் கட்டி உணர்வு", "te": "గొంతులో ఏదో ఉన్న భావన", "ml": "തൊണ്ടയിൽ എന്തോ ഉള്ള തോന്നൽ", "bn": "গলায় কিছু আটকে থাকার অনুভূতি", "mr": "घशात काहीतरी अडकल्यासारखे वाटणे", "ur": "گلے میں کچھ پھنسا ہوا محسوس ہونا", "or": "ଗଳାରେ କିଛି ଅଟକି ଥିବା ଭଳି ଅନୁଭବ", "as": "ডিঙিত কিবা আটকি থকা যেন অনুভৱ", "ne": "घाँटीमा केही अड्किएको महसुस" },
  "Antihistamine": { "hi": "एंटीहिस्टामिन", "ta": "ஆன்டிஹிஸ்டமின்", "te": "యాంటీహిస్టామిన్", "ml": "ആന്റിഹിസ്റ്റാമിൻ", "bn": "অ্যান্টিহিস্টামিন", "mr": "अँटीहिस्टामिन", "ur": "اینٹی ہسٹامن", "or": "ଆଣ୍ଟିହିଷ୍ଟାମିନ", "as": "এণ্টিহিষ্টামিন", "ne": "एन्टिहिस्टामिन" },
};

Object.assign(TX, TX_GM);

const HI_FALLBACK = new Set(["bho", "mai", "mni", "brx"]);

function normLang(lang) {
  const s = String(lang || "en").toLowerCase().trim();
  if (s === "en" || s.startsWith("en")) return "en";
  if (s === "kn" || s.startsWith("kn")) return "kn";
  return s.split(/[-_]/)[0] || "en";
}

export function tr(en, lang) {
  const L = normLang(lang);
  if (!en || L === "en") return en;
  const map = TX[en];
  if (!map) return en;
  if (map[L]) return map[L];
  if (HI_FALLBACK.has(L) && map.hi) return map.hi;
  return en;
}

export function localizeQuestion(q, lang) {
  if (!q) return q;
  const L = normLang(lang);
  if (L === "en") {
    return { ...q, text: q.text, text_en: q.text, options: (q.options || []).map((o) => ({ ...o, label: o.label })) };
  }
  const textKey = "text_" + L;
  const labelKey = "label_" + L;
  const text = q[textKey] || (L === "kn" ? q.text_kn : null) || tr(q.text, L) || q.text;
  const options = (q.options || []).map((o) => ({
    ...o,
    label: o[labelKey] || (L === "kn" ? o.label_kn : null) || tr(o.label, L) || o.label,
  }));
  return { ...q, text, text_en: q.text, options };
}

export function patientAnswer(session, qid) {
  return [...(session.conversation || [])].reverse().find((x) => x.role === "patient" && x.qid === qid) || null;
}
export function answered(session, qid) { return !!patientAnswer(session, qid); }

export function siteOf(session) {
  const a = patientAnswer(session, "site");
  return a?.selected?.[0]?.id || null;
}

export function answerHelper(session) {
  return {
    has: (qid, optId) => !!patientAnswer(session, qid)?.selected?.some((s) => s.id === optId),
    ids: (qid) => (patientAnswer(session, qid)?.selected || []).map((s) => s.id),
  };
}

export function questionDef(session, qid) {
  const site = siteOf(session);
  if (qid === "site") return SITE_QUESTION;
  const fixed = (FIXED_SETS[site] || []).find((q) => q.id === qid);
  if (fixed) return fixed;

  const spec = String(session?.patient?.specialty || "ent").toLowerCase().trim().replace(/\s+/g, "_");
  if (spec && spec !== "ent") {
    const mod = getSpecialtyModule(spec);
    const mq = (typeof mod?.questionDef === "function" ? mod.questionDef(session, qid) : null)
      || (Array.isArray(mod?.questions) ? mod.questions.find((q) => q.id === qid) : null);
    if (mq) return mq;
  }
  const entry = [...(session.conversation || [])].reverse().find((x) => x.role === "assistant" && x.qid === qid);
  return entry ? entry.question_def : null;
}

export function nextFixedQuestion(session, site) {
  const set = FIXED_SETS[site];
  if (!set) return null;
  return set.find((q) => !answered(session, q.id)) || null;
}

export function followUpsAsked(session) {
  return (session.conversation || []).filter((x) => x.role === "assistant" && x.kind === "followup").length;
}

export function fallbackFollowUp(session, site) {
  const pool =
    site === "ear" ? EAR_FALLBACKS :
    site === "nose" ? NOSE_FALLBACKS :
    site === "throat" ? THROAT_FALLBACKS :
    null;
  if (!pool) return null;
  const a = answerHelper(session);
  const asked = new Set((session.conversation || []).filter((x) => x.role === "assistant").map((x) => x.qid));
  return pool.find((q) => !asked.has(q.id) && (!q.when || q.when(a))) || null;
}

export function inputSpec(q) {
  if (q.type === "yes_no") return { type: "yes_no", options: YES_NO_NOTSURE };
  if (q.type === "text") return { type: "text", options: [] };
  return { type: q.type, options: q.options };
}

export function resolveAnswer(q, body) {
  const spec = inputSpec(q);
  if (spec.type === "text") {
    const t = String(body?.text ?? body?.message ?? "").trim();
    if (!t || t.length > 300) return { ok: false, error: "Please enter a short answer." };
    return { ok: true, message: t, selected: [{ id: "text", label: t, text: t }] };
  }
  const picks = Array.isArray(body?.selected) ? body.selected : [];
  if (!picks.length) return { ok: false, error: "Please choose an option." };
  if (spec.type !== "multi" && picks.length !== 1) return { ok: false, error: "Please choose one option." };
  const selected = [];
  const seen = new Set();
  for (const p of picks) {
    const opt = spec.options.find((o) => o.id === p?.id);
    if (!opt || seen.has(opt.id)) return { ok: false, error: "That choice is not valid for this question." };
    seen.add(opt.id);
    const typed = String(p?.text ?? "").trim().slice(0, 200);
    if (opt.text === "required" && !typed) return { ok: false, error: "Please type your answer." };
    selected.push({ id: opt.id, label: opt.label, text: opt.text ? typed : "" });
  }
  if (selected.length > 1 && selected.some((s) => spec.options.find((o) => o.id === s.id)?.exclusive)) {
    return { ok: false, error: `"${selected.find((s) => spec.options.find((o) => o.id === s.id)?.exclusive).label}" cannot be combined with other choices.` };
  }
  const message = selected.map((s) => (s.id === "other" ? s.text : s.text ? `${s.label} (${s.text})` : s.label)).join(", ");
  return { ok: true, message, selected };
}

// ─────────────────────────────────────────────────────────────────────
// Contract builders
// ─────────────────────────────────────────────────────────────────────

const RED_FLAG_TEXT = /facial (weakness|droop|paralysis)|face (is )?(drooping|numb)|can'?t breathe|difficulty breathing|unconscious|heavy bleeding/i;

const val = (s) => (s.id === "other" ? s.text : s.text ? `${s.label} (${s.text})` : s.label);
const list = (session, qid) => (patientAnswer(session, qid)?.selected || []).map(val);
const one = (session, qid) => list(session, qid)[0] || "";
const lc = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// ── Ear (unchanged) ──
export function buildEarContract(session, base) {
  const feel = list(session, "ear_feel").filter((x) => x !== "Nothing");
  const sideId = patientAnswer(session, "ear_side")?.selected?.[0]?.id;
  const laterality = sideId === "left" ? "left" : sideId === "right" ? "right" : sideId === "both" ? "bilateral" : "unknown";
  const days = one(session, "ear_days");
  const dischargeSel = patientAnswer(session, "ear_discharge")?.selected?.[0];
  const dischargeTxt = dischargeSel ? (dischargeSel.id === "none" ? "" : lc(dischargeSel.label.replace(/^Yes - /, ""))) : "";
  const recent = list(session, "ear_recent").filter((x) => x !== "Nothing");
  const med = patientAnswer(session, "ear_medication")?.selected?.[0];
  const buds = one(session, "ear_buds");
  const allergy = patientAnswer(session, "ear_allergy")?.selected?.[0];
  const conds = patientAnswer(session, "ear_condition")?.selected || [];
  const condItems = conds.filter((c) => c.id !== "none").map(val);

  const followUps = (session.conversation || [])
    .filter((x) => x.role === "patient" && x.kind === "followup")
    .map((x) => ({ q: x.question, a: x.message, qid: x.qid }));

  const associated = [];
  if (dischargeTxt) associated.push(`ear discharge (${dischargeTxt})`);
  if (recent.some((r) => /fever/i.test(r))) associated.push("fever");

  const qualifiers = [];
  if (days) qualifiers.push(`Duration reported: ${days}`);
  if (buds) qualifiers.push(`Ear bud use: ${buds}`);
  const exposures = recent.filter((r) => !/fever/i.test(r));
  if (exposures.length) qualifiers.push(`Recent: ${exposures.map(lc).join(", ")}`);
  followUps.forEach((f) => qualifiers.push(`${f.q} ${f.a}`));

  const redFlags = [];
  followUps.forEach((f) => {
    const def = EAR_FALLBACKS.find((x) => x.id === f.qid);
    if (def?.redFlagIfYes && /^yes$/i.test(f.a)) redFlags.push({ text: "Facial weakness or drooping reported", source: "patient_reported", confidence: "high" });
  });
  const typedText = (session.conversation || []).filter((x) => x.role === "patient").map((x) => x.message).join(" \n ");
  if (RED_FLAG_TEXT.test(typedText)) redFlags.push({ text: "Patient typed a possible urgent symptom — see answers", source: "patient_reported", confidence: "medium" });
  redFlags.forEach((r, i) => { r.id = `rf${i + 1}`; });

  const complaint = {
    id: "c1",
    text: feel.length ? `Ear: ${feel.map(lc).join(", ")}` : "Ear symptoms",
    laterality,
    duration: { value: null, unit: "unknown" },
    course: "unknown",
    severity: "unknown",
    associated_symptoms: associated,
    qualifiers,
    impact: "",
    treatment_tried: med
      ? med.id === "none" ? { status: "none", items: [] } : { status: "reported", items: [med.id === "paracetamol" ? "Paracetamol" : "Antibiotic"] }
      : { status: "unknown", items: [] },
    priority: "chief",
    source: "screening",
    confidence: "high",
  };

  const allergies = !allergy ? { status: "unknown", items: [] }
    : allergy.id === "no" ? { status: "none_reported", items: [] }
    : { status: "reported", items: [allergy.text || "Allergy reported (details not given)"] };
  const medical_history = !conds.length ? { status: "unknown", items: [] }
    : conds.some((c) => c.id === "none") ? { status: "none_reported", items: [] }
    : { status: "reported", items: condItems };

  const summary = [
    `Problem: ${complaint.text}`,
    laterality !== "unknown" ? `Side: ${laterality === "bilateral" ? "both ears" : laterality}` : "",
    days ? `Duration: ${days}` : "",
    dischargeSel ? `Discharge: ${dischargeSel.label}` : "",
    associated.some((x) => x === "fever") ? "Fever: reported in last few days" : "",
    med ? `Treatment tried: ${complaint.treatment_tried.items.join(", ") || "none"}` : "",
    buds ? `Ear bud use: ${buds}` : "",
    exposures.length ? `Recent: ${exposures.map(lc).join(", ")}` : "",
    allergy ? `Allergies: ${allergies.status === "none_reported" ? "none reported" : allergies.items.join(", ")}` : "",
    conds.length ? `Medical history: ${medical_history.status === "none_reported" ? "none reported" : condItems.join(", ")}` : "",
    ...followUps.map((f) => `Follow-up — ${f.q} ${f.a}`),
  ].filter(Boolean).join("\n");

  return {
    ...base,
    complaints: [complaint],
    allergies,
    medical_history,
    red_flags: redFlags,
    completion: { ...base.completion, complaints: true, allergies: !!allergy, medical_history: conds.length > 0 },
    summary,
    screening_status: redFlags.length ? "urgent" : "completed",
    data_quality_notes: ["structured_fixed_questions"],
  };
}

// ── Nose (new) ──
export function buildNoseContract(session, base) {
  const feel = list(session, "nose_feel").filter((x) => x !== "Nothing");
  const sideId = patientAnswer(session, "nose_side")?.selected?.[0]?.id;
  const laterality = sideId === "left" ? "left" : sideId === "right" ? "right" : sideId === "both" ? "bilateral" : "unknown";
  const days = one(session, "nose_days");
  const dischargeSel = patientAnswer(session, "nose_discharge")?.selected?.[0];
  const dischargeTxt = dischargeSel ? (dischargeSel.id === "none" ? "" : lc(dischargeSel.label.replace(/^Yes - /, ""))) : "";
  const recent = list(session, "nose_recent").filter((x) => x !== "Nothing");
  const med = patientAnswer(session, "nose_medication")?.selected?.[0];
  const allergy = patientAnswer(session, "nose_allergy")?.selected?.[0];
  const conds = patientAnswer(session, "nose_condition")?.selected || [];
  const condItems = conds.filter((c) => c.id !== "none").map(val);

  const followUps = (session.conversation || [])
    .filter((x) => x.role === "patient" && x.kind === "followup")
    .map((x) => ({ q: x.question, a: x.message, qid: x.qid }));

  const associated = [];
  if (dischargeTxt) associated.push(`nasal discharge (${dischargeTxt})`);
  if (recent.some((r) => /fever/i.test(r))) associated.push("fever");

  const qualifiers = [];
  if (days) qualifiers.push(`Duration reported: ${days}`);
  const exposures = recent.filter((r) => !/fever/i.test(r));
  if (exposures.length) qualifiers.push(`Recent: ${exposures.map(lc).join(", ")}`);
  followUps.forEach((f) => qualifiers.push(`${f.q} ${f.a}`));

  const redFlags = [];
  followUps.forEach((f) => {
    const def = NOSE_FALLBACKS.find((x) => x.id === f.qid);
    if (def?.redFlagIfYes && /^yes$/i.test(f.a)) redFlags.push({ text: "Nosebleed reported", source: "patient_reported", confidence: "high" });
  });
  const typedText = (session.conversation || []).filter((x) => x.role === "patient").map((x) => x.message).join(" \n ");
  if (RED_FLAG_TEXT.test(typedText)) redFlags.push({ text: "Patient typed a possible urgent symptom — see answers", source: "patient_reported", confidence: "medium" });
  redFlags.forEach((r, i) => { r.id = `rf${i + 1}`; });

  const complaint = {
    id: "c1",
    text: feel.length ? `Nose: ${feel.map(lc).join(", ")}` : "Nasal symptoms",
    laterality,
    duration: { value: null, unit: "unknown" },
    course: "unknown",
    severity: "unknown",
    associated_symptoms: associated,
    qualifiers,
    impact: "",
    treatment_tried: med
      ? med.id === "none" ? { status: "none", items: [] } : { status: "reported", items: [med.label.replace(/^Yes - /, "")] }
      : { status: "unknown", items: [] },
    priority: "chief",
    source: "screening",
    confidence: "high",
  };

  const allergies = !allergy ? { status: "unknown", items: [] }
    : allergy.id === "no" ? { status: "none_reported", items: [] }
    : { status: "reported", items: [allergy.text || "Allergy reported (details not given)"] };
  const medical_history = !conds.length ? { status: "unknown", items: [] }
    : conds.some((c) => c.id === "none") ? { status: "none_reported", items: [] }
    : { status: "reported", items: condItems };

  const summary = [
    `Problem: ${complaint.text}`,
    laterality !== "unknown" ? `Side: ${laterality === "bilateral" ? "both sides" : laterality}` : "",
    days ? `Duration: ${days}` : "",
    dischargeSel && dischargeSel.id !== "none" ? `Discharge: ${dischargeSel.label}` : "",
    associated.some((x) => x === "fever") ? "Fever: reported in last few days" : "",
    med && med.id !== "none" ? `Treatment tried: ${complaint.treatment_tried.items.join(", ")}` : "",
    exposures.length ? `Recent: ${exposures.map(lc).join(", ")}` : "",
    allergy ? `Allergies: ${allergies.status === "none_reported" ? "none reported" : allergies.items.join(", ")}` : "",
    conds.length ? `Medical history: ${medical_history.status === "none_reported" ? "none reported" : condItems.join(", ")}` : "",
    ...followUps.map((f) => `Follow-up — ${f.q} ${f.a}`),
  ].filter(Boolean).join("\n");

  return {
    ...base,
    complaints: [complaint],
    allergies,
    medical_history,
    red_flags: redFlags,
    completion: { ...base.completion, complaints: true, allergies: !!allergy, medical_history: conds.length > 0 },
    summary,
    screening_status: redFlags.length ? "urgent" : "completed",
    data_quality_notes: ["structured_fixed_questions"],
  };
}

// ── Throat (new) ──
export function buildThroatContract(session, base) {
  const feel = list(session, "throat_feel").filter((x) => x !== "Nothing");
  const days = one(session, "throat_days");
  const feverSel = patientAnswer(session, "throat_fever")?.selected?.[0];
  const med = patientAnswer(session, "throat_medication")?.selected?.[0];
  const allergy = patientAnswer(session, "throat_allergy")?.selected?.[0];
  const conds = patientAnswer(session, "throat_condition")?.selected || [];
  const condItems = conds.filter((c) => c.id !== "none").map(val);

  const followUps = (session.conversation || [])
    .filter((x) => x.role === "patient" && x.kind === "followup")
    .map((x) => ({ q: x.question, a: x.message, qid: x.qid }));

  const associated = [];
  if (feverSel && feverSel.id === "yes") associated.push("fever");

  const qualifiers = [];
  if (days) qualifiers.push(`Duration reported: ${days}`);
  followUps.forEach((f) => qualifiers.push(`${f.q} ${f.a}`));

  const redFlags = [];
  followUps.forEach((f) => {
    const def = THROAT_FALLBACKS.find((x) => x.id === f.qid);
    if (def?.redFlagIfYes && /^yes$/i.test(f.a)) redFlags.push({ text: "Blood in saliva / cough reported", source: "patient_reported", confidence: "high" });
  });
  const typedText = (session.conversation || []).filter((x) => x.role === "patient").map((x) => x.message).join(" \n ");
  if (RED_FLAG_TEXT.test(typedText)) redFlags.push({ text: "Patient typed a possible urgent symptom — see answers", source: "patient_reported", confidence: "medium" });
  redFlags.forEach((r, i) => { r.id = `rf${i + 1}`; });

  const complaint = {
    id: "c1",
    text: feel.length ? `Throat: ${feel.map(lc).join(", ")}` : "Throat symptoms",
    laterality: "unknown",
    duration: { value: null, unit: "unknown" },
    course: "unknown",
    severity: "unknown",
    associated_symptoms: associated,
    qualifiers,
    impact: "",
    treatment_tried: med
      ? med.id === "none" ? { status: "none", items: [] } : { status: "reported", items: [med.label.replace(/^Yes - /, "")] }
      : { status: "unknown", items: [] },
    priority: "chief",
    source: "screening",
    confidence: "high",
  };

  const allergies = !allergy ? { status: "unknown", items: [] }
    : allergy.id === "no" ? { status: "none_reported", items: [] }
    : { status: "reported", items: [allergy.text || "Allergy reported (details not given)"] };
  const medical_history = !conds.length ? { status: "unknown", items: [] }
    : conds.some((c) => c.id === "none") ? { status: "none_reported", items: [] }
    : { status: "reported", items: condItems };

  const summary = [
    `Problem: ${complaint.text}`,
    days ? `Duration: ${days}` : "",
    feverSel ? `Fever: ${feverSel.label}` : "",
    med && med.id !== "none" ? `Treatment tried: ${complaint.treatment_tried.items.join(", ")}` : "",
    allergy ? `Allergies: ${allergies.status === "none_reported" ? "none reported" : allergies.items.join(", ")}` : "",
    conds.length ? `Medical history: ${medical_history.status === "none_reported" ? "none reported" : condItems.join(", ")}` : "",
    ...followUps.map((f) => `Follow-up — ${f.q} ${f.a}`),
  ].filter(Boolean).join("\n");

  return {
    ...base,
    complaints: [complaint],
    allergies,
    medical_history,
    red_flags: redFlags,
    completion: { ...base.completion, complaints: true, allergies: !!allergy, medical_history: conds.length > 0 },
    summary,
    screening_status: redFlags.length ? "urgent" : "completed",
    data_quality_notes: ["structured_fixed_questions"],
  };
}

// ── GM / generic / unknown non-ENT (new) ──
export function buildDeterministicContract(session, base) {
  // Collect answers keyed by qid
  const answers = {};
  for (const x of session.conversation || []) {
    if (x.role !== "patient") continue;
    if (x.qid) answers[x.qid] = {
      selected: Array.isArray(x.selected) ? x.selected : [],
      message: x.message || "",
      question: x.question || "",
    };
  }

  const redFlags = [];
  const allergies = { status: "unknown", items: [] };
  const medicalHistory = { status: "unknown", items: [] };
  const currentMeds = { status: "unknown", items: [] };

  // ── Chief complaint ──
  const chiefText = (() => {
    const pc = answers["primary_complaint"];
    if (pc) {
      const parts = pc.selected.map((s) => (s.id === "other" ? s.text : s.label)).filter(Boolean);
      return parts.join(", ");
    }
    const hi = answers["health_issue"];
    if (hi) return hi.message.trim();
    const cc = answers["chief_complaint"];
    if (cc) {
      const s = cc.selected[0];
      return s ? (s.id === "other" ? s.text : s.label) : "";
    }
    return "";
  })();

  // ── Duration ──
  const durationText = (() => {
    const d = answers["symptom_duration"] || answers["symptom_since"];
    if (!d) return "";
    const s = d.selected[0];
    return s ? s.label : "";
  })();

  // ── Trend ──
  const trendText = (() => {
    const t = answers["symptom_trend"];
    if (!t) return "";
    const s = t.selected[0];
    return s ? s.label : "";
  })();

  // ── Associated symptoms (multi-branch) ──
  const associated = [];
  for (const qid of [
    "fever_associated_symptoms", "upper_resp_symptoms",
    "urinary_sensations", "urine_appearance", "urinary_pain_location",
    "stool_characteristics", "gi_associated_symptoms", "bowel_frequency",
    "cough_type", "sputum_color",
  ]) {
    const a = answers[qid];
    if (!a) continue;
    a.selected.forEach((s) => {
      if (s.id === "none") return;
      const v = s.id === "other" ? s.text : s.label;
      if (v && !associated.includes(v)) associated.push(v);
    });
  }

  // ── Qualifiers ──
  const qualifiers = [];
  if (durationText) qualifiers.push(`Duration: ${durationText}`);
  if (trendText) qualifiers.push(`Trend: ${trendText}`);
  for (const qid of ["temp_range", "fever_pattern"]) {
    const a = answers[qid];
    if (!a || !a.selected.length) continue;
    const v = a.selected[0].id === "other" ? a.selected[0].text : a.selected[0].label;
    if (v) qualifiers.push(v);
  }

  // ── Allergies ──
  const al = answers["drug_allergies_exist"];
  if (al) {
    const s = al.selected[0];
    if (s) {
      if (s.id === "false") allergies.status = "none_reported";
      else if (s.id === "true") {
        allergies.status = "reported";
        allergies.items = [s.text || "Allergy reported (details not given)"];
      }
    }
  }

  // ── Chronic conditions ──
  const cc = answers["chronic_conditions"];
  if (cc) {
    const ids = cc.selected.map((s) => s.id);
    const items = cc.selected.filter((s) => s.id !== "none").map((s) => s.label);
    if (ids.includes("none")) medicalHistory.status = "none_reported";
    else if (items.length) { medicalHistory.status = "reported"; medicalHistory.items = items; }
  }
  // Generic: medical_history multi (bp/diabetes/asthma/heart/thyroid/none)
  const mh = answers["medical_history"];
  if (mh && medicalHistory.status === "unknown") {
    const ids = mh.selected.map((s) => s.id);
    const items = mh.selected.filter((s) => s.id !== "none").map((s) => s.label);
    if (ids.includes("none")) medicalHistory.status = "none_reported";
    else if (items.length) { medicalHistory.status = "reported"; medicalHistory.items = items; }
  }

  // ── Current medications ──
  const am = answers["active_medications"];
  if (am) {
    const ids = am.selected.map((s) => s.id);
    const items = am.selected.filter((s) => s.id !== "none").map((s) => s.label);
    if (ids.includes("none")) currentMeds.status = "none_reported";
    else if (items.length) { currentMeds.status = "reported"; currentMeds.items = items; }
  }
  // Generic: current_medication text
  const cm = answers["current_medication"];
  if (cm && currentMeds.status === "unknown") {
    const t = (cm.message || "").trim();
    if (t && !/^(none|no|nil|nothing|not taking)\b/i.test(t)) {
      currentMeds.status = "reported";
      currentMeds.items = [t];
    } else if (t) {
      currentMeds.status = "none_reported";
    }
  }

  // ── Red flags ──
  const rf = answers["red_flag_symptoms"];
  if (rf) {
    const flags = rf.selected.filter((s) => s.id !== "none");
    flags.forEach((s, i) => {
      redFlags.push({ id: `rf${i + 1}`, text: s.label, source: "patient_reported", confidence: "high" });
    });
  }

  // ── Build complaint ──
  const complaints = [];
  if (chiefText) {
    complaints.push({
      id: "c1",
      text: chiefText,
      laterality: "unknown",
      duration: { value: null, unit: "unknown" },
      course: "unknown",
      severity: "unknown",
      associated_symptoms: associated,
      qualifiers,
      impact: "",
      treatment_tried: { status: "unknown", items: [] },
      priority: "chief",
      source: "patient_reported",
      confidence: "high",
    });
  }

  // ── Summary ──
  const summaryBits = [];
  if (chiefText) summaryBits.push(chiefText);
  if (durationText) summaryBits.push(`for ${durationText}`);
  if (trendText) summaryBits.push(trendText.toLowerCase());
  if (associated.length) summaryBits.push(associated.join(", "));
  if (allergies.status === "none_reported") summaryBits.push("no known drug allergy");
  else if (allergies.items.length) summaryBits.push("allergies: " + allergies.items.join(", "));
  if (medicalHistory.items.length) summaryBits.push(medicalHistory.items.join("; "));
  if (currentMeds.items.length) summaryBits.push("on: " + currentMeds.items.join(", "));

  return {
    ...base,
    complaints,
    allergies,
    medical_history: medicalHistory,
    current_medications: currentMeds,
    red_flags: redFlags,
    completion: {
      ...base.completion,
      complaints: complaints.length > 0,
      allergies: allergies.status !== "unknown",
      medical_history: medicalHistory.status !== "unknown",
      current_medications: currentMeds.status !== "unknown",
    },
    summary: summaryBits.join(", ") || base.summary,
    screening_status: redFlags.length ? "urgent" : "completed",
  };
}
