import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayment, reconcile, STATUSES, validatePayment } from '../engine.js';

const input = (overrides = {}) => ({ id: 'FT-TEST-0001', merchant: 'Example Merchant', amount: 100.25, rail: 'UPI', scenario: 'success', requestKey: 'REQ-TEST-0001', ...overrides });
const fixedDate = new Date('2026-10-26T10:00:00.000Z');

test('valid request passes validation', () => assert.deepEqual(validatePayment(input()), []));
test('rejects zero and negative amounts', () => {
  assert.ok(validatePayment(input({ amount: 0 })).some((error) => error.includes('positive')));
  assert.ok(validatePayment(input({ amount: -2 })).some((error) => error.includes('positive')));
});
test('rejects unsupported rail and short request key', () => {
  assert.ok(validatePayment(input({ rail: 'MAGIC' })).some((error) => error.includes('rail')));
  assert.ok(validatePayment(input({ requestKey: 'abc' })).some((error) => error.includes('Request key')));
});
test('successful payment creates matching ledger and settlement records', () => {
  const result = createPayment(input(), new Set(), fixedDate);
  assert.equal(result.ok, true);
  assert.equal(result.transaction.status, STATUSES.SUCCESS);
  assert.equal(result.transaction.ledgerEntry.amount, 100.25);
  assert.equal(result.transaction.settlementEntry.transactionId, result.transaction.id);
  assert.ok(result.transaction.events.some((event) => event.type === 'RECORDED'));
});
test('decline does not create successful ledger records', () => {
  const tx = createPayment(input({ scenario: 'declined' }), new Set(), fixedDate).transaction;
  assert.equal(tx.status, STATUSES.DECLINED);
  assert.equal(tx.ledgerEntry, null);
  assert.equal(tx.settlementEntry, null);
});
test('timeout is pending review and does not auto-retry', () => {
  const tx = createPayment(input({ scenario: 'timeout' }), new Set(), fixedDate).transaction;
  assert.equal(tx.status, STATUSES.PENDING_REVIEW);
  assert.equal(tx.ledgerEntry, null);
  assert.ok(tx.events.some((event) => event.type === 'TIMEOUT'));
});
test('duplicate request key is rejected', () => {
  const result = createPayment(input(), new Set(['REQ-TEST-0001']), fixedDate);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'DUPLICATE_REQUEST');
});
test('reconciliation matches a valid successful transaction', () => {
  const tx = createPayment(input(), new Set(), fixedDate).transaction;
  const report = reconcile([tx]);
  assert.equal(report.matched, true);
  assert.equal(report.ledgerTotal, 100.25);
  assert.equal(report.settlementTotal, 100.25);
  assert.deepEqual(report.exceptions, []);
});
test('reconciliation detects missing settlement record', () => {
  const tx = createPayment(input(), new Set(), fixedDate).transaction;
  tx.settlementEntry = null;
  const report = reconcile([tx]);
  assert.equal(report.matched, false);
  assert.ok(report.exceptions.some((e) => e.reason.includes('Missing simulated settlement')));
});
test('invalid request is rejected before transaction creation', () => {
  const result = createPayment(input({ amount: 0 }), new Set(), fixedDate);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'VALIDATION_FAILED');
});

test('supports the educational rail options shown in the simulator', () => {
  for (const rail of ['UPI', 'IMPS', 'NEFT', 'RTGS', 'CARD', 'BANK_TRANSFER', 'INTERNATIONAL_TRANSFER', 'WALLET']) {
    assert.deepEqual(validatePayment(input({ rail })), [], `Expected ${rail} to be supported by the simulator`);
  }
});
