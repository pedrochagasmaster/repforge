---
found-by: CI profile, 2026-08-27
property: program entry generated route switching resume restart and conflict journeys preserve state
master-seed: 564658125
suite-seed: 331354485
path: "140"
status: fixed in the program-entry model; deterministic regression registered in test/generative/properties/program-entry.mjs
---

The minimized journey selected import, built a preview, edited answers while
already at preview, and tried to activate. `setAnswers` correctly invalidates
the compiled result. The model incorrectly expected activation to remain
ready solely because the active-program revision had not changed.

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

The permanent assertion is that an unchanged live revision is not sufficient:
when `result` is null, activation must answer `preview_not_ready` until the
preview is rebuilt.
