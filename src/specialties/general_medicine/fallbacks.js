// Deterministic follow-ups when Sarvam is unavailable.
// `when(answerHelper)` gates a fallback on the patient's answers.

export const GM_FALLBACKS = [
  {
    id: 'gm_fb_travel',
    text: 'Have you travelled outside the city in the last 14 days?',
    text_kn: 'ಕಳೆದ ೧೪ ದಿನಗಳಲ್ಲಿ ನೀವು ನಗರದಿಂದ ಹೊರಗೆ ಪ್ರಯಾಣಿಸಿದ್ದೀರಾ?',
    type: 'yes_no',
  },
  {
    id: 'gm_fb_contact',
    text: 'Has anyone at home been sick with similar symptoms?',
    text_kn: 'ಮನೆಯಲ್ಲಿ ಯಾರಿಗಾದರೂ ಇದೇ ರೀತಿಯ ಲಕ್ಷಣಗಳು ಇದೆಯೇ?',
    type: 'yes_no',
  },
  {
    id: 'gm_fb_food',
    text: 'Have you eaten street or outside food in the last 3 days?',
    text_kn: 'ಕಳೆದ ೩ ದಿನಗಳಲ್ಲಿ ಹೊರಗಿನ ಅಥವಾ ಬೀದಿ ಆಹಾರ ಸೇವಿಸಿದ್ದೀರಾ?',
    type: 'yes_no',
  },
  {
    id: 'gm_fb_mosquito',
    text: 'Any mosquito bites or Dengue cases nearby?',
    text_kn: 'ಸೊಳ್ಳೆ ಕಡಿತ ಅಥವಾ ಹತ್ತಿರದಲ್ಲಿ ಡೆಂಗ್ಯೂ ಪ್ರಕರಣಗಳಿವೆಯೇ?',
    type: 'yes_no',
  },
];

export const GM_FALLBACKS_BY_ID = Object.fromEntries(GM_FALLBACKS.map((f) => [f.id, f]));
