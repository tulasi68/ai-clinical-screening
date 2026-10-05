// Data-driven cascading screening engine.
// Flow: level1 (single primary complaint) -> that complaint's level2/level3 -> shared_tail.
// Only the selected complaint branch is asked — never mixes unrelated branches.

function answered(session, qid) {
  return (session.conversation || []).some((x) => x.role === 'patient' && x.qid === qid);
}

function answerIds(session, qid) {
  const a = [...(session.conversation || [])].reverse().find((x) => x.role === 'patient' && x.qid === qid);
  if (!a) return [];
  // Prefer structured selected[]; fall back to empty (do not guess from message text).
  const sel = a.selected;
  if (Array.isArray(sel) && sel.length) {
    return sel.map((x) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
  }
  return [];
}

function normalizeList(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

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
    for (const key of ['questions', 'level2', 'level3', 'items']) {
      if (value[key]) flatten(value[key], out);
    }
  }
  return out;
}

/** Only expand branches that exist in the pack and were actually selected. */
function selectedComplaintIds(pack, session) {
  const level1Id = pack?.level1?.id;
  if (!level1Id) return [];
  const complaints = pack?.complaints || {};
  const raw = answerIds(session, level1Id);
  // De-dupe, keep order, drop unknown ids (prevents stray branches).
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (!id || seen.has(id)) continue;
    if (!complaints[id]) continue;
    seen.add(id);
    out.push(id);
  }
  // Single primary path: only the first valid complaint is drilled into.
  // (level1 is single-select; if older sessions still have multi answers, take the first only.)
  return out.slice(0, 1);
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

function sharedTail(pack) {
  return flatten(pack?.shared_tail || []);
}

function nextUnanswered(questions, session) {
  for (const q of questions) {
    if (!q?.id || answered(session, q.id)) continue;
    if (!matchesShowIf(session, q.showIf)) continue;
    return q;
  }
  return null;
}

export function cascadingQuestions(pack, session) {
  if (!pack?.level1?.id || !pack?.complaints || typeof pack.complaints !== 'object') return [];
  const selected = selectedComplaintIds(pack, session);
  const out = [pack.level1];
  out.push(...complaintBranches(pack, selected).filter((q) => q?.id && matchesShowIf(session, q.showIf)));
  out.push(...sharedTail(pack).filter((q) => q?.id && matchesShowIf(session, q.showIf)));
  return out;
}

export function nextCascadingQuestion(pack, session) {
  if (!pack?.level1?.id || !pack?.complaints) return null;

  if (!answered(session, pack.level1.id)) return pack.level1;

  const selected = selectedComplaintIds(pack, session);
  // No recognised complaint → shared tail.
  const branchQuestion = nextUnanswered(complaintBranches(pack, selected), session);
  if (branchQuestion) return branchQuestion;

  return nextUnanswered(sharedTail(pack), session);
}

export function cascadingQuestionDef(pack, session, qid) {
  if (!pack || !qid) return null;
  if (pack.level1?.id === qid) return pack.level1;

  const selected = selectedComplaintIds(pack, session);
  const branch = complaintBranches(pack, selected).find((q) => q?.id === qid);
  if (branch) return branch;

  return sharedTail(pack).find((q) => q?.id === qid) || null;
}

export function isCascadingPack(pack) {
  return Boolean(pack?.level1?.id && pack?.complaints && typeof pack.complaints === 'object');
}
