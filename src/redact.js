/**
 * Redact common patient identifiers from log / error payloads.
 * Not a complete DLP solution — use for structured application logs only.
 */
const PHONE_RE = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const SENSITIVE_KEYS = new Set([
  'phone', 'patient_name', 'name', 'complaint', 'transcript', 'conversation',
  'patient_token', 'token', 'authorization', 'x-api-key', 'password',
  'patient_json', 'conversation_json', 'output_json', 'summary',
]);

export function redactString(value) {
  return String(value || '')
    .replace(PHONE_RE, '[phone]')
    .replace(EMAIL_RE, '[email]')
    .replace(TOKEN_RE, (m) => (m.length >= 40 ? '[token]' : m));
}

export function redactValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
        out[k] = '[redacted]';
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return '[unserializable]';
}

export function safeLog(level, message, meta) {
  const fn = console[level] || console.log;
  if (meta === undefined) {
    fn(redactString(message));
    return;
  }
  fn(redactString(message), redactValue(meta));
}
