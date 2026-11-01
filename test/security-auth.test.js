import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidServiceCredential, buildPatientUrl } from '../src/security.js';


test('tenant keys authorize only the clinic bound to the request header', () => {
  const tenantKeysJson = JSON.stringify({ 'clinic-a': 'key-a', 'clinic-b': 'key-b' });
  assert.equal(isValidServiceCredential({ clinicId:'clinic-a', suppliedKey:'key-a', tenantKeysJson, managedRuntime:true }), true);
  assert.equal(isValidServiceCredential({ clinicId:'clinic-b', suppliedKey:'key-a', tenantKeysJson, managedRuntime:true }), false);
  assert.equal(isValidServiceCredential({ clinicId:'clinic-c', suppliedKey:'key-a', tenantKeysJson, managedRuntime:true }), false);
  assert.equal(isValidServiceCredential({ clinicId:'', suppliedKey:'key-a', tenantKeysJson, managedRuntime:true }), false);
});

test('malformed tenant-key configuration fails closed', () => {
  assert.equal(isValidServiceCredential({ clinicId:'clinic-a', suppliedKey:'key-a', tenantKeysJson:'{bad', sharedKey:'key-a', managedRuntime:true }), false);
});

test('managed runtimes reject shared-key-only authentication unless explicitly enabled', () => {
  const base = { clinicId:'clinic-a', suppliedKey:'shared', sharedKey:'shared', managedRuntime:true };
  assert.equal(isValidServiceCredential(base), false);
  assert.equal(isValidServiceCredential({ ...base, allowSharedKey:true }), true);
  assert.equal(isValidServiceCredential({ clinicId:'clinic-a', suppliedKey:'shared', sharedKey:'shared', managedRuntime:false }), true);
});


test('patient links require a configured trusted HTTPS origin', () => {
  assert.throws(() => buildPatientUrl('', 'opaque-token', 'production'), /PATIENT_APP_URL must be configured/);
  assert.throws(() => buildPatientUrl('http://example.com', 'opaque-token', 'production'), /must use HTTPS/);
  assert.throws(() => buildPatientUrl('https://user:pass@example.com', 'opaque-token', 'production'), /must use HTTPS/);
  assert.throws(() => buildPatientUrl('https://example.com?host=evil', 'opaque-token', 'production'), /must use HTTPS/);
});

test('patient link origin ignores request host and safely encodes the token', () => {
  assert.equal(
    buildPatientUrl('https://patient.example.org/', 'token/with space', 'production'),
    'https://patient.example.org/s/token%2Fwith%20space'
  );
});

test('HTTP patient origin is permitted only for local non-production development', () => {
  assert.equal(buildPatientUrl('http://localhost:3000', 'token', 'development'), 'http://localhost:3000/s/token');
  assert.throws(() => buildPatientUrl('http://localhost:3000', 'token', 'production'), /must use HTTPS/);
});
