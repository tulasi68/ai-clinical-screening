import test from "node:test";
import assert from "node:assert/strict";
import {
  createPatientToken, hashPatientToken, revokePatientToken, redeemPatientToken, getSessionByPatientToken,
  appendConsentEvent, hasActiveConsent, createSession, getSession
} from "../src/store.js";

function fakeD1() {
  const sessions = new Map();
  const outputs = new Map();
  const events = [];
  return {
    sessions, outputs, events,
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async run() {
          if (sql.includes("SET patient_token_hash=NULL")) {
            const [expiresAt,updatedAt,screening_id] = args;
            const old=sessions.get(screening_id);
            if(old) sessions.set(screening_id,{...old,patient_token_hash:null,patient_token_expires_at:expiresAt,updated_at:updatedAt});
            return {success:true,meta:{changes:old?1:0}};
          }
          if (sql.includes("INSERT INTO screening_sessions")) {
            const [screening_id,status,created_at,updated_at,completed_at,submitted_at,patient_json,conversation_json,question_count,last_inbound_message_id,patient_token_hash,patient_token_expires_at] = args;
            sessions.set(screening_id,{screening_id,status,created_at,updated_at,completed_at,submitted_at,patient_json,conversation_json,question_count,last_inbound_message_id,patient_token_hash,patient_token_expires_at});
          } else if (sql.includes("UPDATE screening_sessions")) {
            const [status,updated_at,completed_at,submitted_at,patient_json,conversation_json,question_count,last_inbound_message_id,patient_token_hash,patient_token_expires_at,screening_id] = args;
            const old=sessions.get(screening_id);
            if(old) sessions.set(screening_id,{...old,status,updated_at,completed_at,submitted_at,patient_json,conversation_json,question_count,last_inbound_message_id,patient_token_hash,patient_token_expires_at});
          } else if (sql.includes("INSERT INTO screening_consent_events")) {
            const [id,screening_id,event_type,purpose,notice_version,occurred_at,language,method,channel,actor_type,evidence_json] = args;
            events.push({id,screening_id,event_type,purpose,notice_version,occurred_at,language,method,channel,actor_type,evidence_json});
          } else if (sql.includes("INSERT INTO screening_outputs")) {
            outputs.set(args[0],args[1]);
          }
          return {success:true,meta:{changes:1}};
        },
        async first() {
          if(sql.includes("UPDATE screening_sessions") && sql.includes("RETURNING *")) {
            const [newHash,newExpires,updatedAt,oldHash,now] = args;
            const old=[...sessions.values()].find(x=>x.patient_token_hash===oldHash && x.patient_token_expires_at>now);
            if(!old) return null;
            const updated={...old,patient_token_hash:newHash,patient_token_expires_at:newExpires,updated_at:updatedAt};
            sessions.set(old.screening_id,updated);
            return updated;
          }
          if(sql.includes("FROM screening_sessions")) {
            if(sql.includes("patient_token_hash")) return [...sessions.values()].find(x=>x.patient_token_hash===args[0] && x.patient_token_expires_at>args[1]) || null;
            return sessions.get(args[0]) || null;
          }
          if(sql.includes("FROM screening_outputs")) {
            const value=outputs.get(args[0]); return value ? {output_json:value} : null;
          }
          return null;
        },
        async all() {
          if(sql.includes("FROM screening_consent_events")) {
            return {results:events.filter(x=>x.screening_id===args[0]&&x.purpose===args[1]).sort((a,b)=>events.indexOf(a)-events.indexOf(b))};
          }
          if(sql.includes("FROM screening_sessions")) return {results:[...sessions.values()].filter(x=>x.status==="in_progress").sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,50)};
          return {results:[]};
        }
      };
    }
  };
}
function installDb() { const old=globalThis.__SCREENING_D1; globalThis.__SCREENING_D1=fakeD1(); return {db:globalThis.__SCREENING_D1,restore(){globalThis.__SCREENING_D1=old;}}; }

test("patient links use high-entropy opaque tokens and store only a digest", () => {
  const first=createPatientToken(), second=createPatientToken();
  assert.equal(first.length,43);
  assert.notEqual(first,second);
  assert.match(hashPatientToken(first),/^[a-f0-9]{64}$/);
  assert.notEqual(hashPatientToken(first),first);
});

test("screening sessions persist and patient-link revocation clears the digest", async () => {
  const h=installDb();
  try {
    const created=await createSession({patient_name:"Test",age:35,gender:"female",complaint:"Test complaint",phone:"9876543210",clinic_id:"clinic-test"});
    const before=await getSession(created.screening_id);
    assert.equal(before.patient.phone,"919876543210");
    assert.equal(before.patient_token_hash,hashPatientToken(created.patient_token));
    assert.equal(await revokePatientToken(created.screening_id),true);
    const after=await getSession(created.screening_id);
    assert.equal(after.patient_token_hash,null);
    assert.ok(new Date(after.patient_token_expires_at).getTime()<=Date.now()+1000);
  } finally { h.restore(); }
});

test("consent evidence is appended as a server event", async () => {
  const h=installDb();
  try {
    const row=await appendConsentEvent({screening_id:"SCR-CONSENT",event_type:"granted",purpose:"screening",notice_version:"notice-v1",method:"affirmative_checkbox",channel:"patient_screening_app"});
    assert.equal(row.event_type,"granted");
    assert.equal(h.db.events.length,1);
    assert.equal(h.db.events[0].actor_type,"patient");
    assert.ok(h.db.events[0].id);
  } finally { h.restore(); }
});

test("active consent follows the latest grant or withdrawal event", async () => {
  const h=installDb();
  try {
    const base={screening_id:"SCR-CONSENT",purpose:"screening",notice_version:"notice-v1"};
    await appendConsentEvent({...base,event_type:"granted"});
    assert.equal(await hasActiveConsent(base.screening_id,base.purpose,base.notice_version),true);
    await appendConsentEvent({...base,event_type:"withdrawn"});
    assert.equal(await hasActiveConsent(base.screening_id,base.purpose,base.notice_version),false);
    assert.equal(await hasActiveConsent(base.screening_id,base.purpose,"new-version"),false);
  } finally { h.restore(); }
});


test("patient URL token is atomically exchanged and cannot be replayed", async () => {
  const h=installDb();
  try {
    const created=await createSession({patient_name:"Test",age:35,gender:"female",complaint:"Test complaint",phone:"9876543210",clinic_id:"clinic-a"});
    const before=await getSession(created.screening_id);
    const exchanged=await redeemPatientToken(created.patient_token);
    assert.ok(exchanged);
    assert.equal(exchanged.session.screening_id,created.screening_id);
    assert.equal(exchanged.session.status,"in_progress");
    assert.notEqual(hashPatientToken(exchanged.token),hashPatientToken(created.patient_token));
    assert.equal(await getSessionByPatientToken(created.patient_token),null);
    assert.equal((await getSessionByPatientToken(exchanged.token)).screening_id,created.screening_id);
    assert.equal(await redeemPatientToken(created.patient_token),null);
    const after=await getSession(created.screening_id);
    assert.equal(after.conversation.length,before.conversation.length);
  } finally { h.restore(); }
});

test("expired and revoked patient URL tokens cannot be redeemed", async () => {
  const h=installDb();
  try {
    const expired=await createSession({patient_name:"Expired",age:35,gender:"female",complaint:"Test complaint",phone:"9876543210",clinic_id:"clinic-a"});
    const row=h.db.sessions.get(expired.screening_id);
    row.patient_token_expires_at=new Date(Date.now()-1000).toISOString();
    h.db.sessions.set(expired.screening_id,row);
    assert.equal(await redeemPatientToken(expired.patient_token),null);

    const revoked=await createSession({patient_name:"Revoked",age:36,gender:"female",complaint:"Test complaint",phone:"9876543211",clinic_id:"clinic-a"});
    assert.equal(await revokePatientToken(revoked.screening_id),true);
    assert.equal(await redeemPatientToken(revoked.patient_token),null);
  } finally { h.restore(); }
});

test("consent event time is generated by the server, not accepted from the caller", async () => {
  const h=installDb();
  try {
    const before=Date.now();
    const row=await appendConsentEvent({screening_id:"SCR-TIME",event_type:"granted",purpose:"screening",notice_version:"notice-v1",occurred_at:"2000-01-01T00:00:00.000Z"});
    const after=Date.now();
    const eventTime=Date.parse(row.occurred_at);
    assert.ok(eventTime>=before && eventTime<=after+1000);
    assert.notEqual(row.occurred_at,"2000-01-01T00:00:00.000Z");
  } finally { h.restore(); }
});

test("phone and specialty normalization handles punctuation and repeated whitespace", async () => {
  const h=installDb();
  try {
    const created=await createSession({
      patient_name:"Test", age:35, gender:"female", complaint:"Test complaint",
      phone:"+91 (98765) 432-10", clinic_id:"clinic-test", specialty:"General   Medicine"
    });
    assert.equal(created.patient.phone, "919876543210");
    assert.equal(created.patient.specialty, "general_medicine");
  } finally { h.restore(); }
});
