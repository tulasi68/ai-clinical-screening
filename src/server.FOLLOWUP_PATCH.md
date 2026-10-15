# Follow-up patch for `src/server.js`

Apply these three surgical edits to `src/server.js`. Do **not** replace the whole file.

---

## 1. Add import (near top, after flow.js import)

```js
import {
  isFollowUpSession,
  nextFollowUpQuestion,
  followUpQuestionDef,
} from './followUpQuestions.js';
```

---

## 2. Extend `specialtyQuestionDef` so follow-up qids resolve

Replace the existing `specialtyQuestionDef` function with:

```js
function specialtyQuestionDef(s, qid) {
  // Follow-up fixed questions take priority when session is a follow-up visit
  if (isFollowUpSession(s)) {
    const fu = followUpQuestionDef(qid);
    if (fu) return fu;
  }
  const spec = normalizeSpecialty(s.patient?.specialty);
  if (spec && spec !== 'ent') {
    const mod = getSpecialtyModule(spec);
    if (mod && typeof mod.questionDef === 'function') {
      return mod.questionDef(s, qid);
    }
  }
  return questionDef(s, qid);
}
```

---

## 3. Route follow-up sessions to the short question path

At the **start** of `continueBrowserSession`, add:

```js
async function continueBrowserSession(s) {
  // --- Follow-up visit: short fixed path ---
  if (isFollowUpSession(s)) {
    const next = nextFollowUpQuestion(s);
    if (next) return askQuestion(s, next, 'fixed');
    // All follow-up questions answered → consolidate
    return { type: 'review', output: publicOutput(await finishForReview(s, 'completed')) };
  }

  // ... existing specialty / ENT logic unchanged ...
```

---

## 4. (Optional but recommended) Tag output as follow-up

Inside `finishForReview`, after `const out = await consolidate(s);` add:

```js
  if (isFollowUpSession(s)) {
    out.visit_type = 'follow_up';
    out.prior_context = {
      prior_screening_id: s.patient?.prior_screening_id || null,
      prior_complaint: s.patient?.prior_complaint || null,
      days_since_last_visit: s.patient?.days_since_last_visit ?? null,
    };
  } else {
    out.visit_type = 'new';
  }
```

---

## 5. Ensure POST `/api/screenings` passes follow-up fields

Your existing handler already does `createSession(req.body)`. Because `createSession` in `store.js` now reads `is_follow_up`, `prior_*`, etc., **no change is required** in the route body as long as MediLoop sends those fields (the patched `clinical-screening/create/route.js` does).

If your create handler builds a custom object instead of spreading `req.body`, add:

```js
is_follow_up: Boolean(req.body.is_follow_up),
prior_screening_id: req.body.prior_screening_id,
prior_summary: req.body.prior_summary,
prior_prescription: req.body.prior_prescription,
prior_complaint: req.body.prior_complaint,
days_since_last_visit: req.body.days_since_last_visit,
```

to the object passed into `createSession`.

---

## Smoke test

1. Create a normal screening → full ENT/GM questions.
2. Complete a patient in MediLoop.
3. Register again with the **same phone** → confirm dialog → follow-up.
4. Patient link should ask only the 6 short follow-up questions.
5. Output should include `visit_type: "follow_up"`.
