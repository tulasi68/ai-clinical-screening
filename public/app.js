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
  }
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
