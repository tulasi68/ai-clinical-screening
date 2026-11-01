import crypto from 'node:crypto';

function constantTimeEqual(expected, supplied) {
  const a = Buffer.from(String(expected || '').trim());
  const b = Buffer.from(String(supplied || '').trim());
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Prefer a clinic-scoped key map. A configured but malformed map fails closed.
 * A shared key is accepted on managed runtimes only during an explicitly
 * enabled migration window; it is not equivalent to tenant isolation.
 */
export function isValidServiceCredential({
  clinicId, suppliedKey, tenantKeysJson, sharedKey,
  allowSharedKey = false, managedRuntime = false
}) {
  const clinic = String(clinicId || '').trim();
  const supplied = String(suppliedKey || '').trim();
  const rawMap = String(tenantKeysJson || '').trim();
  if (!clinic || !supplied) return false;

  if (rawMap) {
    let mapping;
    try { mapping = JSON.parse(rawMap); } catch { return false; }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return false;
    const expected = mapping[clinic];
    return typeof expected === 'string' && constantTimeEqual(expected, supplied);
  }

  if (managedRuntime && !allowSharedKey) return false;
  if (!String(sharedKey || '').trim()) return !managedRuntime;
  return constantTimeEqual(sharedKey, supplied);
}
