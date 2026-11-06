/**
 * Children's data handling under DPDP s.9 (verifiable parental/guardian consent).
 * Age under 18 requires guardian consent before screening proceeds.
 */
export const CHILD_AGE_THRESHOLD = 18;
export const GUARDIAN_CONSENT_PURPOSE = 'guardian_consent_for_minor_clinical_screening';
export const GUARDIAN_NOTICE_VERSION = 'guardian-notice-2026-11-v1';

export function isMinor(age) {
  const n = Number(age);
  return Number.isFinite(n) && n >= 0 && n < CHILD_AGE_THRESHOLD;
}

export function guardianConsentRequired(patient) {
  return isMinor(patient?.age);
}

export function guardianNoticeText(lang = 'en') {
  const texts = {
    en: 'This patient is under 18. Screening may continue only with verifiable consent of a parent or lawful guardian. The guardian confirms they are authorised to consent on behalf of the child and agree that answers may be shared with the treating clinic.',
    hi: 'यह रोगी 18 वर्ष से कम आयु का है। स्क्रीनिंग केवल माता-पिता या कानूनी अभिभावक की सत्यापन योग्य सहमति से जारी रखी जा सकती है।',
    kn: 'ಈ ರೋಗಿ 18 ವರ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ ವಯಸ್ಸಿನವರು. ಪೋಷಕರ ಅಥವಾ ಕಾನೂನುಬದ್ಧ ಪಾಲಕರ ಪರಿಶೀಲಿಸಬಹುದಾದ ಒಪ್ಪಿಗೆಯೊಂದಿಗೆ ಮಾತ್ರ ಸ್ಕ್ರೀನಿಂಗ್ ಮುಂದುವರಿಯಬಹುದು.',
  };
  return texts[lang] || texts.en;
}
