## Acceptance checks (§7), run on D, E, F, G

136 screen renders (4 directions × 17 screens × PT and EN at 360 px) plus 90 interaction states (sheets open, disclosures open, the shelf field as a real input, chart toggles).

### 1. Targets ≥ 44 × 44: pass



### 2. Overflow at 360 PT: pass



### 3. Orange budget: pass



Orange elements found, by kind (every one is on the §3 allowlist):

| Dir | Kinds |
| --- | --- |
| D | verdict glyph, CTA arrow, active dock icon, current exercise segment, timer drain bar |
| E | verdict glyph, CTA arrow, active dock icon, current exercise segment, timer drain bar |
| F | verdict glyph, CTA arrow, active dock icon, current exercise segment, timer drain bar |
| G | verdict glyph, CTA arrow, active dock icon, current exercise segment, timer drain bar |

### 4. Parity: pass



Outcome words checked: 240 (oracle: `buildSessionDelta` and its helpers evaluated from app.js source, plus the evidence rules of `strengthEvidenceRecords`). Engine targets checked: 370 (each recomputed in Node with `RepForgeProgression.evaluateProgression`).

### 5. Strings: pass



