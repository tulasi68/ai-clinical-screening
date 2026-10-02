// GM fixed questions (the "9 fixed" you specified).
// Each: { id, kind, type, text, text_kn, options[]?, showIf?(answerHelper) }
//   type   — single | multi | yes_no | text
//   showIf — optional predicate over answerHelper(session)
//            answerHelper exposes .has(qid, optId) and .ids(qid)
// Questions are walked in array order; failing showIf → skipped.

export const GM_QUESTIONS = [
  // ── 1. Primary complaint ────────────────────────────────────────
  {
    id: 'primary_complaint',
    kind: 'fixed',
    type: 'multi',
    text: "What is the main reason for today's visit? (choose all that apply)",
    text_kn: 'ಇಂದಿನ ಭೇಟಿಗೆ ಮುಖ್ಯ ಕಾರಣವೇನು? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)',
    options: [
      { id: 'fever_chills',   label: 'Fever / Chills',                 label_kn: 'ಜ್ವರ / ಚಳಿ' },
      { id: 'cough_cold',     label: 'Cough / Cold / Sore Throat',     label_kn: 'ಕೆಮ್ಮು / ಶೀತ / ಗಂಟಲು ನೋವು' },
      { id: 'body_pain',      label: 'Body Aches / Joint Pain',        label_kn: 'ದೇಹ ನೋವು / ಕೀಲು ನೋವು' },
      { id: 'urinary_issues', label: 'Burning Urine / Urinary Issues', label_kn: 'ಮೂತ್ರದಲ್ಲಿ ಉರಿ / ಮೂತ್ರ ಸಮಸ್ಯೆ' },
      { id: 'gi_issues',      label: 'Constipation / Stomach Issues',  label_kn: 'ಮಲಬದ್ಧತೆ / ಹೊಟ್ಟೆ ಸಮಸ್ಯೆ' },
      { id: 'fatigue',        label: 'Fatigue / Weakness',             label_kn: 'ಆಯಾಸ / ದೌರ್ಬಲ್ಯ' },
      { id: 'other',          label: 'Other',                          label_kn: 'ಇತರೆ', text: 'required' },
    ],
  },

  // ── 2. Duration ─────────────────────────────────────────────────
  {
    id: 'symptom_duration',
    kind: 'fixed',
    type: 'single',
    text: 'How long have you had these symptoms?',
    text_kn: 'ಈ ಲಕ್ಷಣಗಳು ಎಷ್ಟು ದಿನಗಳಿಂದ ಇವೆ?',
    options: [
      { id: 'lt_24h',     label: 'Less than 24 hours', label_kn: '೨೪ ಗಂಟೆಗಳಿಗಿಂತ ಕಡಿಮೆ' },
      { id: '1_3_days',   label: '1 to 3 days',        label_kn: '೧ ರಿಂದ ೩ ದಿನ' },
      { id: '4_7_days',   label: '4 to 7 days',        label_kn: '೪ ರಿಂದ ೭ ದಿನ' },
      { id: '1_2_weeks',  label: '1 to 2 weeks',       label_kn: '೧ ರಿಂದ ೨ ವಾರ' },
      { id: 'gt_2_weeks', label: 'More than 2 weeks',  label_kn: '೨ ವಾರಗಳಿಗಿಂತ ಹೆಚ್ಚು' },
    ],
  },

  // ── 3. Trend ────────────────────────────────────────────────────
  {
    id: 'symptom_trend',
    kind: 'fixed',
    type: 'single',
    text: 'Compared to when it started, your symptoms are:',
    text_kn: 'ಆರಂಭಕ್ಕೆ ಹೋಲಿಸಿದರೆ, ನಿಮ್ಮ ಲಕ್ಷಣಗಳು:',
    options: [
      { id: 'rapidly_worsening', label: 'Getting rapidly worse',     label_kn: 'ವೇಗವಾಗಿ ಹದಗೆಡುತ್ತಿದೆ' },
      { id: 'slowly_worsening',  label: 'Getting slowly worse',      label_kn: 'ನಿಧಾನವಾಗಿ ಹದಗೆಡುತ್ತಿದೆ' },
      { id: 'stable',            label: 'Staying about the same',    label_kn: 'ಸುಮಾರು ಒಂದೇ ರೀತಿ ಇದೆ' },
      { id: 'improving',         label: 'Gradually improving',       label_kn: 'ಕ್ರಮೇಣ ಸುಧಾರಿಸುತ್ತಿದೆ' },
      { id: 'fluctuating',       label: 'Coming and going in waves', label_kn: 'ಅಲೆಗಳಲ್ಲಿ ಬರುತ್ತಿದೆ ಮತ್ತು ಹೋಗುತ್ತಿದೆ' },
    ],
  },

  // ── 4. Fever branch ─────────────────────────────────────────────
  {
    id: 'temp_range',
    kind: 'fixed',
    type: 'single',
    text: 'Highest measured temperature (if checked)',
    text_kn: 'ಅಳೆದ ಗರಿಷ್ಠ ತಾಪಮಾನ (ಪರೀಕ್ಷಿಸಿದರೆ)',
    showIf: (a) => a.has('primary_complaint', 'fever_chills'),
    options: [
      { id: 'unmeasured', label: 'Have not measured with a thermometer', label_kn: 'ಥರ್ಮಾಮೀಟರ್‌ನಿಂದ ಅಳೆಯಲಿಲ್ಲ' },
      { id: 'mild',       label: 'Mild (99.0°F – 100.4°F)',              label_kn: 'ಸೌಮ್ಯ (೯೯.೦°F – ೧೦೦.೪°F)' },
      { id: 'moderate',   label: 'Moderate (100.5°F – 102.0°F)',         label_kn: 'ಮಧ್ಯಮ (೧೦೦.೫°F – ೧೦೨.೦°F)' },
      { id: 'high',       label: 'High (Above 102.0°F)',                 label_kn: 'ಹೆಚ್ಚು (೧೦೨.೦°F ಗಿಂತ ಹೆಚ್ಚು)' },
    ],
  },
  {
    id: 'fever_pattern',
    kind: 'fixed',
    type: 'single',
    text: 'Fever pattern',
    text_kn: 'ಜ್ವರದ ಮಾದರಿ',
    showIf: (a) => a.has('primary_complaint', 'fever_chills'),
    options: [
      { id: 'continuous',             label: 'Continuous all day',                          label_kn: 'ಇಡೀ ದಿನ ನಿರಂತರ' },
      { id: 'spikes',                 label: 'Comes and goes in spikes',                    label_kn: 'ಏರಿಳಿತಗಳಲ್ಲಿ ಬರುತ್ತದೆ' },
      { id: 'paracetamol_responsive', label: 'Responds to Paracetamol, recurs in 4-6 hrs',  label_kn: 'ಪ್ಯಾರಸಿಟಮಾಲ್‌ಗೆ ಪ್ರತಿಕ್ರಿಯಿಸುತ್ತದೆ, ೪-೬ ಗಂಟೆಗಳಲ್ಲಿ ಮತ್ತೆ ಬರುತ್ತದೆ' },
    ],
  },
  {
    id: 'fever_associated_symptoms',
    kind: 'fixed',
    type: 'multi',
    text: 'Any of these along with the fever? (choose all that apply)',
    text_kn: 'ಜ್ವರದ ಜೊತೆಗೆ ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಇದೆಯೇ?',
    showIf: (a) => a.has('primary_complaint', 'fever_chills'),
    options: [
      { id: 'chills',                 label: 'Chills or shivering',                 label_kn: 'ಚಳಿ ಅಥವಾ ನಡುಕ' },
      { id: 'sweating',               label: 'Heavy sweating when fever breaks',    label_kn: 'ಜ್ವರ ಇಳಿದಾಗ ತೀವ್ರ ಬೆವರುವಿಕೆ' },
      { id: 'retro_orbital_headache', label: 'Severe headache behind the eyes',     label_kn: 'ಕಣ್ಣಿನ ಹಿಂದೆ ತೀವ್ರ ತಲೆನೋವು' },
      { id: 'severe_bodyache',        label: 'Severe muscle/joint pain',            label_kn: 'ತೀವ್ರ ಸ್ನಾಯು/ಕೀಲು ನೋವು' },
      { id: 'rash',                   label: 'Skin rash or red spots',              label_kn: 'ಚರ್ಮದ ದದ್ದು ಅಥವಾ ಕೆಂಪು ಚುಕ್ಕೆಗಳು' },
      { id: 'none',                   label: 'None of these',                       label_kn: 'ಇವುಗಳಲ್ಲಿ ಯಾವುದೂ ಇಲ್ಲ', exclusive: true },
    ],
  },

  // ── 5. Cough branch ─────────────────────────────────────────────
  {
    id: 'cough_type',
    kind: 'fixed',
    type: 'single',
    text: 'What kind of cough?',
    text_kn: 'ಯಾವ ರೀತಿಯ ಕೆಮ್ಮು?',
    showIf: (a) => a.has('primary_complaint', 'cough_cold'),
    options: [
      { id: 'dry', label: 'Dry cough (no phlegm)',   label_kn: 'ಒಣ ಕೆಮ್ಮು (ಕಫ ಇಲ್ಲ)' },
      { id: 'wet', label: 'Wet cough (with phlegm)', label_kn: 'ಒದ್ದೆ ಕೆಮ್ಮು (ಕಫ ಜೊತೆ)' },
    ],
  },
  {
    id: 'sputum_color',
    kind: 'fixed',
    type: 'single',
    text: 'Phlegm / sputum colour',
    text_kn: 'ಕಫದ ಬಣ್ಣ',
    showIf: (a) => a.has('cough_type', 'wet'),
    options: [
      { id: 'clear_white',  label: 'Clear or white',          label_kn: 'ಸ್ಪಷ್ಟ ಅಥವಾ ಬಿಳಿ' },
      { id: 'yellow_green', label: 'Yellow or thick green',   label_kn: 'ಹಳದಿ ಅಥವಾ ದಪ್ಪ ಹಸಿರು' },
      { id: 'rust',         label: 'Brownish or rust-colored', label_kn: 'ಕಂದು ಅಥವಾ ತುಕ್ಕು ಬಣ್ಣ' },
      { id: 'blood_tinged', label: 'Traces of blood',         label_kn: 'ರಕ್ತದ ಕುರುಹುಗಳು' },
    ],
  },
  {
    id: 'upper_resp_symptoms',
    kind: 'fixed',
    type: 'multi',
    text: 'Any of these upper respiratory symptoms? (choose all that apply)',
    text_kn: 'ಈ ಮೇಲ್ಭಾಗದ ಶ್ವಾಸನಾಳದ ಲಕ್ಷಣಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಇದೆಯೇ?',
    showIf: (a) => a.has('primary_complaint', 'cough_cold'),
    options: [
      { id: 'sore_throat', label: 'Sore throat / painful swallowing', label_kn: 'ಗಂಟಲು ನೋವು / ನುಂಗಲು ಕಷ್ಟ' },
      { id: 'rhinorrhea',  label: 'Runny or blocked nose',            label_kn: 'ಮೂಗು ಸೋರುವುದು ಅಥವಾ ಮುಚ್ಚುವುದು' },
      { id: 'sneezing',    label: 'Sneezing',                         label_kn: 'ಸೀನುವುದು' },
      { id: 'anosmia',     label: 'Loss of smell or taste',           label_kn: 'ವಾಸನೆ ಅಥವಾ ರುಚಿ ಕಳೆದುಕೊಳ್ಳುವುದು' },
      { id: 'ear_pain',    label: 'Ear congestion or pain',           label_kn: 'ಕಿವಿ ಕಟ್ಟುವುದು ಅಥವಾ ನೋವು' },
      { id: 'none',        label: 'None of these',                    label_kn: 'ಇವುಗಳಲ್ಲಿ ಯಾವುದೂ ಇಲ್ಲ', exclusive: true },
    ],
  },

  // ── 6. Urinary branch ───────────────────────────────────────────
  {
    id: 'urinary_sensations',
    kind: 'fixed',
    type: 'multi',
    text: 'Which urinary symptoms? (choose all that apply)',
    text_kn: 'ಯಾವ ಮೂತ್ರ ಲಕ್ಷಣಗಳು? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)',
    showIf: (a) => a.has('primary_complaint', 'urinary_issues'),
    options: [
      { id: 'dysuria',             label: 'Burning while urinating',         label_kn: 'ಮೂತ್ರ ವಿಸರ್ಜಿಸುವಾಗ ಉರಿ' },
      { id: 'frequency',           label: 'Urinating more frequently',       label_kn: 'ಹೆಚ್ಚು ಬಾರಿ ಮೂತ್ರ ವಿಸರ್ಜನೆ' },
      { id: 'urgency',             label: 'Sudden intense urge',              label_kn: 'ಇದ್ದಕ್ಕಿದ್ದಂತೆ ತೀವ್ರ ಆಸೆ' },
      { id: 'incomplete_emptying', label: 'Feeling of incomplete emptying',   label_kn: 'ಅಪೂರ್ಣ ಖಾಲಿಯಾದ ಅನುಭವ' },
      { id: 'hesitancy',           label: 'Difficulty starting flow',         label_kn: 'ಮೂತ್ರ ಪ್ರಾರಂಭಿಸಲು ಕಷ್ಟ' },
    ],
  },
  {
    id: 'urine_appearance',
    kind: 'fixed',
    type: 'single',
    text: 'Urine appearance',
    text_kn: 'ಮೂತ್ರದ ನೋಟ',
    showIf: (a) => a.has('primary_complaint', 'urinary_issues'),
    options: [
      { id: 'normal',     label: 'Normal / Clear yellow',      label_kn: 'ಸಾಮಾನ್ಯ / ಸ್ಪಷ್ಟ ಹಳದಿ' },
      { id: 'cloudy',     label: 'Cloudy or hazy',             label_kn: 'ಮೋಡದಂತೆ ಅಥವಾ ಮಂಜಿನಂತೆ' },
      { id: 'foul_smell', label: 'Strong / foul odour',        label_kn: 'ತೀವ್ರ / ದುರ್ವಾಸನೆ' },
      { id: 'hematuria',  label: 'Dark tea-coloured or blood', label_kn: 'ಕಪ್ಪು ಟೀ ಬಣ್ಣ ಅಥವಾ ರಕ್ತ' },
    ],
  },
  {
    id: 'urinary_pain_location',
    kind: 'fixed',
    type: 'multi',
    text: 'Where is the pain? (choose all that apply)',
    text_kn: 'ನೋವು ಎಲ್ಲಿ ಇದೆ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)',
    showIf: (a) => a.has('primary_complaint', 'urinary_issues'),
    options: [
      { id: 'suprapubic', label: 'Lower abdomen / pelvic pain',           label_kn: 'ಕೆಳ ಹೊಟ್ಟೆ / ಸೊಂಟದ ನೋವು' },
      { id: 'flank_pain', label: 'One-sided flank or lower back pain',    label_kn: 'ಒಂದು ಬದಿಯ ಸೊಂಟ ಅಥವಾ ಬೆನ್ನಿನ ನೋವು' },
      { id: 'none',       label: 'No localized pain',                     label_kn: 'ನಿರ್ದಿಷ್ಟ ನೋವು ಇಲ್ಲ', exclusive: true },
    ],
  },

  // ── 7. GI branch ────────────────────────────────────────────────
  {
    id: 'bowel_frequency',
    kind: 'fixed',
    type: 'single',
    text: 'Bowel movement frequency',
    text_kn: 'ಮಲ ವಿಸರ್ಜನೆಯ ಆವರ್ತನ',
    showIf: (a) => a.has('primary_complaint', 'gi_issues'),
    options: [
      { id: '2_days',    label: 'No bowel movement in 2 days',      label_kn: '೨ ದಿನಗಳಿಂದ ಮಲ ವಿಸರ್ಜನೆ ಇಲ್ಲ' },
      { id: '3_4_days',  label: 'No bowel movement in 3 to 4 days', label_kn: '೩ ರಿಂದ ೪ ದಿನಗಳಿಂದ ಇಲ್ಲ' },
      { id: 'gt_5_days', label: '5+ days without bowel movement',   label_kn: '೫+ ದಿನಗಳಿಂದ ಇಲ್ಲ' },
    ],
  },
  {
    id: 'stool_characteristics',
    kind: 'fixed',
    type: 'multi',
    text: 'Stool characteristics (choose all that apply)',
    text_kn: 'ಮಲದ ಗುಣಲಕ್ಷಣಗಳು (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)',
    showIf: (a) => a.has('primary_complaint', 'gi_issues'),
    options: [
      { id: 'lumpy_hard',         label: 'Hard, dry, or lump-like',             label_kn: 'ಗಟ್ಟಿ, ಒಣ, ಅಥವಾ ಉಂಡೆಯಂತಹ' },
      { id: 'straining',          label: 'Straining during movements',          label_kn: 'ವಿಸರ್ಜನೆಯ ಸಮಯದಲ್ಲಿ ಒತ್ತಡ' },
      { id: 'blockage',           label: 'Sensation of blockage / incomplete',  label_kn: 'ತಡೆ ಅಥವಾ ಅಪೂರ್ಣ ಅನುಭವ' },
      { id: 'painful_defecation', label: 'Pain or tearing during evacuation',   label_kn: 'ವಿಸರ್ಜನೆಯ ಸಮಯದಲ್ಲಿ ನೋವು' },
    ],
  },
  {
    id: 'gi_associated_symptoms',
    kind: 'fixed',
    type: 'multi',
    text: 'Any of these along with stomach issues? (choose all that apply)',
    text_kn: 'ಹೊಟ್ಟೆ ಸಮಸ್ಯೆಗಳ ಜೊತೆಗೆ ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಇದೆಯೇ?',
    showIf: (a) => a.has('primary_complaint', 'gi_issues'),
    options: [
      { id: 'bloating',        label: 'Abdominal bloating or distension', label_kn: 'ಹೊಟ್ಟೆ ಉಬ್ಬರ' },
      { id: 'cramping',        label: 'Cramping / stomach pain',          label_kn: 'ಸೆಳೆತ / ಹೊಟ್ಟೆ ನೋವು' },
      { id: 'nausea_vomiting', label: 'Nausea or vomiting',               label_kn: 'ವಾಂತಿ ಅಥವಾ ಬೇನೆ' },
      { id: 'acidity',         label: 'Severe acidity / heartburn',       label_kn: 'ತೀವ್ರ ಆಮ್ಲತೆ / ಎದೆಯುರಿ' },
      { id: 'anorexia',        label: 'Loss of appetite',                 label_kn: 'ಹಸಿವಿನ ಕೊರತೆ' },
    ],
  },

  // ── 8. Red flags (cross-branch, always asked) ───────────────────
  {
    id: 'red_flag_symptoms',
    kind: 'fixed',
    type: 'multi',
    text: 'Are you experiencing any of these severe symptoms right now?',
    text_kn: 'ಈ ಕಠಿಣ ಲಕ್ಷಣಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಈಗ ಇದೆಯೇ?',
    options: [
      { id: 'dyspnea',              label: 'Shortness of breath or difficulty breathing', label_kn: 'ಉಸಿರಾಟದ ತೊಂದರೆ' },
      { id: 'chest_pain',           label: 'Chest pain, tightness or pressure',           label_kn: 'ಎದೆ ನೋವು, ಬಿಗಿತ ಅಥವಾ ಒತ್ತಡ' },
      { id: 'intractable_vomiting', label: 'Unable to keep fluids down',                  label_kn: 'ದ್ರವಗಳನ್ನು ಹಿಡಿದಿಟ್ಟುಕೊಳ್ಳಲು ಸಾಧ್ಯವಿಲ್ಲ' },
      { id: 'bleeding',             label: 'Blood in vomit, stool, or coughing up blood', label_kn: 'ವಾಂತಿ, ಮಲ ಅಥವಾ ಕೆಮ್ಮಿನಲ್ಲಿ ರಕ್ತ' },
      { id: 'altered_sensorium',    label: 'Extreme dizziness, fainting or confusion',    label_kn: 'ತೀವ್ರ ತಲೆಸುತ್ತು, ಮೂರ್ಛೆ ಅಥವಾ ಗೊಂದಲ' },
      { id: 'uncontrolled_fever',   label: 'High fever not coming down',                  label_kn: 'ಇಳಿಯದ ಹೆಚ್ಚಿನ ಜ್ವರ' },
      { id: 'none',                 label: 'None of these',                                label_kn: 'ಇವುಗಳಲ್ಲಿ ಯಾವುದೂ ಇಲ್ಲ', exclusive: true },
    ],
  },

  // ── 9. Chronic conditions ───────────────────────────────────────
  {
    id: 'chronic_conditions',
    kind: 'fixed',
    type: 'multi',
    text: 'Do you have any of these ongoing conditions? (choose all that apply)',
    text_kn: 'ಈ ನಿರಂತರ ಪರಿಸ್ಥಿತಿಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಇದೆಯೇ?',
    options: [
      { id: 'hypertension',  label: 'High Blood Pressure',           label_kn: 'ಹೆಚ್ಚು ರಕ್ತದೊತ್ತಡ' },
      { id: 'diabetes',      label: 'Diabetes',                      label_kn: 'ಮಧುಮೇಹ' },
      { id: 'asthma_copd',   label: 'Asthma / Chronic Lung Disease', label_kn: 'ಆಸ್ತಮಾ / ದೀರ್ಘಕಾಲಿಕ ಶ್ವಾಸಕೋಶ ರೋಗ' },
      { id: 'ckd',           label: 'Kidney Disease',                label_kn: 'ಮೂತ್ರಪಿಂಡ ರೋಗ' },
      { id: 'liver_disease', label: 'Liver Disease',                 label_kn: 'ಯಕೃತ್ತಿನ ರೋಗ' },
      { id: 'cad',           label: 'Heart Disease',                 label_kn: 'ಹೃದಯ ರೋಗ' },
      { id: 'thyroid',       label: 'Thyroid Disorder',              label_kn: 'ಥೈರಾಯ್ಡ್ ಸಮಸ್ಯೆ' },
      { id: 'pregnancy',     label: 'Pregnant / Breastfeeding',      label_kn: 'ಗರ್ಭಿಣಿ / ಎದೆಹಾಲುಣಿಸುವ' },
      { id: 'none',          label: 'None',                           label_kn: 'ಯಾವುದೂ ಇಲ್ಲ', exclusive: true },
    ],
  },

  // ── 10. Current medications ─────────────────────────────────────
  {
    id: 'active_medications',
    kind: 'fixed',
    type: 'multi',
    text: 'Are you currently taking any medications?',
    text_kn: 'ನೀವು ಈಗ ಯಾವುದೇ ಔಷಧ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದೀರಾ?',
    options: [
      { id: 'chronic_meds', label: 'Regular chronic medications',          label_kn: 'ನಿಯಮಿತ ದೀರ್ಘಕಾಲಿಕ ಔಷಧಗಳು' },
      { id: 'otc_meds',     label: 'Self-medication / OTC for this issue', label_kn: 'ಈ ಸಮಸ್ಯೆಗೆ ಸ್ವಯಂ-ಔಷಧಿ / ಓಟಿಸಿ' },
      { id: 'none',         label: 'Not taking any medications',            label_kn: 'ಯಾವುದೇ ಔಷಧ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿಲ್ಲ', exclusive: true },
    ],
  },

  // ── 11. Drug allergies ──────────────────────────────────────────
  {
    id: 'drug_allergies_exist',
    kind: 'fixed',
    type: 'single',
    text: 'Do you have any known drug allergies?',
    text_kn: 'ನಿಮಗೆ ಔಷಧಗಳಿಗೆ ಯಾವುದೇ ಅಲರ್ಜಿ ಇದೆಯೇ?',
    options: [
      { id: 'false', label: 'No known drug allergies (NKDA)', label_kn: 'ಯಾವುದೇ ಅಲರ್ಜಿ ಇಲ್ಲ' },
      { id: 'true',  label: 'Yes',                             label_kn: 'ಹೌದು', text: 'required' },
    ],
  },
];
