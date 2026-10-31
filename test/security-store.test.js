import test from "node:test";
import assert from "node:assert/strict";
import { createPatientToken, hashPatientToken, revokePatientToken, appendConsentEvent, hasActiveConsent } from "../src/store.js";

test("patient links use high-entropy opaque tokens and store only a digest", () => {
  const first = createPatientToken();
  const second = createPatientToken();
  assert.equal(first.length, 43);
  assert.notEqual(first, second);
  assert.match(hashPatientToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashPatientToken(first), hashPatientToken(first));
  assert.notEqual(hashPatientToken(first), first);
});

test("revoking a patient link clears its token digest and expires it", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(options.method || "GET").toUpperCase() === "GET") {
      return new Response(JSON.stringify([{
        screening_id: "SCR-TEST",
        status: "in_progress",
        created_at: "2026-10-31T00:00:00.000Z",
        updated_at: "2026-10-31T00:00:00.000Z",
        patient: { clinic_id: "clinic-test" },
        patient_token_hash: "a".repeat(64),
        patient_token_expires_at: "2026-11-03T00:00:00.000Z"
      }]), { status: 200 });
    }
    return new Response(null, { status: 204 });
  };
  try {
    assert.equal(await revokePatientToken("SCR-TEST"), true);
    const patch = calls.find((call) => call.options.method === "PATCH");
    assert.ok(patch);
    const payload = JSON.parse(patch.options.body);
    assert.equal(payload.patient_token_hash, null);
    assert.ok(new Date(payload.patient_token_expires_at).getTime() <= Date.now() + 1000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("consent evidence is appended as a server event", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const originalFetch = globalThis.fetch;
  let saved = null;
  globalThis.fetch = async (url, options = {}) => {
    saved = { url: String(url), options };
    return new Response(null, { status: 201 });
  };
  try {
    const row = await appendConsentEvent({
      screening_id: "SCR-CONSENT",
      event_type: "granted",
      purpose: "screening",
      notice_version: "notice-v1",
      method: "affirmative_checkbox",
      channel: "patient_screening_app"
    });
    assert.equal(row.event_type, "granted");
    assert.match(saved.url, /screening_consent_events$/);
    assert.equal(saved.options.method, "POST");
    assert.equal(JSON.parse(saved.options.body).actor_type, "patient");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("active consent follows the latest grant or withdrawal event", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const originalFetch = globalThis.fetch;
  let events = [{ event_type: "granted", notice_version: "notice-v1" }];
  globalThis.fetch = async () => new Response(JSON.stringify(events), { status: 200 });
  try {
    assert.equal(await hasActiveConsent("SCR-CONSENT", "screening", "notice-v1"), true);
    events = [
      { event_type: "granted", notice_version: "notice-v1" },
      { event_type: "withdrawn", notice_version: "notice-v1" }
    ];
    assert.equal(await hasActiveConsent("SCR-CONSENT", "screening", "notice-v1"), false);
    events = [{ event_type: "granted", notice_version: "old-notice" }];
    assert.equal(await hasActiveConsent("SCR-CONSENT", "screening", "notice-v1"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
