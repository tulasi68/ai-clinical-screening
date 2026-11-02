import test from 'node:test';
import assert from 'node:assert/strict';
import { createErasureCase, getErasureCase, finalizeErasureCase } from '../src/store.js';

function installD1() {
  const calls = [];
  const old = globalThis.__SCREENING_D1;
  const binding = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async run() { calls.push({ kind: 'run', sql, args }); return { success: true, meta: { changes: 1 } }; },
        async first() {
          calls.push({ kind: 'first', sql, args });
          return {
            request_id: args[0], screening_id: 'SCR-TEST', clinic_id: 'clinic-a',
            status: 'received', reason_code: 'patient_erasure_request'
          };
        }
      };
    },
    async batch(statements) {
      const captured = statements.map((statement) => ({
        sql: statement.sql,
        args: statement.args
      }));
      calls.push({ kind: 'batch', statements: captured });
      return captured.map(() => ({ success: true, meta: { changes: 1 } }));
    }
  };
  // Expose bound SQL/args from the test-only prepared statement mock.
  const prepare = binding.prepare.bind(binding);
  binding.prepare = (sql) => {
    const statement = prepare(sql);
    const bind = statement.bind.bind(statement);
    statement.bind = (...args) => { statement.sql = sql; statement.args = args; return bind(...args); };
    return statement;
  };
  globalThis.__SCREENING_D1 = binding;
  return { calls, restore() { globalThis.__SCREENING_D1 = old; } };
}

test('erasure request register stores only scoped identifiers and reason code', async () => {
  const h = installD1();
  try {
    const created = await createErasureCase({
      screeningId: 'SCR-TEST',
      clinicId: 'clinic-a',
      reasonCode: 'patient_erasure_request'
    });
    assert.equal(created.status, 'received');
    const call = h.calls.find((x) => x.kind === 'run');
    assert.match(call.sql, /INSERT INTO screening_erasure_cases/);
    assert.deepEqual(call.args.slice(1, 4), ['SCR-TEST', 'clinic-a', 'patient_erasure_request']);
    assert.equal(call.args.some((x) => String(x).includes('patient name')), false);
  } finally {
    h.restore();
  }
});

test('approved erasure batches scoped session deletion with case completion', async () => {
  const h = installD1();
  try {
    const item = await getErasureCase('request-1');
    const completed = await finalizeErasureCase({
      requestId: item,
      clinicId: 'clinic-a',
      decision: 'approve',
      retentionBasis: 'consent_evidence_retention',
      outcomeCode: 'clinical_payload_deleted'
    });
    assert.equal(completed, true);
    const batch = h.calls.find((x) => x.kind === 'batch');
    assert.equal(batch.statements.length, 2);
    assert.match(batch.statements[0].sql, /DELETE FROM screening_sessions/);
    assert.match(batch.statements[0].sql, /json_extract\(patient_json, '\$\.clinic_id'\)/);
    assert.match(batch.statements[0].sql, /status='received'/);
    assert.match(batch.statements[1].sql, /UPDATE screening_erasure_cases/);
    assert.ok(batch.statements[1].args.includes('consent_evidence_retention'));
  } finally {
    h.restore();
  }
});

test('rejected erasure does not issue a clinical payload deletion', async () => {
  const h = installD1();
  try {
    const item = await getErasureCase('request-2');
    await finalizeErasureCase({
      requestId: item,
      clinicId: 'clinic-a',
      decision: 'reject',
      outcomeCode: 'clinic_declined_erasure'
    });
    const batch = h.calls.find((x) => x.kind === 'batch');
    assert.equal(batch.statements.length, 1);
    assert.match(batch.statements[0].sql, /UPDATE screening_erasure_cases/);
    assert.equal(batch.statements[0].sql.includes('DELETE FROM screening_sessions'), false);
  } finally {
    h.restore();
  }
});
