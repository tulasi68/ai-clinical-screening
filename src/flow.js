// src/flow.js
// Fixed (non-AI) screening questions. The server owns the questions AND the choices,
// so the AI can never invent or corrupt an option list.
// Labels: English + Kannada (text_kn/label_kn) + hard-coded TX for other languages.
// AI follow-up questions (last 3) stay in English. Doctor-facing summary stays in English.

export const MAX_AI_QUESTIONS = 3;

const OTHER = { id: "other", label: "Type your answer", label_kn: "ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯಿರಿ", text: "required" };

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

export const FIXED_SETS = { ear: EAR_QUESTIONS };

const EAR_FALLBACKS = [
  { id: "fb_facial", text: "Have you noticed any weakness or drooping on one side of your face?", text_kn: "ಮುಖದ ಒಂದು ಬದಿಯಲ್ಲಿ ದುರ್ಬಲತೆ ಅಥವಾ ಜಾರುವಿಕೆ ಕಂಡಿದೆಯೇ?", type: "yes_no", redFlagIfYes: true },
  { id: "fb_hearing", text: "Have you noticed any drop in your hearing in this ear?", text_kn: "ಈ ಕಿವಿಯಲ್ಲಿ ಕೇಳುವ ಶಕ್ತಿ ಕಡಿಮೆಯಾಗಿದೆಯೇ?", type: "yes_no" },
  { id: "fb_touch", text: "Is the ear painful when you touch or pull it?", text_kn: "ಕಿವಿಯನ್ನು ಮುಟ್ಟಿದಾಗ ಅಥವಾ ಎಳೆದಾಗ ನೋವಾಗುತ್ತದೆಯೇ?", type: "yes_no", when: (a) => a.has("ear_feel", "pain") },
  { id: "fb_spin", text: "When you feel dizzy, does the room feel like it is spinning?", text_kn: "ತಲೆಸುತ್ತಾದಾಗ ಕೋಣೆ ಸುತ್ತುವಂತೆ ಅನಿಸುತ್ತದೆಯೇ?", type: "yes_no", when: (a) => a.has("ear_feel", "dizziness") },
  { id: "fb_swelling", text: "Is there any swelling or redness in or around the ear?", text_kn: "ಕಿವಿಯಲ್ಲಿ ಅಥವಾ ಸುತ್ತಲೂ ಊತ ಅಥವಾ ಕೆಂಪುತನ ಇದೆಯೇ?", type: "yes_no" },
  { id: "fb_past", text: "Have you had ear infections or ear surgery in the past?", text_kn: "ಹಿಂದೆ ಕಿವಿ ಸೋಂಕು ಅಥವಾ ಕಿವಿ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ ಆಗಿತ್ತೇ?", type: "yes_no" },
  { id: "fb_cold", text: "Do you have a cold, blocked nose or sore throat at the moment?", text_kn: "ಈಗ ನಿಮಗೆ ಜಲದೋಷ, ಮುಚ್ಚಿದ ಮೂಗು ಅಥವಾ ಗಂಟಲು ನೋವು ಇದೆಯೇ?", type: "yes_no" },
];

/** Localize a question for the patient UI. Doctor/contract stays English via option id + English labels in resolveAnswer. */

const TX = {
  "I have a problem with my…": {
    "hi": "मुझे समस्या है…",
    "ta": "எனக்கு பிரச்சனை உள்ளது…",
    "te": "నాకు సమస్య ఉంది…",
    "ml": "എനിക്ക് പ്രശ്നമുണ്ട്…",
    "bn": "আমার সমস্যা হচ্ছে…",
    "mr": "मला समस्या आहे…",
    "ur": "مجھے مسئلہ ہے…",
    "or": "ମୋର ସମସ୍ୟା ଅଛି…",
    "as": "মোৰ সমস্যা আছে…",
    "ne": "मलाई समस्या छ…"
  },
  "Ear": {
    "hi": "कान",
    "ta": "காது",
    "te": "చెవి",
    "ml": "ചെവി",
    "bn": "কান",
    "mr": "कान",
    "ur": "کان",
    "or": "କାନ",
    "as": "কাণ",
    "ne": "कान"
  },
  "Nose": {
    "hi": "नाक",
    "ta": "மூக்கு",
    "te": "ముక్కు",
    "ml": "മൂക്ക്",
    "bn": "নাক",
    "mr": "नाक",
    "ur": "ناک",
    "or": "ନାକ",
    "as": "নাক",
    "ne": "नाक"
  },
  "Throat": {
    "hi": "गला",
    "ta": "தொண்டை",
    "te": "గొంతు",
    "ml": "തൊണ്ട",
    "bn": "গলা",
    "mr": "घसा",
    "ur": "گلا",
    "or": "ଗଳା",
    "as": "ডিঙি",
    "ne": "घाँटी"
  },
  "Yes": {
    "hi": "हाँ",
    "ta": "ஆம்",
    "te": "అవును",
    "ml": "അതെ",
    "bn": "হ্যাঁ",
    "mr": "होय",
    "ur": "ہاں",
    "or": "ହଁ",
    "as": "হয়",
    "ne": "हो"
  },
  "No": {
    "hi": "नहीं",
    "ta": "இல்லை",
    "te": "కాదు",
    "ml": "ഇല്ല",
    "bn": "না",
    "mr": "नाही",
    "ur": "نہیں",
    "or": "ନା",
    "as": "নহয়",
    "ne": "होइन"
  },
  "Not sure": {
    "hi": "पक्का नहीं",
    "ta": "உறுதியில்லை",
    "te": "ఖచ్చితంగా తెలియదు",
    "ml": "ഉറപ്പില്ല",
    "bn": "নিশ্চিত নই",
    "mr": "खात्री नाही",
    "ur": "یقین نہیں",
    "or": "ନିଶ୍ଚିତ ନୁହେଁ",
    "as": "নিশ্চিত নহয়",
    "ne": "यकिन छैन"
  },
  "None": {
    "hi": "कोई नहीं",
    "ta": "ஏதுமில்லை",
    "te": "ఏదీ లేదు",
    "ml": "ഒന്നുമില്ല",
    "bn": "কিছুই নয়",
    "mr": "काही नाही",
    "ur": "کچھ نہیں",
    "or": "କିଛି ନାହିଁ",
    "as": "একো নাই",
    "ne": "केही छैन"
  },
  "Nothing": {
    "hi": "कुछ नहीं",
    "ta": "ஏதுமில்லை",
    "te": "ఏమీ లేదు",
    "ml": "ഒന്നുമില്ല",
    "bn": "কিছুই না",
    "mr": "काही नाही",
    "ur": "کچھ نہیں",
    "or": "କିଛି ନାହିଁ",
    "as": "একো নাই",
    "ne": "केही छैन"
  },
  "Type your answer": {
    "hi": "अपना उत्तर लिखें",
    "ta": "உங்கள் பதிலை எழுதுங்கள்",
    "te": "మీ సమాధానం రాయండి",
    "ml": "നിങ്ങളുടെ ഉത്തരം എഴുതുക",
    "bn": "আপনার উত্তর লিখুন",
    "mr": "तुमचे उत्तर लिहा",
    "ur": "اپنا جواب لکھیں",
    "or": "ଆପଣଙ୍କ ଉତ୍ତର ଲେଖନ୍ତୁ",
    "as": "আপোনাৰ উত্তৰ লিখক",
    "ne": "आफ्नो जवाफ लेख्नुहोस्"
  },
  "Left": {
    "hi": "बायाँ",
    "ta": "இடது",
    "te": "ఎడమ",
    "ml": "ഇടത്",
    "bn": "বাম",
    "mr": "डावा",
    "ur": "بائیں",
    "or": "ବାମ",
    "as": "বাওঁ",
    "ne": "बायाँ"
  },
  "Right": {
    "hi": "दायाँ",
    "ta": "வலது",
    "te": "కుడి",
    "ml": "വലത്",
    "bn": "ডান",
    "mr": "उजवा",
    "ur": "دائیں",
    "or": "ଡାହାଣ",
    "as": "সোঁ",
    "ne": "दायाँ"
  },
  "Both": {
    "hi": "दोनों",
    "ta": "இரண்டும்",
    "te": "రెండూ",
    "ml": "രണ്ടും",
    "bn": "দুটোই",
    "mr": "दोन्ही",
    "ur": "دونوں",
    "or": "ଦୁଇଟି",
    "as": "দুয়োটা",
    "ne": "दुवै"
  },
  "Which ear is affected?": {
    "hi": "कौन सा कान प्रभावित है?",
    "ta": "எந்த காது பாதிக்கப்பட்டுள்ளது?",
    "te": "ఏ చెవి ప్రభావితమైంది?",
    "ml": "ഏത് ചെവിയാണ് ബാധിച്ചത്?",
    "bn": "কোন কান আক্রান্ত?",
    "mr": "कोणता कान प्रभावित आहे?",
    "ur": "کون سا کان متاثر ہے؟",
    "or": "କେଉଁ କାନ ପ୍ରଭାବିତ?",
    "as": "কোন কাণ আক্রান্ত?",
    "ne": "कुन कान प्रभावित छ?"
  },
  "What are you feeling? (choose all that apply)": {
    "hi": "आपको क्या महसूस हो रहा है? (सभी लागू विकल्प चुनें)",
    "ta": "நீங்கள் என்ன உணர்கிறீர்கள்? (பொருந்தும் அனைத்தையும் தேர்ந்தெடுக்கவும்)",
    "te": "మీకు ఏమి అనిపిస్తోంది? (వర్తించే అన్నీ ఎంచుకోండి)",
    "ml": "നിങ്ങൾക്ക് എന്ത് തോന്നുന്നു? (ബാധകമായ എല്ലാം തിരഞ്ഞെടുക്കുക)",
    "bn": "আপনি কী অনুভব করছেন? (প্রযোজ্য সব বেছে নিন)",
    "mr": "तुम्हाला काय जाणवत आहे? (लागू असलेले सर्व निवडा)",
    "ur": "آپ کیا محسوس کر رہے ہیں؟ (تمام لاگو اختیارات منتخب کریں)",
    "or": "ଆପଣ କ’ଣ ଅନୁଭବ କରୁଛନ୍ତି? (ପ୍ରଯୁଜ୍ୟ ସବୁ ବାଛନ୍ତୁ)",
    "as": "আপুনি কি অনুভৱ কৰিছে? (প্ৰযোজ্য সকলো বাছনি কৰক)",
    "ne": "तपाईंलाई के महसुस भइरहेको छ? (लागु हुने सबै छान्नुहोस्)"
  },
  "Since how many days?": {
    "hi": "कितने दिनों से?",
    "ta": "எத்தனை நாட்களாக?",
    "te": "ఎన్ని రోజుల నుండి?",
    "ml": "എത്ര ദിവസമായി?",
    "bn": "কতদিন ধরে?",
    "mr": "किती दिवसांपासून?",
    "ur": "کتنے دنوں سے؟",
    "or": "କେତେ ଦିନ ଧରି?",
    "as": "কিমান দিনৰ পৰা?",
    "ne": "कति दिनदेखि?"
  },
  "Is there any discharge from the ear?": {
    "hi": "कान से कोई स्राव हो रहा है?",
    "ta": "காதிலிருந்து ஏதேனும் கசிவு உள்ளதா?",
    "te": "చెవి నుండి ఏదైనా స్రావం ఉందా?",
    "ml": "ചെവിയിൽ നിന്ന് എന്തെങ്കിലും സ്രവം ഉണ്ടോ?",
    "bn": "কান থেকে কোনো স্রাব হচ্ছে?",
    "mr": "कानातून काही स्त्राव आहे का?",
    "ur": "کان سے کوئی رطوبت نکل رہی ہے؟",
    "or": "କାନରୁ କିଛି ସ୍ରାବ ହେଉଛି କି?",
    "as": "কাণৰ পৰা কোনো স্ৰাৱ হৈছে নেকি?",
    "ne": "कानबाट कुनै स्राव भइरहेको छ?"
  },
  "In the last few days, did you have any of these? (choose all that apply)": {
    "hi": "पिछले कुछ दिनों में इनमें से कुछ हुआ? (सभी लागू चुनें)",
    "ta": "கடந்த சில நாட்களில் இவற்றில் ஏதேனும் இருந்ததா?",
    "te": "గత కొన్ని రోజుల్లో వీటిలో ఏదైనా ఉందా?",
    "ml": "കഴിഞ്ഞ ദിവസങ്ങളിൽ ഇതിൽ എന്തെങ്കിലും ഉണ്ടായിരുന്നോ?",
    "bn": "গতছ দিনে এর মধ্যে কিছু হয়েছিল?",
    "mr": "गेल्या काही दिवसांत यापैकी काही झाले का?",
    "ur": "پچھلے چند دنوں میں ان میں سے کچھ ہوا؟",
    "or": "ଗତ କିଛି ଦିନରେ ଏଗୁଡ଼ିକ ମଧ୍ୟରୁ କିଛି ହୋଇଥିଲା କି?",
    "as": "যোৱা কেইদিনমানত ইয়াৰে কিবা হৈছিল নেকি?",
    "ne": "पछिल्ला केही दिनमा यीमध्ये केही भयो?"
  },
  "Have you tried any medication?": {
    "hi": "क्या आपने कोई दवा ली है?",
    "ta": "ஏதேனும் மருந்து எடுத்துள்ளீர்களா?",
    "te": "ఏదైనా మందు వాడారా?",
    "ml": "എന്തെങ്കിലും മരുന്ന് കഴിച്ചിട്ടുണ്ടോ?",
    "bn": "কোনো ওষুধ খেয়েছেন?",
    "mr": "तुम्ही काही औषध घेतले का?",
    "ur": "کیا آپ نے کوئی دوائی لی ہے؟",
    "or": "ଆପଣ କୌଣସି ଔଷଧ ନେଇଛନ୍ତି କି?",
    "as": "আপুনি কোনো ঔষধ খৈছে নেকি?",
    "ne": "के तपाईंले कुनै औषधि सेवन गर्नुभयो?"
  },
  "Do you use ear buds?": {
    "hi": "क्या आप ईयर बड्स का उपयोग करते हैं?",
    "ta": "நீங்கள் இயர்பட்ஸ் பயன்படுத்துகிறீர்களா?",
    "te": "మీరు ఇయర్ బడ్స్ ఉపయోగిస్తారా?",
    "ml": "നിങ്ങൾ ഇയർ ബഡ്സ് ഉപയോഗിക്കാറുണ്ടോ?",
    "bn": "আপনি কি ইয়ার বাডস ব্যবহার করেন?",
    "mr": "तुम्ही इयर बड्स वापरता का?",
    "ur": "کیا آپ ایئر بڈز استعمال کرتے ہیں؟",
    "or": "ଆପଣ ଇଅର୍ ବଡ୍ସ ବ୍ୟବହାର କରନ୍ତି କି?",
    "as": "আপুনি ইয়াৰ বাডছ ব্যৱহাৰ কৰে নেকি?",
    "ne": "के तपाईं इयर बड्स प्रयोग गर्नुहुन्छ?"
  },
  "Do you have any allergy?": {
    "hi": "क्या आपको कोई एलर्जी है?",
    "ta": "உங்களுக்கு ஏதேனும் ஒவ்வாமை உள்ளதா?",
    "te": "మీకు ఏదైనా అలర్జీ ఉందా?",
    "ml": "നിങ്ങൾക്ക് എന്തെങ്കിലും അലർജി ഉണ്ടോ?",
    "bn": "আপনার কোনো অ্যালার্জি আছে?",
    "mr": "तुम्हाला काही अॅलर्जी आहे का?",
    "ur": "کیا آپ کو کوئی الرجی ہے؟",
    "or": "ଆପଣଙ୍କର କୌଣସି ଆଲର୍ଜି ଅଛି କି?",
    "as": "আপোনাৰ কোনো এলাৰ্জী আছে নেকি?",
    "ne": "के तपाईंलाई कुनै एलर्जी छ?"
  },
  "Do you have any medical condition? (choose all that apply)": {
    "hi": "क्या आपको कोई बीमारी है? (सभी लागू चुनें)",
    "ta": "உங்களுக்கு ஏதேனும் மருத்துவ நிலை உள்ளதா?",
    "te": "మీకు ఏదైనా వైద్య పరిస్థితి ఉందా?",
    "ml": "നിങ്ങൾക്ക് എന്തെങ്കിലും മെഡിക്കൽ അവസ്ഥയുണ്ടോ?",
    "bn": "আপনার কোনো শারীরিক সমস্যা আছে?",
    "mr": "तुम्हाला काही आजार आहे का?",
    "ur": "کیا آپ کو کوئی بیماری ہے؟",
    "or": "ଆପଣଙ୍କର କୌଣସି ରୋଗ ଅଛି କି?",
    "as": "আপোনাৰ কোনো ৰোগ আছে নেকি?",
    "ne": "के तपाईंलाई कुनै रोग छ?"
  },
  "Have you noticed any weakness or drooping on one side of your face?": {
    "hi": "क्या चेहरे के एक तरफ कमजोरी या लटकन महसूस हुई?",
    "ta": "முகத்தின் ஒரு பக்கத்தில் பலவீனம் அல்லது தொங்குதல் உள்ளதா?",
    "te": "ముఖం ఒక వైపు బలహీనత లేదా వంగడం ఉందా?",
    "ml": "മുഖത്തിന്റെ ഒരു വശത്ത് ബലഹീനതയോ തൂങ്ങലോ ഉണ്ടോ?",
    "bn": "মুখের একপাশে দুর্বলতা বা ঝুলে যাওয়া দেখেছেন?",
    "mr": "चेहऱ्याच्या एका बाजूला अशक्तपणा किंवा सटकणे जाणवले का?",
    "ur": "کیا چہرے کے ایک طرف کمزوری یا جھکاؤ محسوس ہوا؟",
    "or": "ମୁହଁର ଗୋଟିଏ ପାର୍ଶ୍ୱରେ ଦୁର୍ବଳତା ବା ଝୁଲିବା ଦେଖିଛନ୍ତି କି?",
    "as": "মুখৰ এফালে দুৰ্বলতা বা ওলমি যোৱা দেখিছে নেকি?",
    "ne": "अनुहारको एक तिर कमजोरी वा झुल्ने महसुस गर्नुभयो?"
  },
  "Have you noticed any drop in your hearing in this ear?": {
    "hi": "क्या इस कान में सुनने की क्षमता कम हुई है?",
    "ta": "இந்த காதில் கேட்கும் திறன் குறைந்துள்ளதா?",
    "te": "ఈ చెవిలో వినికిడి తగ్గిందా?",
    "ml": "ഈ ചെവിയിൽ കേൾവി കുറഞ്ഞിട്ടുണ്ടോ?",
    "bn": "এই কানে শোনার ক্ষমতা কমেছে?",
    "mr": "या कानात ऐकण्याची क्षमता कमी झाली का?",
    "ur": "کیا اس کان میں سننے کی صلاحیت کم ہوئی ہے؟",
    "or": "ଏହି କାନରେ ଶୁଣିବା କ୍ଷମତା କମିଛି କି?",
    "as": "এই কাণত শুনাৰ ক্ষমতা কমিছে নেকি?",
    "ne": "यो कानमा सुन्ने क्षमता घटेको छ?"
  },
  "Is the ear painful when you touch or pull it?": {
    "hi": "कान को छूने या खींचने पर दर्द होता है?",
    "ta": "காதைத் தொடும்போதோ இழுக்கும்போதோ வலி உண்டா?",
    "te": "చెవిని తాకితే లేదా లాగితే నొప్పి ఉందా?",
    "ml": "ചെവി തൊടുമ്പോഴോ വലിക്കുമ്പോഴോ വേദനയുണ്ടോ?",
    "bn": "কান স্পর্শ বা টানলে ব্যথা হয়?",
    "mr": "कानाला स्पर्श केल्यावर किंवा ओढल्यावर दुखते का?",
    "ur": "کان چھونے یا کھینچنے پر درد ہوتا ہے؟",
    "or": "କାନ ଛୁଇଁଲେ କିମ୍ବା ଟାଣିଲେ ଯନ୍ତ୍ରଣା ହୁଏ କି?",
    "as": "কাণ চুলে বা টানিলে বিষ হয় নেকি?",
    "ne": "कान छुँदा वा तान्दा दुख्छ?"
  },
  "When you feel dizzy, does the room feel like it is spinning?": {
    "hi": "चक्कर आने पर कमरा घूमता हुआ लगता है?",
    "ta": "தலைச்சுற்றும்போது அறை சுற்றுவது போல் தோன்றுகிறதா?",
    "te": "తల తిరిగినప్పుడు గది తిరుగుతున్నట్లు అనిపిస్తుందా?",
    "ml": "തലകറക്കം വരുമ്പോൾ മുറി കറങ്ങുന്നതായി തോന്നുന്നുണ്ടോ?",
    "bn": "মাথা ঘোরার সময় ঘর ঘুরছে বলে মনে হয়?",
    "mr": "चक्कर येताना खोली फिरत असल्यासारखे वाटते का?",
    "ur": "چکر آنے پر کمرہ گھومتا ہوا لگتا ہے؟",
    "or": "ମୁଣ୍ଡ ଘୂରିବା ବେଳେ କୋଠରୀ ଘୂରୁଥିବା ଭଳି ଲାଗେ କି?",
    "as": "মূৰ ঘূৰোতে কোঠা ঘূৰি থকা যেন লাগে নেকি?",
    "ne": "टाउको घुम्दा कोठा घुमिरहेको जस्तो लाग्छ?"
  },
  "Is there any swelling or redness in or around the ear?": {
    "hi": "कान में या आसपास सूजन या लालिमा है?",
    "ta": "காதில் அல்லது சுற்றி வீக்கம் அல்லது சிவப்பு உள்ளதா?",
    "te": "చెవిలో లేదా చుట్టూ వాపు లేదా ఎరుపు ఉందా?",
    "ml": "ചെവിയിലോ ചുറ്റുമോ വീക്കമോ ചുവപ്പോ ഉണ്ടോ?",
    "bn": "কানে বা আশেপাশে ফোলা বা লালভাব আছে?",
    "mr": "कानात किंवा आजूबाजूला सूज किंवा लालसरपणा आहे का?",
    "ur": "کان میں یا آس پاس سوجن یا لالی ہے؟",
    "or": "କାନରେ କିମ୍ବା ଚାରିପଟେ ଫୁଲା କିମ୍ବା ଲାଲିମା ଅଛି କି?",
    "as": "কাণত বা চাৰিওফালে ফুলা বা ৰঙা হোৱা আছে নেকি?",
    "ne": "कानमा वा वरपर सुन्निन वा रातोपन छ?"
  },
  "Have you had ear infections or ear surgery in the past?": {
    "hi": "पहले कभी कान का संक्रमण या सर्जरी हुई थी?",
    "ta": "முன்பு காது தொற்று அல்லது அறுவை சிகிச்சை இருந்ததா?",
    "te": "గతంలో చెవి ఇన్ఫెక్షన్ లేదా శస్త్రచికిత్స ఉందా?",
    "ml": "മുമ്പ് ചെവി അണുബാധയോ ശസ്ത്രക്രിയയോ ഉണ്ടായിരുന്നോ?",
    "bn": "আগে কানের সংক্রমণ বা অস্ত্রোপচার হয়েছিল?",
    "mr": "आधी कानाचा संसर्ग किंवा शस्त्रक्रिया झाली होती का?",
    "ur": "پہلے کان کا انفیکشن یا سرجری ہوئی تھی؟",
    "or": "ପୂର୍ବରୁ କାନ ସଂକ୍ରମଣ କିମ୍ବା ଅପରେସନ ହୋଇଥିଲା କି?",
    "as": "আগতে কাণৰ সংক্ৰমণ বা অস্ত্ৰোপচাৰ হৈছিল নেকি?",
    "ne": "पहिले कानको संक्रमण वा शल्यक्रिया भएको थियो?"
  },
  "Do you have a cold, blocked nose or sore throat at the moment?": {
    "hi": "अभी सर्दी, बंद नाक या गले में दर्द है?",
    "ta": "இப்போது சளி, மூக்கு அடைப்பு அல்லது தொண்டை வலி உள்ளதா?",
    "te": "ఇప్పుడు జలుబు, ముక్కు దిబ్బడ లేదా గొంతు నొప్పి ఉందా?",
    "ml": "ഇപ്പോൾ ജലദോഷം, മൂക്കടപ്പ് അല്ലെങ്കിൽ തൊണ്ടവേദന ഉണ്ടോ?",
    "bn": "এখন সর্দি, বন্ধ নাক বা গলা ব্যথা আছে?",
    "mr": "आता सर्दी, बंद नाक किंवा घसा दुखणे आहे का?",
    "ur": "ابھی زکام، بند ناک یا گلے میں درد ہے؟",
    "or": "ଏବେ ଥଣ୍ଡା, ବନ୍ଦ ନାକ କିମ୍ବା ଗଳା ଯନ୍ତ୍ରଣା ଅଛି କି?",
    "as": "এতিয়া চৰ্দি, বন্ধ নাক বা ডিঙিৰ বিষ আছে নেকি?",
    "ne": "अहिले रुघा, बन्द नाक वा घाँटी दुखाइ छ?"
  },
  "Itching": {
    "hi": "खुजली",
    "ta": "அரிப்பு",
    "te": "దురద",
    "ml": "ചൊറിച്ചിൽ",
    "bn": "চুলকানি",
    "mr": "खाज",
    "ur": "کھجلی",
    "or": "କୁଣ୍ଡିଆ",
    "as": "খিচনি",
    "ne": "चिलाउने"
  },
  "Pain": {
    "hi": "दर्द",
    "ta": "வலி",
    "te": "నొప్పి",
    "ml": "വേദന",
    "bn": "ব্যথা",
    "mr": "दुखणे",
    "ur": "درد",
    "or": "ଯନ୍ତ୍ରଣା",
    "as": "বিষ",
    "ne": "दुखाइ"
  },
  "Blocked": {
    "hi": "अवरुद्ध / भरा हुआ",
    "ta": "அடைப்பு",
    "te": "మూసుకుపోవడం",
    "ml": "അടഞ്ഞത്",
    "bn": "বন্ধ",
    "mr": "बंद",
    "ur": "بند",
    "or": "ବନ୍ଦ",
    "as": "বন্ধ",
    "ne": "बन्द"
  },
  "Dizziness": {
    "hi": "चक्कर",
    "ta": "தலைச்சுற்றல்",
    "te": "తల తిరగడం",
    "ml": "തലകറക്കം",
    "bn": "মাথা ঘোরা",
    "mr": "चक्कर",
    "ur": "چکر",
    "or": "ମୁଣ୍ଡ ଘୂରିବା",
    "as": "মূৰ ঘূৰোৱা",
    "ne": "टाउको घुम्ने"
  },
  "Ringing": {
    "hi": "घंटी जैसी आवाज़",
    "ta": "மணி ஒலி",
    "te": "గంట శబ్దం",
    "ml": "മണി ശബ്ദം",
    "bn": "ঘণ্টার মতো শব্দ",
    "mr": "घंट्यासारखा आवाज",
    "ur": "گھنٹی جیسی آواز",
    "or": "ଘଣ୍ଟା ଭଳି ଶବ୍ଦ",
    "as": "ঘণ্টাৰ দৰে শব্দ",
    "ne": "घन्टी जस्तो आवाज"
  },
  "Tinnitus": {
    "hi": "कान में शोर",
    "ta": "காதில் சத்தம்",
    "te": "చెవిలో శబ్దం",
    "ml": "ചെവിയിലെ ശബ്ദം",
    "bn": "কানে শব্দ",
    "mr": "कानात आवाज",
    "ur": "کان میں شور",
    "or": "କାନରେ ଶବ୍ଦ",
    "as": "কাণত শব্দ",
    "ne": "कानमा आवाज"
  },
  "Difficulty in swallowing": {
    "hi": "निगलने में कठिनाई",
    "ta": "விழுங்குவதில் சிரமம்",
    "te": "మింగడంలో కష్టం",
    "ml": "വിഴുങ്ങാൻ ബുദ്ധിമുട്ട്",
    "bn": "গিলতে অসুবিধা",
    "mr": "गिळण्यास त्रास",
    "ur": "نگلنے میں مشکل",
    "or": "ଗିଳିବାରେ କଷ୍ଟ",
    "as": "গিলাত অসুবিধা",
    "ne": "निल्न गाह्रो"
  },
  "1-2 days": {
    "hi": "1-2 दिन",
    "ta": "1-2 நாட்கள்",
    "te": "1-2 రోజులు",
    "ml": "1-2 ദിവസം",
    "bn": "১-২ দিন",
    "mr": "1-2 दिवस",
    "ur": "1-2 دن",
    "or": "୧-୨ ଦିନ",
    "as": "১-২ দিন",
    "ne": "१-२ दिन"
  },
  "3-5 days": {
    "hi": "3-5 दिन",
    "ta": "3-5 நாட்கள்",
    "te": "3-5 రోజులు",
    "ml": "3-5 ദിവസം",
    "bn": "৩-৫ দিন",
    "mr": "3-5 दिवस",
    "ur": "3-5 دن",
    "or": "୩-୫ ଦିନ",
    "as": "৩-৫ দিন",
    "ne": "३-५ दिन"
  },
  "5-7 days": {
    "hi": "5-7 दिन",
    "ta": "5-7 நாட்கள்",
    "te": "5-7 రోజులు",
    "ml": "5-7 ദിവസം",
    "bn": "৫-৭ দিন",
    "mr": "5-7 दिवस",
    "ur": "5-7 دن",
    "or": "୫-୭ ଦିନ",
    "as": "৫-৭ দিন",
    "ne": "५-७ दिन"
  },
  "No discharge": {
    "hi": "कोई स्राव नहीं",
    "ta": "கசிவு இல்லை",
    "te": "స్రావం లేదు",
    "ml": "സ്രവമില്ല",
    "bn": "কোনো স্রাব নেই",
    "mr": "स्त्राव नाही",
    "ur": "کوئی رطوبت نہیں",
    "or": "ସ୍ରାବ ନାହିଁ",
    "as": "স্ৰাৱ নাই",
    "ne": "स्राव छैन"
  },
  "Yes - Watery": {
    "hi": "हाँ - पानी जैसा",
    "ta": "ஆம் - நீர் போன்ற",
    "te": "అవును - నీరు లాంటి",
    "ml": "അതെ - വെള്ളം പോലെ",
    "bn": "হ্যাঁ - পানির মতো",
    "mr": "होय - पाण्यासारखे",
    "ur": "ہاں - پانی جیسا",
    "or": "ହଁ - ପାଣି ଭଳି",
    "as": "হয় - পানীৰ দৰে",
    "ne": "हो - पानी जस्तो"
  },
  "Yes - Yellow color": {
    "hi": "हाँ - पीला रंग",
    "ta": "ஆம் - மஞ்சள் நிறம்",
    "te": "అవును - పసుపు రంగు",
    "ml": "അതെ - മഞ്ഞ നിറം",
    "bn": "হ্যাঁ - হলুদ রং",
    "mr": "होय - पिवळा रंग",
    "ur": "ہاں - پیلا رنگ",
    "or": "ହଁ - ହଳଦିଆ ରଙ୍ଗ",
    "as": "হয় - হালধীয়া ৰং",
    "ne": "हो - पहेंलो रङ"
  },
  "Yes - Pus": {
    "hi": "हाँ - मवाद",
    "ta": "ஆம் - சீழ்",
    "te": "అవును - చీము",
    "ml": "അതെ - പഴുപ്പ്",
    "bn": "হ্যাঁ - পুঁজ",
    "mr": "होय - पू",
    "ur": "ہاں - پیپ",
    "or": "ହଁ - ପୂଜ",
    "as": "হয় - পুঁজ",
    "ne": "हो - पिप"
  },
  "Had fever": {
    "hi": "बुखार आया था",
    "ta": "காய்ச்சல் இருந்தது",
    "te": "జ్వరం వచ్చింది",
    "ml": "പനി ഉണ്ടായി",
    "bn": "জ্বর হয়েছিল",
    "mr": "ताप आला होता",
    "ur": "بخار آیا تھا",
    "or": "ଜ୍ୱର ହୋଇଥିଲା",
    "as": "জ্বৰ হৈছিল",
    "ne": "ज्वरो आएको थियो"
  },
  "Got wet in rain": {
    "hi": "बारिश में भीग गए",
    "ta": "மழையில் நனைந்தேன்",
    "te": "వర్షంలో తడిచాను",
    "ml": "മഴയിൽ നനഞ്ഞു",
    "bn": "বৃষ্টিতে ভিজেছি",
    "mr": "पावसात भिजलो",
    "ur": "بارش میں بھیگے",
    "or": "ବର୍ଷାରେ ଭିଜିଥିଲି",
    "as": "বৰষুণত তিতিলোঁ",
    "ne": "वर्षामा भिजियो"
  },
  "Water went into the ear": {
    "hi": "कान में पानी चला गया",
    "ta": "காதில் தண்ணீர் சென்றது",
    "te": "చెవిలో నీరు వెళ్లింది",
    "ml": "ചെവിയിൽ വെള്ളം കയറി",
    "bn": "কানে জল ঢুকেছে",
    "mr": "कानात पाणी गेले",
    "ur": "کان میں پانی چلا گیا",
    "or": "କାନରେ ପାଣି ପଶିଥିଲା",
    "as": "কাণত পানী সোমাল",
    "ne": "कानमा पानी पस्यो"
  },
  "Not tried": {
    "hi": "नहीं लिया",
    "ta": "எடுக்கவில்லை",
    "te": "ప్రయత్నించలేదు",
    "ml": "ശ്രമിച്ചിട്ടില്ല",
    "bn": "চেষ্টা করিনি",
    "mr": "घेतले नाही",
    "ur": "نہیں لیا",
    "or": "ନେଇ ନାହିଁ",
    "as": "লোৱা নাই",
    "ne": "लिएको छैन"
  },
  "Yes - Paracetamol": {
    "hi": "हाँ - पैरासिटामोल",
    "ta": "ஆம் - பாராசிட்டமால்",
    "te": "అవును - పారాసిటమాల్",
    "ml": "അതെ - പാരസെറ്റമോൾ",
    "bn": "হ্যাঁ - প্যারাসিটামল",
    "mr": "होय - पॅरासिटामॉल",
    "ur": "ہاں - پیراسیٹامول",
    "or": "ହଁ - ପାରାସିଟାମୋଲ",
    "as": "হয় - পেৰাচিটামল",
    "ne": "हो - प्यारासिटामोल"
  },
  "Yes - Antibiotic": {
    "hi": "हाँ - एंटीबायोटिक",
    "ta": "ஆம் - ஆண்டிபயாடிக்",
    "te": "అవును - యాంటీబయోటిక్",
    "ml": "അതെ - ആന്റിബയോട്ടിക്",
    "bn": "হ্যাঁ - অ্যান্টিবায়োটিক",
    "mr": "होय - अँटिबायोटिक",
    "ur": "ہاں - اینٹی بائیوٹک",
    "or": "ହଁ - ଆଣ୍ଟିବାୟୋଟିକ୍",
    "as": "হয় - এণ্টিবায়টিক",
    "ne": "हो - एन्टिबायोटिक"
  },
  "Not at all": {
    "hi": "बिल्कुल नहीं",
    "ta": "இல்லவே இல்லை",
    "te": "అసలు లేదు",
    "ml": "അതേ അല്ല",
    "bn": "মোটেই না",
    "mr": "अजिबात नाही",
    "ur": "بالکل نہیں",
    "or": "ଆଦୌ ନାହିଁ",
    "as": "একেবাৰে নহয়",
    "ne": "अहिलेसम्म होइन"
  },
  "Yes - sometimes": {
    "hi": "हाँ - कभी-कभी",
    "ta": "ஆம் - சில சமயம்",
    "te": "అవును - ఒక్కోసారి",
    "ml": "അതെ - ചിലപ്പോൾ",
    "bn": "হ্যাঁ - মাঝে মাঝে",
    "mr": "होय - कधीकधी",
    "ur": "ہاں - کبھی کبھار",
    "or": "ହଁ - ବେଳେବେଳେ",
    "as": "হয় - মাজে মাজে",
    "ne": "हो - कहिलेकाहीं"
  },
  "Yes - often": {
    "hi": "हाँ - अक्सर",
    "ta": "ஆம் - அடிக்கடி",
    "te": "అవును - తరచుగా",
    "ml": "അതെ - പലപ്പോഴും",
    "bn": "হ্যাঁ - প্রায়ই",
    "mr": "होय - नेहमी",
    "ur": "ہاں - اکثر",
    "or": "ହଁ - ପ୍ରାୟ",
    "as": "হয় - প্ৰায়ে",
    "ne": "हो - प्रायः"
  },
  "Diabetic": {
    "hi": "मधुमेह",
    "ta": "நீரிழிவு",
    "te": "మధుమేహం",
    "ml": "പ്രമേഹം",
    "bn": "ডায়াবেটিস",
    "mr": "मधुमेह",
    "ur": "ذیابیطس",
    "or": "ମଧୁମେହ",
    "as": "মধুমেহ",
    "ne": "मधुमेह"
  },
  "Blood pressure": {
    "hi": "रक्तचाप",
    "ta": "இரத்த அழுத்தம்",
    "te": "రక్తపోటు",
    "ml": "രക്തസമ്മർദ്ദം",
    "bn": "রক্তচাপ",
    "mr": "रक्तदाब",
    "ur": "بلڈ پریشر",
    "or": "ରକ୍ତଚାପ",
    "as": "ৰক্তচাপ",
    "ne": "रक्तचाप"
  }
};

const HI_FALLBACK = new Set(["bho", "mai", "mni", "brx"]);

function normLang(lang) {
  const s = String(lang || "en").toLowerCase().trim();
  if (s === "en" || s.startsWith("en")) return "en";
  if (s === "kn" || s.startsWith("kn")) return "kn";
  return s.split(/[-_]/)[0] || "en";
}

/** Hard-coded translation of fixed English UI strings. No live API. */
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
  if (L === "kn") {
    const text = q.text_kn || tr(q.text, "kn") || q.text;
    const options = (q.options || []).map((o) => ({
      ...o,
      label: o.label_kn || tr(o.label, "kn") || o.label,
    }));
    return { ...q, text, options };
  }
  if (L === "en") {
    return {
      ...q,
      text: q.text,
      options: (q.options || []).map((o) => ({ ...o, label: o.label })),
    };
  }
  const text = tr(q.text, L) || q.text;
  const options = (q.options || []).map((o) => ({
    ...o,
    label: tr(o.label, L) || o.label,
  }));
  return { ...q, text, options };
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
  if (site !== "ear") return null;
  const a = answerHelper(session);
  const asked = new Set((session.conversation || []).filter((x) => x.role === "assistant").map((x) => x.qid));
  return EAR_FALLBACKS.find((q) => !asked.has(q.id) && (!q.when || q.when(a))) || null;
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
    // Always store English label for doctor contract
    selected.push({ id: opt.id, label: opt.label, text: opt.text ? typed : "" });
  }
  if (selected.length > 1 && selected.some((s) => spec.options.find((o) => o.id === s.id)?.exclusive)) {
    return { ok: false, error: `"${selected.find((s) => spec.options.find((o) => o.id === s.id)?.exclusive).label}" cannot be combined with other choices.` };
  }
  const message = selected.map((s) => (s.id === "other" ? s.text : s.text ? `${s.label} (${s.text})` : s.label)).join(", ");
  return { ok: true, message, selected };
}

const RED_FLAG_TEXT = /facial (weakness|droop|paralysis)|face (is )?(drooping|numb)|can'?t breathe|difficulty breathing|unconscious|heavy bleeding/i;

const val = (s) => (s.id === "other" ? s.text : s.text ? `${s.label} (${s.text})` : s.label);
const list = (session, qid) => (patientAnswer(session, qid)?.selected || []).map(val);
const one = (session, qid) => list(session, qid)[0] || "";
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

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
