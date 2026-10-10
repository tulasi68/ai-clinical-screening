const token = decodeURIComponent(location.pathname.split('/s/')[1] || '');
const app = document.getElementById('app');
let state = null;
let queueTimer = null;
let latestQueue = null;
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ · Kannada' },
  { code: 'hi', label: 'हिन्दी · Hindi' },
  { code: 'ta', label: 'தமிழ் · Tamil' },
  { code: 'te', label: 'తెలుగు · Telugu' },
  { code: 'ml', label: 'മലയാളം · Malayalam' },
  { code: 'bn', label: 'বাংলা · Bengali' },
  { code: 'or', label: 'ଓଡ଼ିଆ · Odia' },
  { code: 'as', label: 'অসমীয়া · Assamese' },
  { code: 'mr', label: 'मराठी · Marathi' },
  { code: 'ur', label: 'اردو · Urdu' },
  { code: 'bho', label: 'भोजपुरी · Bhojpuri' },
  { code: 'mai', label: 'मैथिली · Maithili' },
  { code: 'ne', label: 'नेपाली · Nepali' },
  { code: 'mni', label: 'মৈতৈলোন্ · Manipuri (Meitei)' },
  { code: 'brx', label: "बर' · Bodo" },
];
const LANG_CODES = new Set(LANGS.map(x => x.code));
function normalizeLang(v) {
  const s = String(v || 'en').toLowerCase().trim();
  if (LANG_CODES.has(s)) return s;
  for (const c of LANG_CODES) if (s === c || s.startsWith(c + '-') || s.startsWith(c + '_')) return c;
  return 'en';
}
let lang = normalizeLang(localStorage.getItem('screening_lang') || 'en');

const I18N = {
  en: {
    title: 'AI Clinical Screening',
    private: 'Private patient screening',
    hello: (name) => 'Hello, ' + name + '. I’ll ask you a few questions about your health concern before your consultation.',
    notDx: 'This is not a diagnosis or prescription.',
    start: 'Start Chat',
    incomplete: 'This link is incomplete.',
    invalid: 'This screening link is invalid or has expired.',
    clinical: 'Clinical screening',
    questionOf: (c, t) => 'Question ' + c + ' of ' + t,
    followUpOf: (c, t) => 'Follow-up ' + c + ' of ' + t,
    next: 'Next',
    wait: 'One moment…',
    typeAnswer: 'Type your answer…',
    whichAllergy: 'Which allergy? (optional)',
    review: 'Please review',
    summaryTitle: 'Screening Summary',
    urgent: 'Important: Your answers indicate a concern that may need urgent medical attention. Please seek urgent medical care now. This screening does not provide a diagnosis or treatment.',
    checkInfo: 'Please check the information below. You can correct anything that is inaccurate before sending it to your doctor.',
    yourAnswers: 'Your answers (you can correct or add details)',
    send: 'End & Send to Doctor',
    sendNote: 'Your information is sent only after you press “End & Send to Doctor”.',
    submitted: 'Submitted',
    thanks: 'Thank you',
    sent: 'Your screening information has been sent to your doctor for your consultation.',
    close: 'You can close this page now.',
    token: 'Your token number',
    completed: 'Consultation completed',
    visitThanks: 'Thank you for visiting the clinic.',
    nextInLine: 'You are next in line',
    ahead: (n) => n + ' patient' + (n === 1 ? '' : 's') + ' ahead of you',
    updating: 'Updating automatically',
    wentWrong: 'Something went wrong.',
  },
  kn: {
    title: 'ಎಐ ಕ್ಲಿನಿಕಲ್ ಸ್ಕ್ರೀನಿಂಗ್',
    private: 'ಖಾಸಗಿ ರೋಗಿ ಪೂರ್ವ ಪರೀಕ್ಷೆ',
    hello: (name) => 'ನಮಸ್ಕಾರ, ' + name + '. ನಿಮ್ಮ ಸಮಾಲೋಚನೆಗೂ ಮುನ್ನ ಆರೋಗ್ಯ ಸಮಸ್ಯೆಯ ಬಗ್ಗೆ ಕೆಲವು ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳುತ್ತೇನೆ.',
    notDx: 'ಇದು ರೋಗ ನಿರ್ಣಯ ಅಥವಾ ಔಷಧ ನಿರ್ದೇಶನವಲ್ಲ.',
    start: 'ಚಾಟ್ ಪ್ರಾರಂಭಿಸಿ',
    incomplete: 'ಈ ಲಿಂಕ್ ಅಪೂರ್ಣವಾಗಿದೆ.',
    invalid: 'ಈ ಸ್ಕ್ರೀನಿಂಗ್ ಲಿಂಕ್ ಅಮಾನ್ಯ ಅಥವಾ ಅವಧಿ ಮುಗಿದಿದೆ.',
    clinical: 'ಕ್ಲಿನಿಕಲ್ ಸ್ಕ್ರೀನಿಂಗ್',
    questionOf: (c, t) => 'ಪ್ರಶ್ನೆ ' + c + ' / ' + t,
    followUpOf: (c, t) => 'ಹೆಚ್ಚುವರಿ ಪ್ರಶ್ನೆ ' + c + ' / ' + t,
    next: 'ಮುಂದೆ',
    wait: 'ಸ್ವಲ್ಪ ನಿರೀಕ್ಷಿಸಿ…',
    typeAnswer: 'ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯಿರಿ…',
    whichAllergy: 'ಯಾವ ಅಲರ್ಜಿ? (ಐಚ್ಛಿಕ)',
    review: 'ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ',
    summaryTitle: 'ಸ್ಕ್ರೀನಿಂಗ್ ಸಾರಾಂಶ',
    urgent: 'ಮುಖ್ಯ: ನಿಮ್ಮ ಉತ್ತರಗಳು ತುರ್ತು ವೈದ್ಯಕೀಯ ಗಮನ ಬೇಕಾಗಬಹುದಾದ ಸಮಸ್ಯೆಯನ್ನು ಸೂಚಿಸುತ್ತವೆ. ಈಗಲೇ ತುರ್ತು ವೈದ್ಯಕೀಯ ಸಹಾಯ ಪಡೆಯಿರಿ. ಇದು ರೋಗ ನಿರ್ಣಯ ಅಥವಾ ಚಿಕಿತ್ಸೆಯಲ್ಲ.',
    checkInfo: 'ಕೆಳಗಿನ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ. ವೈದ್ಯರಿಗೆ ಕಳುಹಿಸುವ ಮುನ್ನ ತಪ್ಪುಗಳನ್ನು ಸರಿಪಡಿಸಬಹುದು.',
    yourAnswers: 'ನಿಮ್ಮ ಉತ್ತರಗಳು (ಸರಿಪಡಿಸಬಹುದು ಅಥವಾ ಸೇರಿಸಬಹುದು)',
    send: 'ಮುಗಿಸಿ ವೈದ್ಯರಿಗೆ ಕಳುಹಿಸಿ',
    sendNote: '“ಮುಗಿಸಿ ವೈದ್ಯರಿಗೆ ಕಳುಹಿಸಿ” ಒತ್ತಿದ ನಂತರವೇ ಮಾಹಿತಿ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.',
    submitted: 'ಸಲ್ಲಿಸಲಾಗಿದೆ',
    thanks: 'ಧನ್ಯವಾದಗಳು',
    sent: 'ನಿಮ್ಮ ಸ್ಕ್ರೀನಿಂಗ್ ಮಾಹಿತಿಯನ್ನು ಸಮಾಲೋಚನೆಗಾಗಿ ವೈದ್ಯರಿಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.',
    close: 'ಈ ಪುಟವನ್ನು ಈಗ ಮುಚ್ಚಬಹುದು.',
    token: 'ನಿಮ್ಮ ಟೋಕನ್ ಸಂಖ್ಯೆ',
    completed: 'ಸಮಾಲೋಚನೆ ಪೂರ್ಣಗೊಂಡಿದೆ',
    visitThanks: 'ಕ್ಲಿನಿಕ್‌ಗೆ ಭೇಟಿ ನೀಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು.',
    nextInLine: 'ನೀವು ಮುಂದಿನವರು',
    ahead: (n) => 'ನಿಮ್ಮ ಮುಂದೆ ' + n + ' ರೋಗಿ' + (n === 1 ? '' : 'ಗಳು'),
    updating: 'ಸ್ವಯಂಚಾಲಿತವಾಗಿ ನವೀಕರಿಸುತ್ತಿದೆ',
    wentWrong: 'ಏನೋ ತಪ್ಪಾಗಿದೆ.',
  },
  hi: {
    title: 'एआई क्लिनिकल स्क्रीनिंग',
    private: 'निजी रोगी स्क्रीनिंग',
    hello: (name) => 'नमस्ते, ' + name + '। परामर्श से पहले आपके स्वास्थ्य संबंधी कुछ प्रश्न पूछे जाएंगे।',
    notDx: 'यह निदान या नुस्खा नहीं है।',
    start: 'चैट शुरू करें',
    incomplete: 'यह लिंक अधूरा है।',
    invalid: 'यह स्क्रीनिंग लिंक अमान्य है या समाप्त हो गया है।',
    clinical: 'क्लिनिकल स्क्रीनिंग',
    questionOf: (c, t) => 'प्रश्न ' + c + ' / ' + t,
    followUpOf: (c, t) => 'अतिरिक्त प्रश्न ' + c + ' / ' + t,
    next: 'आगे',
    wait: 'एक क्षण…',
    typeAnswer: 'अपना उत्तर लिखें…',
    whichAllergy: 'कौन सी एलर्जी? (वैकल्पिक)',
    review: 'कृपया जाँच करें',
    summaryTitle: 'स्क्रीनिंग सारांश',
    urgent: 'महत्वपूर्ण: आपके उत्तरों से ऐसी समस्या का संकेत मिलता है जिस पर तुरंत चिकित्सा ध्यान आवश्यक हो सकता है। अभी तुरंत चिकित्सा सहायता लें। यह निदान या उपचार नहीं है।',
    checkInfo: 'नीचे दी गई जानकारी जाँचें। डॉक्टर को भेजने से पहले गलत बातें सुधार सकते हैं।',
    yourAnswers: 'आपके उत्तर (सुधार या विवरण जोड़ सकते हैं)',
    send: 'समाप्त करें और डॉक्टर को भेजें',
    sendNote: '“समाप्त करें और डॉक्टर को भेजें” दबाने के बाद ही जानकारी भेजी जाती है।',
    submitted: 'जमा हो गया',
    thanks: 'धन्यवाद',
    sent: 'आपकी स्क्रीनिंग जानकारी परामर्श के लिए डॉक्टर को भेज दी गई है।',
    close: 'अब आप यह पेज बंद कर सकते हैं।',
    token: 'आपका टोकन नंबर',
    completed: 'परामर्श पूरा हुआ',
    visitThanks: 'क्लिनिक आने के लिए धन्यवाद।',
    nextInLine: 'आप अगले हैं',
    ahead: (n) => n + ' मरीज़ आपके आगे',
    updating: 'स्वचालित रूप से अपडेट हो रहा है',
    wentWrong: 'कुछ गलत हो गया।',
  },
  ta: {
    title: 'ஏஐ மருத்துவ பரிசோதனை',
    private: 'தனிப்பட்ட நோயாளி பரிசோதனை',
    hello: (name) => 'வணக்கம், ' + name + '. உங்கள் ஆலோசனைக்கு முன் உடல்நலம் குறித்து சில கேள்விகள் கேட்கப்படும்.',
    notDx: 'இது நோய் கண்டறிதல் அல்லது மருந்து பரிந்துரை அல்ல.',
    start: 'அரட்டையை தொடங்கு',
    incomplete: 'இந்த இணைப்பு முழுமையடையவில்லை.',
    invalid: 'இந்த பரிசோதனை இணைப்பு செல்லாதது அல்லது காலாவதியானது.',
    clinical: 'மருத்துவ பரிசோதனை',
    questionOf: (c, t) => 'கேள்வி ' + c + ' / ' + t,
    followUpOf: (c, t) => 'கூடுதல் கேள்வி ' + c + ' / ' + t,
    next: 'அடுத்து',
    wait: 'சற்று காத்திருக்கவும்…',
    typeAnswer: 'உங்கள் பதிலை எழுதுங்கள்…',
    whichAllergy: 'எந்த ஒவ்வாமை? (விருப்பத்தேர்வு)',
    review: 'தயவுசெய்து சரிபார்க்கவும்',
    summaryTitle: 'பரிசோதனை சுருக்கம்',
    urgent: 'முக்கியம்: உங்கள் பதில்கள் அவசர மருத்துவ கவனம் தேவைப்படும் பிரச்சினையை சுட்டிக்காட்டுகின்றன. இப்போதே அவசர மருத்துவ உதவி பெறுங்கள். இது நோய் கண்டறிதல் அல்லது சிகிச்சை அல்ல.',
    checkInfo: 'கீழே உள்ள தகவலை சரிபார்க்கவும். மருத்துவரிடம் அனுப்பும் முன் தவறுகளை திருத்தலாம்.',
    yourAnswers: 'உங்கள் பதில்கள் (திருத்தலாம் அல்லது விவரங்கள் சேர்க்கலாம்)',
    send: 'முடித்து மருத்துவரிடம் அனுப்பு',
    sendNote: '“முடித்து மருத்துவரிடம் அனுப்பு” அழுத்திய பிறகே தகவல் அனுப்பப்படும்.',
    submitted: 'சமர்ப்பிக்கப்பட்டது',
    thanks: 'நன்றி',
    sent: 'உங்கள் பரிசோதனை தகவல் ஆலோசனைக்காக மருத்துவரிடம் அனுப்பப்பட்டது.',
    close: 'இந்தப் பக்கத்தை இப்போது மூடலாம்.',
    token: 'உங்கள் டோக்கன் எண்',
    completed: 'ஆலோசனை முடிந்தது',
    visitThanks: 'மருத்துவமனைக்கு வருகை தந்ததற்கு நன்றி.',
    nextInLine: 'நீங்கள் அடுத்தவர்',
    ahead: (n) => 'உங்களுக்கு முன் ' + n + ' நோயாளிகள்',
    updating: 'தானாக புதுப்பிக்கப்படுகிறது',
    wentWrong: 'ஏதோ தவறு நடந்தது.',
  },
  te: {
    title: 'ఏఐ క్లినికల్ స్క్రీనింగ్',
    private: 'ప్రైవేట్ రోగి స్క్రీనింగ్',
    hello: (name) => 'నమస్కారం, ' + name + '. మీ సంప్రదింపుకు ముందు ఆరోగ్యం గురించి కొన్ని ప్రశ్నలు అడుగుతాము.',
    notDx: 'ఇది రోగ నిర్ధారణ లేదా మందుల సూచన కాదు.',
    start: 'చాట్ ప్రారంభించండి',
    incomplete: 'ఈ లింక్ అసంపూర్ణం.',
    invalid: 'ఈ స్క్రీనింగ్ లింక్ చెల్లదు లేదా గడువు ముగిసింది.',
    clinical: 'క్లినికల్ స్క్రీనింగ్',
    questionOf: (c, t) => 'ప్రశ్న ' + c + ' / ' + t,
    followUpOf: (c, t) => 'అదనపు ప్రశ్న ' + c + ' / ' + t,
    next: 'తర్వాత',
    wait: 'ఒక క్షణం…',
    typeAnswer: 'మీ సమాధానం రాయండి…',
    whichAllergy: 'ఏ అలర్జీ? (ఐచ్ఛికం)',
    review: 'దయచేసి సమీక్షించండి',
    summaryTitle: 'స్క్రీనింగ్ సారాంశం',
    urgent: 'ముఖ్యం: మీ సమాధానాలు అత్యవసర వైద్య శ్రద్ధ అవసరమయ్యే సమస్యను సూచిస్తున్నాయి. ఇప్పుడే అత్యవసర వైద్య సహాయం పొందండి. ఇది రోగ నిర్ధారణ లేదా చికిత్స కాదు.',
    checkInfo: 'క్రింది సమాచారాన్ని తనిఖీ చేయండి. వైద్యునికి పంపే ముందు తప్పులను సరిదిద్దవచ్చు.',
    yourAnswers: 'మీ సమాధానాలు (సరిదిద్దవచ్చు లేదా వివరాలు జోడించవచ్చు)',
    send: 'ముగించి వైద్యునికి పంపండి',
    sendNote: '“ముగించి వైద్యునికి పంపండి” నొక్కిన తర్వాతే సమాచారం పంపబడుతుంది.',
    submitted: 'సమర్పించబడింది',
    thanks: 'ధన్యవాదాలు',
    sent: 'మీ స్క్రీనింగ్ సమాచారం సంప్రదింపు కోసం వైద్యునికి పంపబడింది.',
    close: 'ఈ పేజీని ఇప్పుడు మూసివేయవచ్చు.',
    token: 'మీ టోకెన్ నంబర్',
    completed: 'సంప్రదింపు పూర్తయింది',
    visitThanks: 'క్లినిక్‌కు వచ్చినందుకు ధన్యవాదాలు.',
    nextInLine: 'మీరు తదుపరి వ్యక్తి',
    ahead: (n) => 'మీ ముందు ' + n + ' రోగులు',
    updating: 'స్వయంచాలకంగా నవీకరిస్తోంది',
    wentWrong: 'ఏదో తప్పు జరిగింది.',
  },
  ml: {
    title: 'എഐ ക്ലിനിക്കൽ സ്ക്രീനിംഗ്',
    private: 'സ്വകാര്യ രോഗി സ്ക്രീനിംഗ്',
    hello: (name) => 'നമസ്കാരം, ' + name + '. നിങ്ങളുടെ കൺസൾട്ടേഷന് മുമ്പ് ആരോഗ്യത്തെക്കുറിച്ച് ചില ചോദ്യങ്ങൾ ചോദിക്കും.',
    notDx: 'ഇത് രോഗനിർണയമോ കുറിപ്പടിയോ അല്ല.',
    start: 'ചാറ്റ് ആരംഭിക്കുക',
    incomplete: 'ഈ ലിങ്ക് അപൂർണ്ണമാണ്.',
    invalid: 'ഈ സ്ക്രീനിംഗ് ലിങ്ക് അസാധുവാണ് അല്ലെങ്കിൽ കാലഹരണപ്പെട്ടു.',
    clinical: 'ക്ലിനിക്കൽ സ്ക്രീനിംഗ്',
    questionOf: (c, t) => 'ചോദ്യം ' + c + ' / ' + t,
    followUpOf: (c, t) => 'അധിക ചോദ്യം ' + c + ' / ' + t,
    next: 'അടുത്തത്',
    wait: 'ഒരു നിമിഷം…',
    typeAnswer: 'നിങ്ങളുടെ ഉത്തരം എഴുതുക…',
    whichAllergy: 'ഏത് അലർജി? (ഐച്ഛികം)',
    review: 'ദയവായി അവലോകനം ചെയ്യുക',
    summaryTitle: 'സ്ക്രീനിംഗ് സംഗ്രഹം',
    urgent: 'പ്രധാനം: നിങ്ങളുടെ ഉത്തരങ്ങൾ അടിയന്തിര വൈദ്യശ്രദ്ധ ആവശ്യമായ പ്രശ്നം സൂചിപ്പിക്കുന്നു. ഇപ്പോൾ തന്നെ അടിയന്തിര വൈദ്യസഹായം തേടുക. ഇത് രോഗനിർണയമോ ചികിത്സയോ അല്ല.',
    checkInfo: 'താഴെയുള്ള വിവരങ്ങൾ പരിശോധിക്കുക. ഡോക്ടറിലേക്ക് അയയ്ക്കുന്നതിന് മുമ്പ് തെറ്റുകൾ തിരുത്താം.',
    yourAnswers: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ (തിരുത്താം അല്ലെങ്കിൽ വിശദാംശങ്ങൾ ചേർക്കാം)',
    send: 'അവസാനിപ്പിച്ച് ഡോക്ടറിലേക്ക് അയയ്ക്കുക',
    sendNote: '“അവസാനിപ്പിച്ച് ഡോക്ടറിലേക്ക് അയയ്ക്കുക” അമർത്തിയ ശേഷം മാത്രമേ വിവരങ്ങൾ അയയ്ക്കൂ.',
    submitted: 'സമർപ്പിച്ചു',
    thanks: 'നന്ദി',
    sent: 'നിങ്ങളുടെ സ്ക്രീനിംഗ് വിവരങ്ങൾ കൺസൾട്ടേഷനായി ഡോക്ടറിലേക്ക് അയച്ചു.',
    close: 'ഈ പേജ് ഇപ്പോൾ അടയ്ക്കാം.',
    token: 'നിങ്ങളുടെ ടോക്കൺ നമ്പർ',
    completed: 'കൺസൾട്ടേഷൻ പൂർത്തിയായി',
    visitThanks: 'ക്ലിനിക്കിൽ വന്നതിന് നന്ദി.',
    nextInLine: 'നിങ്ങൾ അടുത്തയാളാണ്',
    ahead: (n) => 'നിങ്ങളുടെ മുന്നിൽ ' + n + ' രോഗികൾ',
    updating: 'സ്വയമേവ അപ്ഡേറ്റ് ചെയ്യുന്നു',
    wentWrong: 'എന്തോ കുഴപ്പം സംഭവിച്ചു.',
  },
  bn: {
    title: 'এআই ক্লিনিক্যাল স্ক্রিনিং',
    private: 'ব্যক্তিগত রোগী স্ক্রিনিং',
    hello: (name) => 'নমস্কার, ' + name + '। আপনার পরামর্শের আগে স্বাস্থ্য সম্পর্কে কিছু প্রশ্ন করা হবে।',
    notDx: 'এটি রোগ নির্ণয় বা প্রেসক্রিপশন নয়।',
    start: 'চ্যাট শুরু করুন',
    incomplete: 'এই লিঙ্কটি অসম্পূর্ণ।',
    invalid: 'এই স্ক্রিনিং লিঙ্কটি অবৈধ বা মেয়াদোত্তীর্ণ।',
    clinical: 'ক্লিনিক্যাল স্ক্রিনিং',
    questionOf: (c, t) => 'প্রশ্ন ' + c + ' / ' + t,
    followUpOf: (c, t) => 'অতিরিক্ত প্রশ্ন ' + c + ' / ' + t,
    next: 'পরবর্তী',
    wait: 'এক মুহূর্ত…',
    typeAnswer: 'আপনার উত্তর লিখুন…',
    whichAllergy: 'কোন অ্যালার্জি? (ঐচ্ছিক)',
    review: 'অনুগ্রহ করে পর্যালোচনা করুন',
    summaryTitle: 'স্ক্রিনিং সারাংশ',
    urgent: 'গুরুত্বপূর্ণ: আপনার উত্তর জরুরি চিকিৎসা মনোযোগ প্রয়োজন এমন সমস্যা নির্দেশ করে। এখনই জরুরি চিকিৎসা সহায়তা নিন। এটি রোগ নির্ণয় বা চিকিৎসা নয়।',
    checkInfo: 'নিচের তথ্য যাচাই করুন। ডাক্তারের কাছে পাঠানোর আগে ভুল সংশোধন করতে পারেন।',
    yourAnswers: 'আপনার উত্তর (সংশোধন বা বিবরণ যোগ করতে পারেন)',
    send: 'শেষ করে ডাক্তারকে পাঠান',
    sendNote: '“শেষ করে ডাক্তারকে পাঠান” চাপার পরেই তথ্য পাঠানো হয়।',
    submitted: 'জমা দেওয়া হয়েছে',
    thanks: 'ধন্যবাদ',
    sent: 'আপনার স্ক্রিনিং তথ্য পরামর্শের জন্য ডাক্তারের কাছে পাঠানো হয়েছে।',
    close: 'এই পৃষ্ঠা এখন বন্ধ করতে পারেন।',
    token: 'আপনার টোকেন নম্বর',
    completed: 'পরামর্শ সম্পন্ন',
    visitThanks: 'ক্লিনিকে আসার জন্য ধন্যবাদ।',
    nextInLine: 'আপনি পরবর্তী',
    ahead: (n) => 'আপনার সামনে ' + n + ' রোগী',
    updating: 'স্বয়ংক্রিয়ভাবে আপডেট হচ্ছে',
    wentWrong: 'কিছু ভুল হয়েছে।',
  },
  mr: {
    title: 'एआय क्लिनिकल स्क्रीनिंग',
    private: 'खाजगी रुग्ण स्क्रीनिंग',
    hello: (name) => 'नमस्कार, ' + name + '. सल्लामसलतीपूर्वी आरोग्याबाबत काही प्रश्न विचारले जातील.',
    notDx: 'हे निदान किंवा औषधोपचार नाही.',
    start: 'चॅट सुरू करा',
    incomplete: 'ही लिंक अपूर्ण आहे.',
    invalid: 'ही स्क्रीनिंग लिंक अवैध आहे किंवा कालबाह्य झाली आहे.',
    clinical: 'क्लिनिकल स्क्रीनिंग',
    questionOf: (c, t) => 'प्रश्न ' + c + ' / ' + t,
    followUpOf: (c, t) => 'अतिरिक्त प्रश्न ' + c + ' / ' + t,
    next: 'पुढे',
    wait: 'एक क्षण…',
    typeAnswer: 'तुमचे उत्तर लिहा…',
    whichAllergy: 'कोणती अॅलर्जी? (पर्यायी)',
    review: 'कृपया तपासा',
    summaryTitle: 'स्क्रीनिंग सारांश',
    urgent: 'महत्त्वाचे: तुमच्या उत्तरांवरून तातडीच्या वैद्यकीय लक्ष्याची गरज असलेली समस्या दिसते. आत्ताच तातडीची वैद्यकीय मदत घ्या. हे निदान किंवा उपचार नाही.',
    checkInfo: 'खालील माहिती तपासा. डॉक्टरांना पाठवण्यापूर्वी चुका दुरुस्त करू शकता.',
    yourAnswers: 'तुमची उत्तरे (दुरुस्त किंवा तपशील जोडू शकता)',
    send: 'संपवा आणि डॉक्टरांना पाठवा',
    sendNote: '“संपवा आणि डॉक्टरांना पाठवा” दाबल्यानंतरच माहिती पाठवली जाते.',
    submitted: 'सादर केले',
    thanks: 'धन्यवाद',
    sent: 'तुमची स्क्रीनिंग माहिती सल्लामसलतीसाठी डॉक्टरांना पाठवली आहे.',
    close: 'हे पृष्ठ आता बंद करू शकता.',
    token: 'तुमचा टोकन क्रमांक',
    completed: 'सल्लामसलत पूर्ण',
    visitThanks: 'क्लिनिकला भेट दिल्याबद्दल धन्यवाद.',
    nextInLine: 'तुम्ही पुढचे आहात',
    ahead: (n) => 'तुमच्या पुढे ' + n + ' रुग्ण',
    updating: 'स्वयंचलितपणे अद्यतनित होत आहे',
    wentWrong: 'काहीतरी चुकले.',
  },
  ur: {
    title: 'اے آئی کلینیکل اسکریننگ',
    private: 'نجی مریض اسکریننگ',
    hello: (name) => 'السلام علیکم، ' + name + '۔ مشاورت سے پہلے صحت کے بارے میں کچھ سوالات پوچھے جائیں گے۔',
    notDx: 'یہ تشخیص یا نسخہ نہیں ہے۔',
    start: 'چیٹ شروع کریں',
    incomplete: 'یہ لنک نامکمل ہے۔',
    invalid: 'یہ اسکریننگ لنک غلط ہے یا ختم ہو چکا ہے۔',
    clinical: 'کلینیکل اسکریننگ',
    questionOf: (c, t) => 'سوال ' + c + ' / ' + t,
    followUpOf: (c, t) => 'اضافی سوال ' + c + ' / ' + t,
    next: 'آگے',
    wait: 'ایک لمحہ…',
    typeAnswer: 'اپنا جواب لکھیں…',
    whichAllergy: 'کون سی الرجی؟ (اختیاری)',
    review: 'براہ کرم جائزہ لیں',
    summaryTitle: 'اسکریننگ خلاصہ',
    urgent: 'اہم: آپ کے جوابات ایسی پریشانی کی نشاندہی کرتے ہیں جس پر فوری طبی توجہ درکار ہو سکتی ہے۔ ابھی فوری طبی مدد حاصل کریں۔ یہ تشخیص یا علاج نہیں ہے۔',
    checkInfo: 'نیچے دی گئی معلومات چیک کریں۔ ڈاکٹر کو بھیجنے سے پہلے غلطیاں درست کر سکتے ہیں۔',
    yourAnswers: 'آپ کے جوابات (درست یا تفصیل شامل کر سکتے ہیں)',
    send: 'ختم کریں اور ڈاکٹر کو بھیجیں',
    sendNote: '“ختم کریں اور ڈاکٹر کو بھیجیں” دبانے کے بعد ہی معلومات بھیجی جاتی ہیں۔',
    submitted: 'جمع ہو گیا',
    thanks: 'شکریہ',
    sent: 'آپ کی اسکریننگ معلومات مشاورت کے لیے ڈاکٹر کو بھیج دی گئی ہیں۔',
    close: 'اب آپ یہ صفحہ بند کر سکتے ہیں۔',
    token: 'آپ کا ٹوکن نمبر',
    completed: 'مشاورت مکمل',
    visitThanks: 'کلینک آنے کا شکریہ۔',
    nextInLine: 'آپ اگلے ہیں',
    ahead: (n) => 'آپ کے آگے ' + n + ' مریض',
    updating: 'خودکار طور پر اپ ڈیٹ ہو رہا ہے',
    wentWrong: 'کچھ غلط ہو گیا۔',
  },
  or: {
    title: 'ଏଆଇ କ୍ଲିନିକାଲ୍ ସ୍କ୍ରିନିଂ',
    private: 'ବ୍ୟକ୍ତିଗତ ରୋଗୀ ସ୍କ୍ରିନିଂ',
    hello: (name) => 'ନମସ୍କାର, ' + name + '। ଆପଣଙ୍କ ପରାମର୍ଶ ପୂର୍ବରୁ ସ୍ୱାସ୍ଥ୍ୟ ବିଷୟରେ କିଛି ପ୍ରଶ୍ନ ପଚରାଯିବ।',
    notDx: 'ଏହା ରୋଗ ନିର୍ଣ୍ଣୟ କିମ୍ବା ଔଷଧ ନିର୍ଦ୍ଦେଶ ନୁହେଁ।',
    start: 'ଚାଟ୍ ଆରମ୍ଭ କରନ୍ତୁ',
    incomplete: 'ଏହି ଲିଙ୍କ୍ ଅସମ୍ପୂର୍ଣ୍ଣ।',
    invalid: 'ଏହି ସ୍କ୍ରିନିଂ ଲିଙ୍କ୍ ଅବୈଧ କିମ୍ବା ସମୟ ସମାପ୍ତ।',
    clinical: 'କ୍ଲିନିକାଲ୍ ସ୍କ୍ରିନିଂ',
    questionOf: (c, t) => 'ପ୍ରଶ୍ନ ' + c + ' / ' + t,
    followUpOf: (c, t) => 'ଅତିରିକ୍ତ ପ୍ରଶ୍ନ ' + c + ' / ' + t,
    next: 'ପରବର୍ତ୍ତୀ',
    wait: 'ଏକ ମୁହୂର୍ତ୍ତ…',
    typeAnswer: 'ଆପଣଙ୍କ ଉତ୍ତର ଲେଖନ୍ତୁ…',
    whichAllergy: 'କେଉଁ ଆଲର୍ଜି? (ବୈକଳ୍ପିକ)',
    review: 'ଦୟାକରି ଯାଞ୍ଚ କରନ୍ତୁ',
    summaryTitle: 'ସ୍କ୍ରିନିଂ ସାରାଂଶ',
    urgent: 'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ: ଆପଣଙ୍କ ଉତ୍ତରରୁ ତୁରନ୍ତ ଚିକିତ୍ସା ଆବଶ୍ୟକ ହୋଇପାରେ। ଏବେ ତୁରନ୍ତ ଚିକିତ୍ସା ସହାୟତା ନିଅନ୍ତୁ।',
    checkInfo: 'ତଳେ ଥିବା ସୂଚନା ଯାଞ୍ଚ କରନ୍ତୁ। ଡାକ୍ତରଙ୍କୁ ପଠାଇବା ପୂର୍ବରୁ ଭୁଲ ସୁଧାରି ପାରିବେ।',
    yourAnswers: 'ଆପଣଙ୍କ ଉତ୍ତର (ସୁଧାରି କିମ୍ବା ବିବରଣୀ ଯୋଗ କରିପାରିବେ)',
    send: 'ସମାପ୍ତ କରି ଡାକ୍ତରଙ୍କୁ ପଠାନ୍ତୁ',
    sendNote: '“ସମାପ୍ତ କରି ଡାକ୍ତରଙ୍କୁ ପଠାନ୍ତୁ” ଦବାଇବା ପରେ ହିଁ ସୂଚନା ପଠାଯିବ।',
    submitted: 'ଦାଖଲ ହୋଇଛି',
    thanks: 'ଧନ୍ୟବାଦ',
    sent: 'ଆପଣଙ୍କ ସ୍କ୍ରିନିଂ ସୂଚନା ପରାମର୍ଶ ପାଇଁ ଡାକ୍ତରଙ୍କୁ ପଠାଯାଇଛି।',
    close: 'ଏହି ପୃଷ୍ଠା ବର୍ତ୍ତମାନ ବନ୍ଦ କରିପାରିବେ।',
    token: 'ଆପଣଙ୍କ ଟୋକେନ୍ ନମ୍ବର',
    completed: 'ପରାମର୍ଶ ସମ୍ପୂର୍ଣ୍ଣ',
    visitThanks: 'କ୍ଲିନିକ୍‌କୁ ଆସିଥିବାରୁ ଧନ୍ୟବାଦ।',
    nextInLine: 'ଆପଣ ପରବର୍ତ୍ତୀ',
    ahead: (n) => 'ଆପଣଙ୍କ ଆଗରେ ' + n + ' ରୋଗୀ',
    updating: 'ସ୍ୱୟଂଚାଳିତ ଭାବେ ଅଦ୍ୟତନ',
    wentWrong: 'କିଛି ଭୁଲ ହୋଇଛି।',
  },
  as: {
    title: 'এআই ক্লিনিকেল স্ক্ৰীনিং',
    private: 'ব্যক্তিগত ৰোগী স্ক্ৰীনিং',
    hello: (name) => 'নমস্কাৰ, ' + name + '। আপোনাৰ পৰামৰ্শৰ আগত স্বাস্থ্য সম্পৰ্কে কিছু প্ৰশ্ন সোধা হ\'ব।',
    notDx: 'এইটো ৰোগ নিৰ্ণয় বা ঔষধৰ নিৰ্দেশ নহয়।',
    start: 'চাট আৰম্ভ কৰক',
    incomplete: 'এই লিংক অসম্পূৰ্ণ।',
    invalid: 'এই স্ক্ৰীনিং লিংক অবৈধ বা ম্যাদ উকলিছে।',
    clinical: 'ক্লিনিকেল স্ক্ৰীনিং',
    questionOf: (c, t) => 'প্ৰশ্ন ' + c + ' / ' + t,
    followUpOf: (c, t) => 'অতিৰিক্ত প্ৰশ্ন ' + c + ' / ' + t,
    next: 'পৰৱৰ্তী',
    wait: 'এক মুহূৰ্ত…',
    typeAnswer: 'আপোনাৰ উত্তৰ লিখক…',
    whichAllergy: 'কোনটো এলাৰ্জী? (ঐচ্ছিক)',
    review: 'অনুগ্ৰহ কৰি পৰীক্ষা কৰক',
    summaryTitle: 'স্ক্ৰীনিং সাৰাংশ',
    urgent: 'গুৰুত্বপূৰ্ণ: আপোনাৰ উত্তৰে জৰুৰী চিকিৎসাৰ প্ৰয়োজনীয় সমস্যা সূচায়। এতিয়াই জৰুৰী চিকিৎসা সহায় লওক।',
    checkInfo: 'তলৰ তথ্য পৰীক্ষা কৰক। চিকিৎসকলৈ পঠোৱাৰ আগতে ভুল শুধৰাব পাৰে।',
    yourAnswers: 'আপোনাৰ উত্তৰ (শুধৰাব বা বিৱৰণ যোগ কৰিব পাৰে)',
    send: 'শেষ কৰি চিকিৎসকলৈ পঠাওক',
    sendNote: '“শেষ কৰি চিকিৎসকলৈ পঠাওক” টিপাৰ পিছতহে তথ্য পঠোৱা হয়।',
    submitted: 'দাখিল কৰা হৈছে',
    thanks: 'ধন্যবাদ',
    sent: 'আপোনাৰ স্ক্ৰীনিং তথ্য পৰামৰ্শৰ বাবে চিকিৎসকলৈ পঠোৱা হৈছে।',
    close: 'এই পৃষ্ঠা এতিয়া বন্ধ কৰিব পাৰে।',
    token: 'আপোনাৰ টোকেন নম্বৰ',
    completed: 'পৰামৰ্শ সম্পূৰ্ণ',
    visitThanks: 'ক্লিনিকলৈ অহাৰ বাবে ধন্যবাদ।',
    nextInLine: 'আপুনি পৰৱৰ্তী',
    ahead: (n) => 'আপোনাৰ আগত ' + n + ' ৰোগী',
    updating: 'স্বয়ংক্ৰিয়ভাৱে আপডেট হৈ আছে',
    wentWrong: 'কিবা ভুল হৈছে।',
  },
  ne: {
    title: 'एआई क्लिनिकल स्क्रिनिङ',
    private: 'निजी बिरामी स्क्रिनिङ',
    hello: (name) => 'नमस्ते, ' + name + '। परामर्श अघि स्वास्थ्यबारे केही प्रश्न सोधिनेछ।',
    notDx: 'यो निदान वा प्रिस्क्रिप्शन होइन।',
    start: 'च्याट सुरु गर्नुहोस्',
    incomplete: 'यो लिङ्क अपूर्ण छ।',
    invalid: 'यो स्क्रिनिङ लिङ्क अमान्य छ वा म्याद सकिएको छ।',
    clinical: 'क्लिनिकल स्क्रिनिङ',
    questionOf: (c, t) => 'प्रश्न ' + c + ' / ' + t,
    followUpOf: (c, t) => 'थप प्रश्न ' + c + ' / ' + t,
    next: 'अर्को',
    wait: 'एक क्षण…',
    typeAnswer: 'आफ्नो जवाफ लेख्नुहोस्…',
    whichAllergy: 'कुन एलर्जी? (वैकल्पिक)',
    review: 'कृपया समीक्षा गर्नुहोस्',
    summaryTitle: 'स्क्रिनिङ सारांश',
    urgent: 'महत्त्वपूर्ण: तपाईंका जवाफले तत्काल चिकित्सा ध्यान आवश्यक हुन सक्ने समस्या देखाउँछन्। अहिले नै तत्काल चिकित्सा सहायता लिनुहोस्।',
    checkInfo: 'तलको जानकारी जाँच गर्नुहोस्। डाक्टरलाई पठाउनु अघि गल्ती सच्याउन सकिन्छ।',
    yourAnswers: 'तपाईंका जवाफ (सच्याउन वा विवरण थप्न सकिन्छ)',
    send: 'अन्त्य गरी डाक्टरलाई पठाउनुहोस्',
    sendNote: '“अन्त्य गरी डाक्टरलाई पठाउनुहोस्” थिचेपछि मात्र जानकारी पठाइन्छ।',
    submitted: 'पेश गरियो',
    thanks: 'धन्यवाद',
    sent: 'तपाईंको स्क्रिनिङ जानकारी परामर्शका लागि डाक्टरलाई पठाइएको छ।',
    close: 'यो पृष्ठ अब बन्द गर्न सकिन्छ।',
    token: 'तपाईंको टोकन नम्बर',
    completed: 'परामर्श पूरा',
    visitThanks: 'क्लिनिक आउनुभएकोमा धन्यवाद।',
    nextInLine: 'तपाईं अर्को हुनुहुन्छ',
    ahead: (n) => 'तपाईं अगाडि ' + n + ' बिरामी',
    updating: 'स्वचालित रूपमा अद्यावधिक हुँदै',
    wentWrong: 'केही गलत भयो।',
  },
  bho: {
    title: 'एआई क्लिनिकल स्क्रीनिंग',
    private: 'निजी रोगी स्क्रीनिंग',
    hello: (name) => 'नमस्ते, ' + name + '। परामर्श से पहले आपके स्वास्थ्य संबंधी कुछ प्रश्न पूछे जाएंगे।',
    notDx: 'यह निदान या नुस्खा नहीं है।',
    start: 'चैट शुरू करें',
    incomplete: 'यह लिंक अधूरा है।',
    invalid: 'यह स्क्रीनिंग लिंक अमान्य है या समाप्त हो गया है।',
    clinical: 'क्लिनिकल स्क्रीनिंग',
    questionOf: (c, t) => 'प्रश्न ' + c + ' / ' + t,
    followUpOf: (c, t) => 'अतिरिक्त प्रश्न ' + c + ' / ' + t,
    next: 'आगे',
    wait: 'एक क्षण…',
    typeAnswer: 'अपना उत्तर लिखें…',
    whichAllergy: 'कौन सी एलर्जी? (वैकल्पिक)',
    review: 'कृपया जाँच करें',
    summaryTitle: 'स्क्रीनिंग सारांश',
    urgent: 'महत्वपूर्ण: आपके उत्तरों से ऐसी समस्या का संकेत मिलता है जिस पर तुरंत चिकित्सा ध्यान आवश्यक हो सकता है। अभी तुरंत चिकित्सा सहायता लें। यह निदान या उपचार नहीं है।',
    checkInfo: 'नीचे दी गई जानकारी जाँचें। डॉक्टर को भेजने से पहले गलत बातें सुधार सकते हैं।',
    yourAnswers: 'आपके उत्तर (सुधार या विवरण जोड़ सकते हैं)',
    send: 'समाप्त करें और डॉक्टर को भेजें',
    sendNote: '“समाप्त करें और डॉक्टर को भेजें” दबाने के बाद ही जानकारी भेजी जाती है।',
    submitted: 'जमा हो गया',
    thanks: 'धन्यवाद',
    sent: 'आपकी स्क्रीनिंग जानकारी परामर्श के लिए डॉक्टर को भेज दी गई है।',
    close: 'अब आप यह पेज बंद कर सकते हैं।',
    token: 'आपका टोकन नंबर',
    completed: 'परामर्श पूरा हुआ',
    visitThanks: 'क्लिनिक आने के लिए धन्यवाद।',
    nextInLine: 'आप अगले हैं',
    ahead: (n) => n + ' मरीज़ आपके आगे',
    updating: 'स्वचालित रूप से अपडेट हो रहा है',
    wentWrong: 'कुछ गलत हो गया।',
  },
  mai: {
    title: 'एआई क्लिनिकल स्क्रीनिंग',
    private: 'निजी रोगी स्क्रीनिंग',
    hello: (name) => 'नमस्ते, ' + name + '। परामर्श से पहले आपके स्वास्थ्य संबंधी कुछ प्रश्न पूछे जाएंगे।',
    notDx: 'यह निदान या नुस्खा नहीं है।',
    start: 'चैट शुरू करें',
    incomplete: 'यह लिंक अधूरा है।',
    invalid: 'यह स्क्रीनिंग लिंक अमान्य है या समाप्त हो गया है।',
    clinical: 'क्लिनिकल स्क्रीनिंग',
    questionOf: (c, t) => 'प्रश्न ' + c + ' / ' + t,
    followUpOf: (c, t) => 'अतिरिक्त प्रश्न ' + c + ' / ' + t,
    next: 'आगे',
    wait: 'एक क्षण…',
    typeAnswer: 'अपना उत्तर लिखें…',
    whichAllergy: 'कौन सी एलर्जी? (वैकल्पिक)',
    review: 'कृपया जाँच करें',
    summaryTitle: 'स्क्रीनिंग सारांश',
    urgent: 'महत्वपूर्ण: आपके उत्तरों से ऐसी समस्या का संकेत मिलता है जिस पर तुरंत चिकित्सा ध्यान आवश्यक हो सकता है। अभी तुरंत चिकित्सा सहायता लें। यह निदान या उपचार नहीं है।',
    checkInfo: 'नीचे दी गई जानकारी जाँचें। डॉक्टर को भेजने से पहले गलत बातें सुधार सकते हैं।',
    yourAnswers: 'आपके उत्तर (सुधार या विवरण जोड़ सकते हैं)',
    send: 'समाप्त करें और डॉक्टर को भेजें',
    sendNote: '“समाप्त करें और डॉक्टर को भेजें” दबाने के बाद ही जानकारी भेजी जाती है।',
    submitted: 'जमा हो गया',
    thanks: 'धन्यवाद',
    sent: 'आपकी स्क्रीनिंग जानकारी परामर्श के लिए डॉक्टर को भेज दी गई है।',
    close: 'अब आप यह पेज बंद कर सकते हैं।',
    token: 'आपका टोकन नंबर',
    completed: 'परामर्श पूरा हुआ',
    visitThanks: 'क्लिनिक आने के लिए धन्यवाद।',
    nextInLine: 'आप अगले हैं',
    ahead: (n) => n + ' मरीज़ आपके आगे',
    updating: 'स्वचालित रूप से अपडेट हो रहा है',
    wentWrong: 'कुछ गलत हो गया।',
  },
  mni: {
    title: 'एआई क्लिनिकल स्क्रीनिंग',
    private: 'निजी रोगी स्क्रीनिंग',
    hello: (name) => 'नमस्ते, ' + name + '। परामर्श से पहले आपके स्वास्थ्य संबंधी कुछ प्रश्न पूछे जाएंगे।',
    notDx: 'यह निदान या नुस्खा नहीं है।',
    start: 'चैट शुरू करें',
    incomplete: 'यह लिंक अधूरा है।',
    invalid: 'यह स्क्रीनिंग लिंक अमान्य है या समाप्त हो गया है।',
    clinical: 'क्लिनिकल स्क्रीनिंग',
    questionOf: (c, t) => 'प्रश्न ' + c + ' / ' + t,
    followUpOf: (c, t) => 'अतिरिक्त प्रश्न ' + c + ' / ' + t,
    next: 'आगे',
    wait: 'एक क्षण…',
    typeAnswer: 'अपना उत्तर लिखें…',
    whichAllergy: 'कौन सी एलर्जी? (वैकल्पिक)',
    review: 'कृपया जाँच करें',
    summaryTitle: 'स्क्रीनिंग सारांश',
    urgent: 'महत्वपूर्ण: आपके उत्तरों से ऐसी समस्या का संकेत मिलता है जिस पर तुरंत चिकित्सा ध्यान आवश्यक हो सकता है। अभी तुरंत चिकित्सा सहायता लें। यह निदान या उपचार नहीं है।',
    checkInfo: 'नीचे दी गई जानकारी जाँचें। डॉक्टर को भेजने से पहले गलत बातें सुधार सकते हैं।',
    yourAnswers: 'आपके उत्तर (सुधार या विवरण जोड़ सकते हैं)',
    send: 'समाप्त करें और डॉक्टर को भेजें',
    sendNote: '“समाप्त करें और डॉक्टर को भेजें” दबाने के बाद ही जानकारी भेजी जाती है।',
    submitted: 'जमा हो गया',
    thanks: 'धन्यवाद',
    sent: 'आपकी स्क्रीनिंग जानकारी परामर्श के लिए डॉक्टर को भेज दी गई है।',
    close: 'अब आप यह पेज बंद कर सकते हैं।',
    token: 'आपका टोकन नंबर',
    completed: 'परामर्श पूरा हुआ',
    visitThanks: 'क्लिनिक आने के लिए धन्यवाद।',
    nextInLine: 'आप अगले हैं',
    ahead: (n) => n + ' मरीज़ आपके आगे',
    updating: 'स्वचालित रूप से अपडेट हो रहा है',
    wentWrong: 'कुछ गलत हो गया।',
  },
  brx: {
    title: 'एआई क्लिनिकल स्क्रीनिंग',
    private: 'निजी रोगी स्क्रीनिंग',
    hello: (name) => 'नमस्ते, ' + name + '। परामर्श से पहले आपके स्वास्थ्य संबंधी कुछ प्रश्न पूछे जाएंगे।',
    notDx: 'यह निदान या नुस्खा नहीं है।',
    start: 'चैट शुरू करें',
    incomplete: 'यह लिंक अधूरा है।',
    invalid: 'यह स्क्रीनिंग लिंक अमान्य है या समाप्त हो गया है।',
    clinical: 'क्लिनिकल स्क्रीनिंग',
    questionOf: (c, t) => 'प्रश्न ' + c + ' / ' + t,
    followUpOf: (c, t) => 'अतिरिक्त प्रश्न ' + c + ' / ' + t,
    next: 'आगे',
    wait: 'एक क्षण…',
    typeAnswer: 'अपना उत्तर लिखें…',
    whichAllergy: 'कौन सी एलर्जी? (वैकल्पिक)',
    review: 'कृपया जाँच करें',
    summaryTitle: 'स्क्रीनिंग सारांश',
    urgent: 'महत्वपूर्ण: आपके उत्तरों से ऐसी समस्या का संकेत मिलता है जिस पर तुरंत चिकित्सा ध्यान आवश्यक हो सकता है। अभी तुरंत चिकित्सा सहायता लें। यह निदान या उपचार नहीं है।',
    checkInfo: 'नीचे दी गई जानकारी जाँचें। डॉक्टर को भेजने से पहले गलत बातें सुधार सकते हैं।',
    yourAnswers: 'आपके उत्तर (सुधार या विवरण जोड़ सकते हैं)',
    send: 'समाप्त करें और डॉक्टर को भेजें',
    sendNote: '“समाप्त करें और डॉक्टर को भेजें” दबाने के बाद ही जानकारी भेजी जाती है।',
    submitted: 'जमा हो गया',
    thanks: 'धन्यवाद',
    sent: 'आपकी स्क्रीनिंग जानकारी परामर्श के लिए डॉक्टर को भेज दी गई है।',
    close: 'अब आप यह पेज बंद कर सकते हैं।',
    token: 'आपका टोकन नंबर',
    completed: 'परामर्श पूरा हुआ',
    visitThanks: 'क्लिनिक आने के लिए धन्यवाद।',
    nextInLine: 'आप अगले हैं',
    ahead: (n) => n + ' मरीज़ आपके आगे',
    updating: 'स्वचालित रूप से अपडेट हो रहा है',
    wentWrong: 'कुछ गलत हो गया।',
  },
};

function t(key, ...args) {
  const bag = I18N[lang] || I18N.en;
  const v = bag[key] !== undefined ? bag[key] : I18N.en[key];
  return typeof v === 'function' ? v(...args) : v;
}

function setLang(next) {
  lang = normalizeLang(next);
  localStorage.setItem('screening_lang', lang);
  document.documentElement.lang = lang;
  if (!state) return;
  if (state.status === 'submitted') { renderSubmitted(latestQueue); return; }
  if (state.status === 'awaiting_review' || state.output) { renderReview(state.output); return; }
  // During active screening, ask server to re-localize the current question
  if (token && state.status === 'in_progress') {
    api('/api/patient/s/'+encodeURIComponent(token)+'/start',{method:'POST',body:JSON.stringify({language: lang})})
      .then((d)=>{ if(d.type==='review') renderReview(d.output); else if(d.question) renderQuestion(d); else renderWelcome(); })
      .catch(()=>{ if (q) drawQuestion(); else renderWelcome(); });
    return;
  }
  if (q) drawQuestion();
  else renderWelcome();
}

function langSelectHtml() {
  return '<div class="lang-bar"><select id="langSel" aria-label="Language">' +
    LANGS.map(x => '<option value="' + x.code + '"' + (lang === x.code ? ' selected' : '') + '>' + x.label + '</option>').join('') +
    '</select></div>';
}
function bindLang() {
  const s = document.getElementById('langSel');
  if (s) s.onchange = () => setLang(s.value);
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showError(msg){let e=document.getElementById('error');if(e){e.textContent=msg;e.classList.remove('hidden');}}
function clearError(){let e=document.getElementById('error');if(e)e.classList.add('hidden');}
function btn(text,cls='primary',id=''){return '<button id="'+id+'" class="'+cls+'">'+esc(text)+'</button>';}

async function api(path,opts={}){
  const r=await fetch(path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||t('wentWrong'));
  return d;
}

async function load(){
  if(!token){app.innerHTML=langSelectHtml()+'<div class="center"><h1>'+esc(t('title'))+'</h1><p class="muted">'+esc(t('incomplete'))+'</p></div>';bindLang();return;}
  try{
    state=await api('/api/patient/s/'+encodeURIComponent(token));
    if(state.patient && state.patient.ui_language){
      lang = normalizeLang(state.patient.ui_language);
      localStorage.setItem('screening_lang', lang);
    }
    if(state.status==='submitted'){renderSubmitted();return;}
    if(state.status==='awaiting_review'||state.output){renderReview(state.output);return;}
    renderWelcome();
  }catch(e){app.innerHTML=langSelectHtml()+'<div class="center"><h1>'+esc(t('title'))+'</h1><p class="muted">'+esc(t('invalid'))+'</p></div>';bindLang();}
}

function renderWelcome(){
  const p=state.patient;
  app.innerHTML=langSelectHtml()+'<div class="center"><div class="eyebrow">'+esc(t('private'))+'</div><h1>'+esc(t('title'))+'</h1>'+
  '<p class="muted start-note">'+esc(t('hello', p.patient_name))+'</p>'+
  '<p class="small">'+esc(t('notDx'))+'</p><div style="margin-top:24px">'+btn(t('start'),'primary','start')+'</div><div id="error" class="error hidden"></div></div>';
  bindLang();
  document.getElementById('start').onclick=startChat;
}
async function startChat(){
  clearError();document.getElementById('start').disabled=true;
  try{
    const d=await api('/api/patient/s/'+encodeURIComponent(token)+'/start',{method:'POST',body:JSON.stringify({language: lang})});
    if(d.type==='review')renderReview(d.output);else renderQuestion(d);
  }
  catch(e){document.getElementById('start').disabled=false;showError(e.message);}
}
let q=null,picks={},prog=null,busy=false;
function renderQuestion(d){q=d.question;prog=d.progress;picks={};busy=false;drawQuestion();}
function needsText(o){return o&&o.text;}
function valid(){
  if(!q)return false;
  if(q.input==='text')return !!(document.getElementById('free')||{value:''}).value.trim();
  const ids=Object.keys(picks);if(!ids.length)return false;
  return ids.every(id=>{const o=q.options.find(x=>x.id===id);return !(o&&o.text==='required')||String(picks[id]||'').trim();});
}
function refreshNext(){const n=document.getElementById('next');if(n)n.disabled=busy||!valid();}
function drawQuestion(){
  let head='';
  if(prog&&prog.current>0){
    const fu=prog.current>prog.fixed;
    head='<div class="eyebrow">'+(fu?t('followUpOf', prog.current-prog.fixed, prog.total-prog.fixed):t('questionOf', prog.current, prog.fixed))+'</div>'+
    '<div class="progress"><i style="width:'+Math.round(prog.current/prog.total*100)+'%"></i></div>';
  }else head='<div class="eyebrow">'+esc(t('clinical'))+'</div>';
  let body='';
  if(q.input==='radio'){
    body='<div class="radios">'+q.options.map(o=>'<label class="radio'+(o.id in picks?' sel':'')+'"><input type="radio" name="r" data-id="'+esc(o.id)+'"'+(o.id in picks?' checked':'')+'> '+esc(o.label)+'</label>').join('')+'</div>';
  }else if(q.input==='text'){
    body='<input id="free" class="typed" autocomplete="off" maxlength="300" placeholder="'+esc(t('typeAnswer'))+'">';
  }else{
    const one=q.options.length<=3&&q.input!=='multi';
    body='<div class="opts'+(one?' one':'')+'">'+q.options.map(o=>'<button type="button" class="opt'+(o.id in picks?' sel':'')+'" data-id="'+esc(o.id)+'">'+esc(o.label)+'</button>').join('')+'</div>';
    const withText=q.options.filter(o=>needsText(o)&&o.id in picks);
    body+=withText.map(o=>'<input class="typed" data-text="'+esc(o.id)+'" autocomplete="off" maxlength="200" value="'+esc(picks[o.id]||'')+'" placeholder="'+(o.text==='optional'?esc(t('whichAllergy')):esc(t('typeAnswer')))+'">').join('');
  }
  // Show English subtitle under Kannada question when bilingual fixed question has both
  const sub = (lang!=='en' && q.text_en && q.text_en!==q.text) ? '<span class="q-sub">'+esc(q.text_en)+'</span>' : '';
  app.innerHTML=langSelectHtml()+head+'<h2>'+esc(q.text)+sub+'</h2>'+body+'<div class="actions"><button id="next" class="primary" disabled>'+esc(t('next'))+'</button></div><div id="error" class="error hidden"></div>';
  bindLang();
  app.querySelectorAll('.opt').forEach(b=>b.onclick=()=>pick(b.dataset.id));
  app.querySelectorAll('.radio input').forEach(i=>i.onchange=()=>pick(i.dataset.id));
  app.querySelectorAll('[data-text]').forEach(i=>i.oninput=()=>{picks[i.dataset.text]=i.value;refreshNext();});
  const f=document.getElementById('free');if(f){f.oninput=refreshNext;f.onkeydown=e=>{if(e.key==='Enter'&&valid())sendAnswer();};f.focus();}
  document.getElementById('next').onclick=sendAnswer;
  const tx=app.querySelector('[data-text]');if(tx&&tx.value==='')tx.focus();
  refreshNext();
}
function pick(id){
  const o=q.options.find(x=>x.id===id);if(!o)return;
  if(q.input==='multi'){
    if(id in picks)delete picks[id];
    else{
      if(o.exclusive)picks={};
      else Object.keys(picks).forEach(k=>{const p=q.options.find(x=>x.id===k);if(p&&p.exclusive)delete picks[k];});
      picks[id]='';
    }
  }else{picks={};picks[id]='';}
  drawQuestion();
}
async function sendAnswer(){
  if(busy||!valid())return;
  busy=true;clearError();const n=document.getElementById('next');n.disabled=true;n.textContent=t('wait');
  const body=q.input==='text'?{text:document.getElementById('free').value.trim(),language:lang}:{selected:Object.keys(picks).map(id=>({id,text:picks[id]||''})),language:lang};
  try{
    const d=await api('/api/patient/s/'+encodeURIComponent(token)+'/message',{method:'POST',body:JSON.stringify(body)});
    if(d.type==='review')renderReview(d.output);else renderQuestion(d);
  }catch(e){busy=false;const nn=document.getElementById('next');if(nn){nn.textContent=t('next');}showError(e.message);refreshNext();}
}

function renderReview(output){
  state.output=output;
  const urgent=output?.screening_status==='urgent';
  app.innerHTML=langSelectHtml()+'<div class="eyebrow">'+esc(t('review'))+'</div><h2>'+esc(t('summaryTitle'))+'</h2>'+
  (urgent?'<div class="notice"><strong>'+esc(t('urgent'))+'</strong></div>':'')+
  '<p class="muted">'+esc(t('checkInfo'))+'</p>'+
  '<div id="summary" class="summary-grid">'+summaryFields(output)+'</div>'+
  '<div class="actions">'+btn(t('send'),'primary','submit')+'</div>'+
  '<div id="error" class="error hidden"></div><p class="small" style="margin-top:18px">'+esc(t('sendNote'))+'</p>';
  bindLang();
  document.getElementById('submit').onclick=submitSummary;
}
function summaryFields(o){
  return '<div class="field"><label>'+esc(t('yourAnswers'))+'</label><textarea data-key="summary" style="min-height:220px">'+esc(o.summary||'')+'</textarea></div>';
}
function collectSummary(){
  const el=document.querySelector('[data-key="summary"]');
  return {summary:el?el.value.trim():''};
}
async function submitSummary(){
  clearError();
  const b=document.getElementById('submit');b.disabled=true;
  try{
    const edited=collectSummary();
    await api('/api/patient/s/'+encodeURIComponent(token)+'/summary',{method:'PUT',body:JSON.stringify(edited)});
    const d=await api('/api/patient/s/'+encodeURIComponent(token)+'/submit',{method:'POST',body:'{}'});
    state.output=d.output;renderSubmitted(d.queue);
  }catch(e){showError(e.message);b.disabled=false;}
}
function renderSubmitted(queue){
  if(queueTimer){clearInterval(queueTimer);queueTimer=null;}
  latestQueue=queue||null;
  const initialToken=(state&&state.patient&&state.patient.queue_token)||null;
  const initialWaiting=state&&state.patient?state.patient.waiting_ahead:null;
  const q0=latestQueue||{token:initialToken,waiting_ahead:initialWaiting,status:null};
  const draw=()=>{
    const current=latestQueue||q0;
    const tokenNo=current&&current.token?current.token:initialToken;
    const w=current&&current.waiting_ahead!==undefined?current.waiting_ahead:initialWaiting;
    let box='';
    if(tokenNo){
      const status=String(current&&current.status||'').toLowerCase();
      const completed=status==='completed';
      box='<div class="tokenbox"><div class="small">'+esc(t('token'))+'</div><div class="tokenno">'+esc(tokenNo)+'</div>'+
      (completed?'<div class="ahead"><b>'+esc(t('completed'))+'</b></div><div class="small">'+esc(t('visitThanks'))+'</div>':
        (w===null||w===undefined?'':'<div class="ahead">'+(w===0?esc(t('nextInLine')):'<b>'+esc(w)+'</b> '+esc(t('ahead', w).replace(String(w)+' ','')) )+'</div><div id="queueUpdated" class="small">'+esc(t('updating'))+'</div>'))+
      '</div>';
    }
    app.innerHTML=langSelectHtml()+'<div class="center"><div class="eyebrow">'+esc(t('submitted'))+'</div><h1>'+esc(t('thanks'))+'</h1><p class="muted start-note">'+esc(t('sent'))+'</p>'+box+'<p class="small">'+esc(t('close'))+'</p></div>';
    bindLang();
  };
  draw();
  const poll=async()=>{
    const base=state&&state.queue_status_url;
    const clinicId=state&&state.patient&&state.patient.clinic_id;
    if(!base||!clinicId||!initialToken)return;
    try{
      const sep=base.includes('?')?'&':'?';
      const d=await fetch(base+sep+'clinicId='+encodeURIComponent(clinicId)+'&token='+encodeURIComponent(initialToken),{cache:'no-store'}).then(r=>r.ok?r.json():null);
      if(d&&d.ok){latestQueue=d;draw();}
    }catch{}
  };
  poll();
  queueTimer=setInterval(poll,5000);
}
load();
