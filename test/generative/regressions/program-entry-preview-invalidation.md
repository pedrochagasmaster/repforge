---
found-by: CI profile, 2026-08-27
property: program entry generated route switching resume restart and conflict journeys preserve state
master-seed: 564658125
suite-seed: 331354485
path: "140"
status: old fixture model retired with the pre-067 entry schema; answer-edit invalidation is covered by the production-backed `test/generative-entry-runtime.mjs` journey during the Plan 067 consumer migration
---

The minimized journey selected import, built a preview, edited answers while
already at preview, and tried to activate. `setAnswers` correctly invalidated
the compiled result. The old model incorrectly expected activation to remain
ready solely because the active-program revision had not changed. Its route and
fixture schema no longer match the Plan 067 producer, so the live browser
journey is the regression boundary now.

Frozen actions:

```json
[
  { "type": "select", "route": "import" },
  { "type": "advance" },
  { "type": "fill" },
  { "type": "advance" },
  { "type": "fill" },
  { "type": "activate" },
  { "type": "fill" },
  { "type": "reload" },
  { "type": "advance" }
]
```

The permanent assertion is that an answer edit cannot leave a stale result
bound to different answers or persist a result-less review draft. The current
browser journey edits an answer chip after preview and checks both live and
durable state.
