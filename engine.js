/**
 * FinTech Systems Lab — educational payment engine.
 * This module models application-level logic only. It does not connect to a payment rail.
 */
export const STATUSES = Object.freeze({
  SUCCESS: 'SUCCESS',
  DECLINED: 'DECLINED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
});

const ALLOWED_RAILS = new Set(['UPI', 'CARD', 'BANK_TRANSFER', 'WALLET', 'IMPS', 'NEFT', 'RTGS', 'INTERNATIONAL_TRANSFER']);
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function validatePayment(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['Payment request is required.'];
  if (typeof input.merchant !== 'string' || input.merchant.trim().length < 2) errors.push('Merchant reference must contain at least 2 characters.');
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) errors.push('Amount must be a positive number.');
  if (Number(input.amount) > 1_000_000) errors.push('Amount exceeds the simulation limit of INR 1,000,000.');
  if (!ALLOWED_RAILS.has(input.rail)) errors.push('Select a supported simulated payment rail.');
  if (typeof input.requestKey !== 'string' || input.requestKey.trim().length < 8) errors.push('Request key must contain at least 8 characters.');
  if (!['success', 'declined', 'timeout', 'invalid'].includes(input.scenario)) errors.push('Select a supported test scenario.');
  return errors;
}

export function createPayment(input, existingRequestKeys = new Set(), now = new Date()) {
  const errors = validatePayment(input);
  if (errors.length) return { ok: false, reason: 'VALIDATION_FAILED', errors };
  if (existingRequestKeys.has(input.requestKey)) {
    return { ok: false, reason: 'DUPLICATE_REQUEST', errors: ['This request key has already been used. No second transaction was created.'] };
  }
  const timestamp = now.toISOString();
  const id = input.id;
  const base = {
    id,
    requestKey: input.requestKey,
    merchant: input.merchant.trim(),
    amount: money(input.amount),
    currency: 'INR',
    rail: input.rail,
    status: STATUSES.SUCCESS,
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [],
    ledgerEntry: null,
    settlementEntry: null
  };
  const addEvent = (type, message, detail = '') => base.events.push({ at: timestamp, type, message, detail });
  addEvent('INITIATED', 'Payment request received', `Merchant reference: ${base.merchant}`);
  addEvent('VALIDATED', 'Request validation passed', 'Required fields, amount and simulated rail are valid.');

  if (input.scenario === 'invalid') {
    base.status = STATUSES.VALIDATION_FAILED;
    addEvent('VALIDATION_FAILED', 'Validation failed by selected test scenario', 'No authorisation decision or ledger entry was created.');
  } else if (input.scenario === 'declined') {
    base.status = STATUSES.DECLINED;
    addEvent('DECLINED', 'Simulated authorisation was declined', 'A decline is a final decision in this scenario; no success ledger entry was created.');
  } else if (input.scenario === 'timeout') {
    base.status = STATUSES.PENDING_REVIEW;
    addEvent('TIMEOUT', 'Processor response timed out', 'Outcome is uncertain. The system does not automatically create a second payment; investigate status before retrying.');
  } else {
    addEvent('AUTHORISED', 'Simulated authorisation approved', 'Approval is fictional and does not represent a real issuer or network decision.');
    base.ledgerEntry = { entryId: `LED-${id}`, transactionId: id, amount: base.amount, currency: base.currency, type: 'PAYMENT_RECEIVABLE', recordedAt: timestamp };
    base.settlementEntry = { entryId: `SET-${id}`, transactionId: id, amount: base.amount, currency: base.currency, status: 'SETTLED_IN_SIMULATION', recordedAt: timestamp };
    addEvent('RECORDED', 'Internal ledger and simulated settlement records created', 'Both records use the same transaction ID and amount.');
  }
  return { ok: true, transaction: base };
}

export function reconcile(transactions) {
  const successful = transactions.filter((tx) => tx.status === STATUSES.SUCCESS);
  const ledgerTotal = money(successful.reduce((sum, tx) => sum + (tx.ledgerEntry?.amount ?? 0), 0));
  const settlementTotal = money(successful.reduce((sum, tx) => sum + (tx.settlementEntry?.amount ?? 0), 0));
  const exceptions = [];
  for (const tx of successful) {
    if (!tx.ledgerEntry) exceptions.push({ transactionId: tx.id, reason: 'Missing internal ledger entry' });
    else if (tx.ledgerEntry.transactionId !== tx.id || money(tx.ledgerEntry.amount) !== money(tx.amount)) exceptions.push({ transactionId: tx.id, reason: 'Internal ledger does not match transaction' });
    if (!tx.settlementEntry) exceptions.push({ transactionId: tx.id, reason: 'Missing simulated settlement record' });
    else if (tx.settlementEntry.transactionId !== tx.id || money(tx.settlementEntry.amount) !== money(tx.amount)) exceptions.push({ transactionId: tx.id, reason: 'Settlement record does not match transaction' });
  }
  if (ledgerTotal !== settlementTotal) exceptions.push({ transactionId: 'TOTALS', reason: `Ledger total INR ${ledgerTotal.toFixed(2)} differs from simulated settlement total INR ${settlementTotal.toFixed(2)}` });
  return { checkedAt: new Date().toISOString(), transactionCount: successful.length, ledgerTotal, settlementTotal, matched: exceptions.length === 0, exceptions };
}
