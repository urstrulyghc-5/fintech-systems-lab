import { createPayment, reconcile, STATUSES } from './engine.js';

const $ = (selector) => document.querySelector(selector);
const state = { transactions: [], selectedId: null, usedRequestKeys: new Set(), lastReconciliation: null, counter: 1 };
const statusLabels = {
  SUCCESS: ['Successful', 'success'], DECLINED: ['Declined', 'declined'],
  PENDING_REVIEW: ['Pending review', 'pending'], VALIDATION_FAILED: ['Validation failed', 'invalid']
};
const formatMoney = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
const formatTime = (iso) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function nextId() { return `FT-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(state.counter++).padStart(4, '0')}`; }
function renderMetrics() {
  $('#metric-total').textContent = state.transactions.length;
  $('#metric-success').textContent = state.transactions.filter((tx) => tx.status === STATUSES.SUCCESS).length;
  $('#metric-attention').textContent = state.transactions.filter((tx) => [STATUSES.PENDING_REVIEW, STATUSES.DECLINED, STATUSES.VALIDATION_FAILED].includes(tx.status)).length;
  $('#metric-recon').textContent = state.lastReconciliation ? (state.lastReconciliation.matched ? 'Matched' : 'Exceptions') : 'Not run';
}
function renderRows() {
  const filter = $('#filter-status').value;
  const rows = state.transactions.filter((tx) => filter === 'ALL' || tx.status === filter).slice().reverse();
  const tbody = $('#transaction-rows');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-table">No transactions match this view.</td></tr>'; return; }
  tbody.innerHTML = rows.map((tx) => {
    const [label, klass] = statusLabels[tx.status];
    return `<tr data-id="${escapeHtml(tx.id)}" class="${tx.id === state.selectedId ? 'selected' : ''}">
      <td><span class="tx-id">${escapeHtml(tx.id)}</span></td><td>${escapeHtml(tx.merchant)}</td><td class="amount">${formatMoney(tx.amount)}</td><td>${escapeHtml(tx.rail.replaceAll('_', ' '))}</td>
      <td><span class="status-badge ${klass}">${label}</span></td><td>${formatTime(tx.createdAt)}</td><td><button class="row-action" type="button" data-inspect="${escapeHtml(tx.id)}">Inspect ↗</button></td></tr>`;
  }).join('');
}
function lifecycleStage(tx) {
  if (!tx) return 'initiated';
  if (tx.status === STATUSES.VALIDATION_FAILED) return 'validated';
  if (tx.status === STATUSES.DECLINED || tx.status === STATUSES.PENDING_REVIEW) return 'authorised';
  return 'recorded';
}
function renderTrace() {
  const tx = state.transactions.find((item) => item.id === state.selectedId);
  const stages = ['initiated', 'validated', 'authorised', 'recorded'];
  const finalStage = lifecycleStage(tx);
  const finalIndex = stages.indexOf(finalStage);
  document.querySelectorAll('.life-step').forEach((el) => {
    const idx = stages.indexOf(el.dataset.stage);
    el.classList.toggle('active', Boolean(tx) && idx <= finalIndex);
    el.classList.toggle('done', Boolean(tx) && idx < finalIndex);
    el.classList.toggle('failed', Boolean(tx) && idx === finalIndex && tx.status !== STATUSES.SUCCESS);
  });
  if (!tx) {
    $('#trace-title').textContent = 'Event trail'; $('#trace-status').textContent = 'No transaction selected'; $('#trace-status').className = 'status-chip neutral';
    $('#event-list').innerHTML = '<li class="empty-state">Run a simulation to see its event trail here.</li>'; return;
  }
  const [label, klass] = statusLabels[tx.status];
  $('#trace-title').textContent = `${tx.id} · Event trail`;
  $('#trace-status').textContent = label; $('#trace-status').className = `status-chip ${klass}`;
  $('#event-list').innerHTML = tx.events.map((event) => `<li><span class="event-time">${formatTime(event.at)}</span><span class="event-text"><strong>${escapeHtml(event.message)}</strong><small>${escapeHtml(event.detail)}</small></span></li>`).join('');
}
function renderReconciliation(result) {
  const target = $('#recon-results');
  if (!result) { target.innerHTML = '<div class="empty-state">Run a reconciliation after creating transactions.</div>'; return; }
  const exceptionsHtml = result.exceptions.length ? `<ul>${result.exceptions.map((e) => `<li>${escapeHtml(e.transactionId)}: ${escapeHtml(e.reason)}</li>`).join('')}</ul>` : '';
  target.innerHTML = `<div class="recon-status">${result.matched ? '✓ Internal records match the simulated settlement report.' : '⚠ Reconciliation found exceptions that need investigation.'}</div><div class="recon-summary"><div class="recon-stat"><span>Successful records</span><strong>${result.transactionCount}</strong></div><div class="recon-stat"><span>Ledger total</span><strong>${formatMoney(result.ledgerTotal)}</strong></div><div class="recon-stat"><span>Settlement total</span><strong>${formatMoney(result.settlementTotal)}</strong></div></div>${exceptionsHtml}<p class="table-note">Checked at ${formatTime(result.checkedAt)}. This is an internal simulation only.</p>`;
}
function renderAll() { renderMetrics(); renderRows(); renderTrace(); }
function submitPayment(event) {
  event.preventDefault();
  const merchant = $('#merchant').value.trim();
  const amount = Number($('#amount').value);
  const rail = $('#method').value;
  const scenario = $('#scenario').value;
  const requestKey = `REQ-${crypto.randomUUID()}`;
  const input = { id: nextId(), merchant, amount, rail, scenario, requestKey };
  const result = createPayment(input, state.usedRequestKeys);
  const message = $('#form-message');
  if (!result.ok) { message.textContent = result.errors.join(' '); return; }
  state.usedRequestKeys.add(requestKey);
  state.transactions.push(result.transaction);
  state.selectedId = result.transaction.id;
  state.lastReconciliation = null;
  const labels = statusLabels[result.transaction.status];
  message.textContent = `${result.transaction.id} created: ${labels[0].toLowerCase()}. Inspect the event trail to see why.`;
  renderAll(); renderReconciliation(null);
}
function loadExamples() {
  const examples = [
    { merchant: 'Northstar Books', amount: 1250, rail: 'UPI', scenario: 'success' },
    { merchant: 'Cedar Foods', amount: 849.5, rail: 'CARD', scenario: 'declined' },
    { merchant: 'Meridian Supplies', amount: 12500, rail: 'BANK_TRANSFER', scenario: 'timeout' },
    { merchant: 'Harbour Studio', amount: 2200, rail: 'WALLET', scenario: 'success' },
    { merchant: 'Orchid Market', amount: 0, rail: 'UPI', scenario: 'invalid' }
  ];
  for (const example of examples) {
    const requestKey = `REQ-${crypto.randomUUID()}`;
    // Invalid scenario here means a valid request receives a simulated validation failure.
    const input = { ...example, id: nextId(), requestKey, amount: example.scenario === 'invalid' ? 2200 : example.amount };
    const result = createPayment(input, state.usedRequestKeys);
    if (result.ok) { state.usedRequestKeys.add(requestKey); state.transactions.push(result.transaction); }
  }
  state.selectedId = state.transactions.at(-1)?.id ?? null;
  state.lastReconciliation = null;
  $('#form-message').textContent = 'Example cases loaded. Select any row to inspect its processing trail.';
  renderAll(); renderReconciliation(null);
}
function runReconciliation() {
  state.lastReconciliation = reconcile(state.transactions);
  renderMetrics(); renderReconciliation(state.lastReconciliation);
}
$('#payment-form').addEventListener('submit', submitPayment);
$('#filter-status').addEventListener('change', renderRows);
$('#seed-button').addEventListener('click', loadExamples);
$('#reconcile-button').addEventListener('click', runReconciliation);
$('#transaction-rows').addEventListener('click', (event) => {
  const button = event.target.closest('[data-inspect]');
  const row = event.target.closest('tr[data-id]');
  const id = button?.dataset.inspect ?? row?.dataset.id;
  if (id) { state.selectedId = id; renderRows(); renderTrace(); }
});
renderAll();
