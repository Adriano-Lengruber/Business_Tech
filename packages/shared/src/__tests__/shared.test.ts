import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, MODULE_CATALOG, MODULE_CODES } from '../index.js';

test('RBAC role permissions follow least privilege', () => {
  assert.equal(hasPermission('owner', 'org:manage'), true);
  assert.equal(hasPermission('admin', 'modules:manage'), true);
  assert.equal(hasPermission('admin', 'org:manage'), false);
  assert.equal(hasPermission('technician', 'os:write'), true);
  assert.equal(hasPermission('technician', 'modules:manage'), false);
  assert.equal(hasPermission('viewer', 'os:write'), false);
});

test('MODULE_CATALOG covers core and pluggable SaaS modules', () => {
  assert.equal(MODULE_CATALOG.core.required, true);
  for (const code of MODULE_CODES) {
    assert.ok(MODULE_CATALOG[code]);
  }
});
