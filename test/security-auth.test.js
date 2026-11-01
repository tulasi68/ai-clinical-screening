import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidServiceCredential } from '../src/security.js';

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
