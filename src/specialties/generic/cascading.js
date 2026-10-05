// Data-driven cascading screening engine.
// Supports JSON packs with: level1 -> complaints -> level2/level3 -> shared_tail.
// It is deliberately isolated from the General Medicine and ENT/Ear flows.

function answered(session, qid) {
  return (session.conversation || []).some((x) => x.role === 'patient' && x.qid === qid);
}

function answerIds(session, qid) {
  const a = [...(session.conversation || [])].reverse().find((x) => x.role === 'patient' && x.qid === qid);
  return (a?.selected || []).map((x) => x.id);
}

function normalizeList(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

// JSON showIf is intentionally small and declarative. Unknown operators fail closed
// for that condition rather than accidentally showing a question.
export function matchesShowIf(session, condition) {
  if (!condition) return true;
  if (Array.isArray(condition)) return condition.every((c) => matchesShowIf(session, c));
  if (typeof condition !== 'object') return true;

  if (condition.all) return normalizeList(condition.all).every((c) => matchesShowIf(session, c));
  if (condition.any) return normalizeList(condition.any).some((c) => matchesShowIf(session, c));
  if (condition.not) return !matchesShowIf(session, condition.not);

  const qid = condition.qid || condition.question;
  if (!qid) return false;
  const ids = answerIds(session, qid);

  if (condition.includes_any) return ids.some((id) => normalizeList(condition.includes_any).includes(id));
  if (condition.includes_all) return normalizeList(condition.includes_all).every((id) => ids.includes(id));
  if (condition.excludes_any) return !ids.some((id) => normalizeList(condition.excludes_any).includes(id));
  if (condition.equals) return ids.length === 1 && ids[0] === condition.equals;
  if (condition.not_equals) return !(ids.length === 1 && ids[0] === condition.not_equals);
  if (condition.answered === true) return answered(session, qid);
  if (condition.answered === false) return !answered(session, qid);
  return false;
}

function flatten(value, out = []) {
  if (!value) return out;
  if (Array.isArray(value)) {
    value.forEach((v) => flatten(v, out));
    return out;
  }
  if (typeof value === 'object') {
    if (value.id && value.text && value.type) out.push(value);
    // Common pack shapes: level2, level3, questions, items.
    for (const key of ['questions', 'level2', 'level3', 'items']) {
      if (value[key]) flatten(value[key], out);
    }
  }
  return out;
}

function complaintBranches(pack, selectedIds) {
  const complaints = pack?.complaints || {};
  const out = [];
  for (const id of selectedIds) {
    const branch = complaints[id];
    if (!branch) continue;
    flatten(branch, out);
  }
  return out;
}

export function cascadingQuestions(pack, session) {
  if (!pack?.level1?.id || !pack?.complaints || typeof pack.complaints !== 'object') return [];
  const selected = answerIds(session, pack.level1.id);
  const out = [pack.level1];
  for (const q of complaintBranches(pack, selected)) {
    if (!q?.id || answered(session, q.id)) continue;
    if (!matchesShowIf(session, q.showIf)) continue;
    out.push(q);
  }
  return out;
}

export function nextCascadingQuestion(pack, session) {
  if (!pack?.level1?.id || !pack?.complaints) return null;

  // Level 1 is always first and must be answered before any branch can open.
  if (!answered(session, pack.level1.id)) return pack.level1;

  const selected = answerIds(session, pack.level1.id);
  for (const q of complaintBranches(pack, selected)) {
    if (!q?.id || answered(session, q.id)) continue;
    if (!matchesShowIf(session, q.showIf)) continue;
    return q;
  }

  // shared_tail is supported by the schema, but is not automatically appended here.
  // The existing application's fixed tail remains in control unless a pack explicitly
  // exposes its own tail through a future module implementation.
  return null;
}

export function cascadingQuestionDef(pack, session, qid) {
  if (!pack || !qid) return null;
  if (pack.level1?.id === qid) return pack.level1;
  const selected = answerIds(session, pack.level1?.id);
  return complaintBranches(pack, selected).find((q) => q?.id === qid) || null;
}

export function isCascadingPack(pack) {
  return Boolean(pack?.level1?.id && pack?.complaints && typeof pack.complaints === 'object');
}
