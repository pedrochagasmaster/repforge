import fc from "fast-check";
import { createHarness, runDraftStoreJourney } from "../model/workout-draft-store.mjs";

export const actions = fc.array(fc.oneof(
  { weight: 5, arbitrary: fc.constant({ type: "save" }) },
  { weight: 1, arbitrary: fc.constant({ type: "staleSave" }) },
  { weight: 1, arbitrary: fc.constant({ type: "remove" }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant("fault"), point: fc.constantFrom(
    "before-canonical-write", "after-canonical-write", "before-canonical-remove", "after-canonical-remove",
  ) }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant("quota"), keyPrefix: fc.constantFrom(
    "repforge_draft_v1", "repforge_draft_v1:v2-checkpoint",
  ), skipMatches: fc.integer({ min: 0, max: 1 }) }) },
  { weight: 2, arbitrary: fc.constant({ type: "reboot" }) },
), { minLength: 1, maxLength: 40 });

export function buildSuites() {
  return [{
    name: "workout draft store: generated saves, removals, faults and reboots never lose or invent a draft",
    property: fc.asyncProperty(actions, async sequence => {
      const h = createHarness();
      try { await runDraftStoreJourney(h, [...sequence, { type: "reboot" }]); }
      finally { h.dispose(); }
    }),
  }];
}
