/** Discriminating controls for capture instrumentation, not generator policy. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createIdentityRules} from '../src/training/identity.js';
import {installOfferVerificationObserverInBrowser} from '../tools/ui-screens/screens-onboarding.mjs';

function fixture() {
  const previous = {window: globalThis.window, document: globalThis.document};
  const definition = {days: [{slots: [{id: 'slot-1', exerciseId: 'current'}]}]};
  const request = {movementConfirmations: {}};
  const offer = {slotId: 'slot-1', currentExerciseId: 'current', offeredExerciseId: 'offered', prerequisiteIds: ['confirmed']};
  let state = {draftId: 'draft-1', step: 'building', route: 'recommend', answers: {}};
  let rendered = [];
  class Transport extends EventTarget {
    sent = [];
    postMessage(message) { this.sent.push(message); }
    terminate() {}
    reply(message) { this.dispatchEvent(new MessageEvent('message', {data: message})); }
  }
  globalThis.document = {
    baseURI: 'https://fixture.test/',
    documentElement: {lang: 'en', dataset: {}},
    querySelector: selector => selector === '#entryReview .review__tabs' ? {} : null,
    querySelectorAll: selector => selector === '#entryReview [data-review-slot]' ? [{dataset: {reviewSlot: 'slot-1'}}]
      : selector === '#entryReview [data-review-confirm-offer]' ? rendered : [],
  };
  globalThis.window = {Worker: Transport, innerWidth: 390,
    __repforgeTrainingTest: {graphBase: 'https://fixture.test/', identity: createIdentityRules()},
    __repforgeEntryState: () => state};
  installOfferVerificationObserverInBrowser();
  const foreground = new window.Worker('https://fixture.test/src/platform/program-worker.js');
  foreground.postMessage({type: 'generate', id: 1, request});
  foreground.reply({id: 1, ok: true, value: {ok: true, value: definition, confirmationOffers: [offer]}});
  state = {...state, step: 'result', result: {fingerprint: 'result-1', preview: {programDefinition: structuredClone(definition)}}};
  const verifier = new window.Worker('https://fixture.test/src/platform/program-worker.js');
  verifier.postMessage({type: 'generate', id: 1, request: {movementConfirmations: {offered: ['confirmed']}}});
  return {
    verifier, foreground, snapshot: () => window.__catalogEntryOfferObserver.snapshot(),
    showOffer() { rendered = [{dataset: {reviewConfirmOffer: 'slot-1', reviewOfferExerciseId: 'offered'}}]; },
    makeStale() { state.result.preview.programDefinition.days[0].slots[0].exerciseId = 'newer'; },
    restore() { globalThis.window = previous.window; globalThis.document = previous.document; },
  };
}

for (const outcome of ['pending', 'rejected', 'error', 'messageerror']) {
  test(`empty rendered offers cannot certify ${outcome} verifier transport`, () => {
    const f = fixture();
    try {
      if (outcome === 'rejected') f.verifier.reply({id: 1, ok: false, message: 'worker failed'});
      if (outcome === 'error' || outcome === 'messageerror') f.verifier.dispatchEvent(new Event(outcome));
      assert.equal(f.snapshot().ready, false);
    } finally { f.restore(); }
  });
}
test('transport-successful compiler refusal is settled, with no eligible offer', () => {
  const f = fixture();
  try {
    f.verifier.reply({id: 1, ok: true, value: {ok: false, conflicts: ['independent refusal']}});
    assert.equal(f.snapshot().ready, true);
    assert.equal(f.snapshot().settledVerifierCount, 1);
    assert.equal(f.snapshot().eligibleCount, 0);
  } finally { f.restore(); }
});
test('accepted offer requires matching rendered pair and distinct worker identity', () => {
  const f = fixture();
  try {
    f.verifier.reply({id: 1, ok: true, value: {ok: true, value: {days: [{slots: [{id: 'slot-1', exerciseId: 'offered'}]}]}}});
    assert.equal(f.snapshot().ready, false);
    f.showOffer();
    const proof = f.snapshot();
    assert.equal(proof.ready, true);
    assert.notEqual(proof.foreground.engineId, proof.verifierJobs[0].engineId);
    assert.equal(f.foreground.sent.length, 1);
    assert.equal(f.verifier.sent.length, 1);
  } finally { f.restore(); }
});
test('successful stale foreground cannot bind to a newer preview', () => {
  const f = fixture();
  try {
    f.makeStale();
    f.verifier.reply({id: 1, ok: true, value: {ok: false}});
    assert.equal(f.snapshot().ready, false);
    assert.match(f.snapshot().readiness, /does not match/);
  } finally { f.restore(); }
});
