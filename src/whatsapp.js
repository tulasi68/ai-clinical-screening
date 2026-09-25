const GRAPH_BASE = 'https://graph.facebook.com';

function version() { return process.env.WA_API_VERSION || 'v21.0'; }
export function normalizePhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d;
}
function configured() { return Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN); }
async function call(payload) {
  if (!configured()) throw new Error('WhatsApp Cloud API is not configured');
  const url = `${GRAPH_BASE}/${version()}/${process.env.WA_PHONE_NUMBER_ID}/messages`;
  const r = await fetch(url, {method:'POST', headers:{Authorization:`Bearer ${process.env.WA_ACCESS_TOKEN}`,'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data?.error?.message || `WhatsApp API HTTP ${r.status}`);
  return {messageId:data?.messages?.[0]?.id || null, raw:data};
}
export async function sendText(to, body) {
  return call({messaging_product:'whatsapp',recipient_type:'individual',to:normalizePhone(to),type:'text',text:{preview_url:false,body:String(body).slice(0,4096)}});
}
export async function sendTemplate(to, templateName, languageCode='en', components=[]) {
  const template={name:templateName,language:{code:languageCode}};
  if (components?.length) template.components=components;
  return call({messaging_product:'whatsapp',to:normalizePhone(to),type:'template',template});
}
export async function sendInitial(to, patientName, complaint) {
  const name=process.env.WA_INITIAL_TEMPLATE_NAME;
  if (name) {
    return sendTemplate(to,name,process.env.WA_INITIAL_TEMPLATE_LANGUAGE||'en',[{type:'body',parameters:[{type:'text',text:String(patientName||'Patient')},{type:'text',text:String(complaint||'your health concern')}]}]);
  }
  return sendText(to,`Hello ${patientName || 'there'}. We received your information about ${complaint || 'your health concern'}. I will ask a few questions to collect information for your healthcare professional. This is not a diagnosis or prescription. Please answer in your own words.`);
}
export async function forwardWebhook(body) {
  const url=process.env.MEDILOOP_WEBHOOK_FORWARD_URL;
  if (!url) return false;
  try { await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return true; } catch { return false; }
}
