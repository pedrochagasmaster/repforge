## Acceptance checks (§7), run on F

34 screen renders (1 directions × 17 screens × PT and EN at 360 px) plus 22 interaction states (sheets open, disclosures open, the shelf field as a real input, chart toggles).

### 1. Targets ≥ 44 × 44: pass



### 2. Overflow at 360 PT: pass



### 3. Orange budget: pass



Orange elements found, by kind (every one is on the §3 allowlist):

| Dir | Kinds |
| --- | --- |
| F | verdict glyph, CTA arrow, active dock icon, current exercise segment, timer drain bar |

### 4. Parity: pass



Outcome words checked: 60 (oracle: `buildSessionDelta` and its helpers evaluated from app.js source, plus the evidence rules of `strengthEvidenceRecords`). Engine targets checked: 138 (each recomputed in Node with `RepForgeProgression.evaluateProgression`).

### 5. Strings: pass



