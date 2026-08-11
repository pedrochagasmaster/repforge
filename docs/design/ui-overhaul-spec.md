# RepForge UI overhaul — implementation spec

Source of truth: the nine mockups in `docs/design/mocks/` (view them with an image-capable
tool; they are PNG screens, 484×1024). This document translates them into engineering
requirements. Where a mockup and this spec disagree, this spec wins (it encodes scope
rulings). Where this spec is silent, match the mockup.

The overhaul is a **visual + navigation redesign only**. All existing behavior, domain
logic, data model, storage keys, i18n coverage (EN + PT), offline support, and tests must
survive. No new runtime dependencies, no build step, no framework — this stays a
hand-written static PWA (`index.html`, `styles.css`, `app.js`, `i18n.js`, `sw.js`).

## 0. Amendments after phone testing

These override the sections below where they conflict.

- **Focus mode is a swipeable card deck, with no dock.** The fixed dock was removed: it
  floated over a page that reserved no room for it, so content scrolled underneath. Focus
  mode keeps the normal tab bar and the normal body padding. Exercises are changed by
  dragging the card sideways — it tracks the pointer, tilts, rubber-bands at the ends of
  the session, and flies out past the threshold. Any part of the card except a text field
  starts the drag, and the click after a real drag is swallowed. Chevrons in the progress
  header (`#woPrev` / `#woNext`) and the ← / → keys do the same thing for reach and
  accessibility.
- **The current exercise is a literal card, on a stack.** White surface, hairline border,
  18px radius and a soft shadow. Up to two blank, tinted cards sit under it with 10px and
  20px lips showing; the stack thins as the session progresses, so the last exercise sits
  on a bare card. The cards behind carry no text — a deck shows card backs, not captions.
  Dragging lifts the top card off with a tilt and a deeper shadow, and the next exercise
  rises from the stack position into place rather than sliding in from the side. The deck
  carries the swipe affordance, so there is no hint copy and no "Up next" row. This is the
  one flat-design exception in Focus mode; List mode stays hairline-separated.
- **Focus mode ends at the deck.** List mode's bottom padding exists to clear the save
  button and set list; in Focus both live inside the card, so that padding is dropped and
  only a small margin sits between the deck and the tab bar.
- **Logging stays on the card.** The "Log set" button is attached to the current set, and
  Finish workout only appears once every set of the session is logged, so a finished
  exercise can no longer end the session by accident.
- **One rest timer for both modes.** The floating `#restBar` is the only rest surface, in
  the same place in both modes; Focus renders no chip of its own. The ⏱ starter lives in
  each exercise header in both modes.
- **The workout ⋯ menu is a popover.** It closes on any choice inside it, on an outside
  tap, and on Escape — iOS never delivers the focus loss a hover-era menu relied on.
- **No free-text quick entry.** The typed command bar is removed from the UI. Set-command
  parsing stays and backs voice input, which lives in the ⋯ menu and applies a spoken set
  directly (`applyCommandText`).
- **Home resumes an open session.** The Today CTA reads "Continue workout" whenever the
  draft holds logged or filled sets, and "Start workout" otherwise.
- **Entering and leaving a workout animates.** The workout shell rises into place and the
  dashboard settles back on return; both are skipped under `prefers-reduced-motion`.

## 1. Design language

The current "dark forge" theme (dark blue-black, ember gradients, condensed display font,
background grid) is replaced wholesale by a light editorial look:

- Calm cream/off-white surfaces, near-black ink, one burnt-orange accent.
- Flat: content is separated by 1px hairline rules and whitespace, not boxed cards or
  shadows. The few boxed elements (radio cards, settings groups, rest chip) use white
  fill, 1px hairline border, 12–16px radius. No gradients, no glows, no background grid.
- Tiny uppercase letterspaced labels introduce every section ("SESSÃO DE HOJE",
  "SÉRIE ATUAL"). Emphasized labels are orange, informational ones warm gray.
- One primary action per screen: full-width near-black pill button, white label,
  orange "→" glyph right-aligned inside the button.

### Design tokens (`:root` in `styles.css`)

Replace the existing token block. Names below are the new canon; alias or rename usages
consistently (a full find/replace across `styles.css` is expected; `app.js` references few
color literals, check them too).

```css
--bg:        #F4F2EF;  /* app background, warm off-white */
--surface:   #FFFFFF;  /* boxed elements: settings rows, radio cards, chips */
--ink:       #1B1A17;  /* primary text */
--ink-soft:  #6E6A63;  /* secondary text — keeps ≥4.5:1 on --bg */
--ink-faint: #98948C;  /* tertiary: placeholders, disabled, out-of-month days */
--rule:      #E4E1DA;  /* 1px hairlines */
--rule-strong:#D9D5CD; /* section-separating rules */
--accent:    #E04E14;  /* burnt orange: active tab, links, current segments, chart line */
--accent-deep:#B8410E; /* filled toggle tracks, pressed states */
--positive:  #2F7D33;  /* "on target" volume bars */
--cta:       #161513;  /* black pill button fill */
--cta-ink:   #FFFFFF;
--danger:    #C93A2B;  /* destructive rows/buttons */
--radius:    14px;
--nav:       72px;
--maxw:      560px;    /* mobile-first single column; narrower than today's 760px */
```

`color-scheme: light`. `<meta name="theme-color">` becomes `#F4F2EF`. Light theme only —
do **not** build a dark mode or an "Appearance" setting.

### Typography

- Drop Saira Condensed entirely: remove its `@font-face` rules, its `--display` usages,
  the woff2 entries in `sw.js` ASSETS (the font files may stay in `fonts/`).
- Everything uses **Plex Sans** (already self-hosted, variable weight 100–700):
  - Screen titles ("Hoje", "Progresso"): 30–32px, weight 650, letter-spacing −0.02em.
  - Content headings (exercise name, session name): 22–24px, weight 640.
  - Body/rows: 15–16px, weight 400–500.
  - Uppercase section labels: 11px, weight 600, letter-spacing 0.08em.
  - Big stepper numerals (workout screen): 32–36px, weight 620.
- All numeric readouts use `font-variant-numeric: tabular-nums`.
- Plex Mono may remain for the rest-timer digits only; nothing else.

### Core components

- **Primary CTA** (`Começar treino`, `Registrar série`, `Continuar`, `Começar próximo
  bloco`): full-width, height ~54px, `--cta` fill, `--radius`, 17px/600 white label
  centered, orange `→` near the right edge. Secondary action under it is a plain centered
  text link (ink or orange per mock).
- **List row**: 52–56px min height, hairline bottom rule, left label 16px/500 ink,
  right-aligned value in `--ink-soft`, optional `›` chevron in `--ink-faint`.
- **Stat row**: horizontal band split into 2–4 equal cells separated by hairlines; big
  number (22–24px/650) over an 12px `--ink-soft` caption. Attention counts get an orange
  dot suffix.
- **Segmented week/progress bar**: N equal rounded bars (height 4px, gap 6px), done =
  `--accent`, current may be `--accent` too, remaining = `--rule-strong`.
- **Recommendation block**: 3px orange left rule, inset padding; orange 11px uppercase
  label, 18px/640 headline ("Mantenha 80 kg"), one `--ink-soft` line, one 13px
  `--ink-faint` caption.
- **In-page tabs** (Progress sections): text row, active item ink with 2px orange
  underline, inactive `--ink-soft`; hairline under the whole row.
- **Toggle**: iOS-style, 51×31, `--accent-deep` track when on, white knob.
- **Radio card** (onboarding, block review): white surface, hairline border, radius 14px;
  selected: 1.5px orange border + orange-filled radio with white check; a small
  "RECOMENDADO" orange tag when applicable (block review).
- **Bottom tab bar**: fixed, `--bg` with hairline top rule (translucent blur optional),
  four items: icon 22px + 11px label; active = orange icon+label, inactive `--ink-soft`.
  Respect `env(safe-area-inset-bottom)`.
- **Charts** (canvas, keep existing drawing approach restyled): cream background, hairline
  horizontal gridlines, 11px `--ink-faint` axis labels, 2px `--accent` line with 3.5px
  dots, terminal value in a small dark badge or orange annotation per mock; PR points get
  a ringed "PR" marker (mock 06).

## 2. Navigation restructure

Bottom nav goes from five buttons to **four**: `log` ("Hoje"/"Today"), `stats`
("Progresso"/"Progress"), `history` ("Histórico"/"History"), `program`
("Programa"/"Program"). Keep the `data-view` mechanism and view ids exactly as they are
(`#log`, `#stats`, `#history`, `#program`, `#settings`, `#exercise`, `#onboarding`).

- **Settings** leaves the tab bar. It is reached by a profile/person icon button in the
  Today header (mock 02, top right). The settings view gets a header back button
  ("‹ Hoje" style, orange, mock 07). `navTo("settings")` and every
  `$('nav button[data-view=…]')` call site must be audited — settings no longer has a nav
  button, so guard those lookups.
- The old global `header.topbar` (brand wordmark, heat gauge, install button) is
  **removed**. Mock screens have per-view headers instead. Relocate what it hosted:
  - Rest timer chip → lives in the workout screen's bottom action bar (mock 01) and may
    float above the tab bar on other screens while running.
  - Heat-gauge information ("N lifts ready") → the orange-dot line on the Today card
    ("2 exercícios prontos para aumentar", mock 02); the standalone gauge dies.
  - Install button → Settings ("Add to home screen" row) and the existing install banner.
- Tab icons: redraw the four CSS mask SVGs to match mocks (house / bar chart /
  clock-with-arrow / clipboard-list). Settings icon still needed on the Today header.
- Update nav i18n strings: `nav.log` → "Today"/"Hoje" etc.

## 3. Screens

### 3.1 Today (`#log`) — mock `02-today.png`

The Log tab becomes a dashboard; actual set logging becomes the "active workout" flow
below. Top to bottom:

1. Header: huge "Hoje" title, `--ink-soft` full date line ("Domingo, 9 de agosto");
   right: circled person icon → settings.
2. Program strip: program name (16px/600), "Semana 3 de 6" `--ink-soft`, mesocycle
   segmented bar. Data: `state.programMeta.name`, `mesocycleWeek()`. Hidden when no
   program meta/name.
3. "SESSÃO DE HOJE" label + session block: training-day name huge (28px/650), muscle
   list `--ink-soft` ("Peito · Ombros · Tríceps" — derive from the day's exercise primary
   muscles, deduped, capped at 3), "N exercícios" meta line (omit the "~52 min" estimate:
   sessions don't track duration), orange-dot readiness line "N exercícios prontos para
   aumentar" (count of exercises whose recommendation is an increase) when N > 0.
4. Primary CTA "Começar treino" → enters the active workout (below). Under it, centered
   text link "Ver exercícios" → expands/scrolls to the exercise list without starting.
5. "ESTA SEMANA": "X de Y sessões concluídas" (from `weeklySnapshot()`/adherence) and a
   Monday-start weekday letter row (PT: S T Q Q S S D; EN: M T W T F S S) — trained days
   get a ✓, today gets an orange dot, rest are faint dots.
6. "A SEGUIR": next training day row (name, "· N exercícios", chevron) — the next day in
   the split after today's; tapping selects that day on the workout screen.
7. Footer line, `--ink-faint`, clock icon: "Último treino há N dias" (from last log date).
8. The existing day selector (`#dayTabs`), session/unfinished/fatigue banners, and
   "Editar sessão" affordances survive, restyled: banners become flat notice rows.

**Active workout** (started via CTA, or "Ver exercícios" then logging) — mock
`01-active-workout.png`. This restyles the existing List/Focus log modes; per-set commit,
suggestions, warmups, substitution, skip, command bar, voice, notes, bodyweight all keep
working:

- Session header: chevron-down button (back to dashboard), centered training-day name +
  "Semana N" subtitle, "…" overflow. Overflow menu (or the restyled existing controls
  region) hosts: List/Focus mode switch, date picker, command-bar toggle, skip/trim.
- "EXERCÍCIO n DE m" + per-exercise segmented progress (completed = dark, current =
  orange, rest = faint) — maps to Focus mode's index.
- Exercise block: muscle eyebrow, name (26px/650), "SÉRIE x / y" (x orange), target line
  "ALVO 4–8 reps · RIR 0–2", note icon → exercise session note.
- Completed sets: four-column table (SÉRIE KG REPS RIR) with a ✓ per committed set.
- "SÉRIE ATUAL": three stepper cells (CARGA orange label + kg unit, REPS, RIR) with big
  numerals and − / + buttons; keep inputs type=text inputmode=decimal under the hood so
  the command bar and tests still work.
- Recommendation block (component above) from `recommendation(ex)` copy.
- "A SEGUIR" row: next exercise name + set count + chevron (advances focus).
- Sticky bottom bar (above tab bar or replacing it during workout): rest chip
  (timer icon, "DESCANSO" label, mm:ss countdown from `restSec`) + primary CTA
  "Registrar série" (commits current set; last set of last exercise becomes
  "Finish workout" semantics — keep existing save flow and `#saveMeta`).
- List mode keeps all exercises stacked with the same styling (each exercise block +
  its sets); Focus mode is the mock's one-exercise-at-a-time layout.

### 3.2 Progress (`#stats`) — mock `03-progress.png`

Keep all five segments but style per mock; "Review" stays as a fifth tab (mock shows
four; ruling: keep Review reachable here AND from Program's "Revisar bloco").

- Header: "Progresso" title; right side "4 semanas ›" period affordance may be static
  text bound to the existing 7/28-day window toggle (relabel: "7 dias"/"28 dias").
- Tabs: Visão geral / Força / Volume / PRs / Revisão (in-page tab component).
- Overview, top to bottom:
  - "ESTA SEMANA" label; line "2 de 4 sessões · 28 séries efetivas"; stat row
    3 melhoraram / 8 estáveis / 1 atenção (existing weekly snapshot + attention data;
    "atenção" cell gets the orange dot).
  - "PRONTOS PARA PROGREDIR": rows per ready exercise — name, reason line
    (`--ink-soft`), right-aligned orange "+2,5 kg" delta + chevron → exercise page.
    From the attention/recommendation engine's increase list.
  - "TENDÊNCIA DE FORÇA": exercise picker (name + caret, restyled `#statExercise`),
    "e1RM estimado" caption, line chart, terminal value annotated orange.
  - "VOLUME · 7 DIAS" + "Ver volume ›" link (→ Volume tab): per-muscle rows — name,
    "done / target", thin bar (fill `--positive` when on target, `--accent` when below),
    right status word ("No alvo" / "Abaixo").
  - The "Dig deeper" details/tables survive at the bottom of Overview, restyled flat.
- Strength / Volume / PRs / Review segments: keep current content, restyled (tables →
  flat hairline rows; PR filter seg → in-page tabs or pill row).

### 3.3 History (`#history`) — mock `04-history.png`

- Header: "Histórico"; right: search icon (filters the session list by exercise/day
  name — simple client-side filter over rendered sessions; a visible input may appear
  under the header when tapped) and a clipboard/export icon (triggers existing CSV
  export).
- Month calendar: "‹ Agosto de 2026 ›" pager; under it a summary line for the shown
  month: "N sessões · M séries" (omit duration — not tracked). Grid: weekday letter
  header (Monday-start), out-of-month days `--ink-faint`; a day with a session gets a ✓
  under the number (a day with a session containing a PR gets an orange dot instead);
  today gets an orange dot marker per mock.
- "RECENTES": grouped by month (uppercase month header when crossing months). Each
  session row: uppercase weekday+date eyebrow, session/day name (20px/640), muscles
  line, meta line "16 séries · 6.840 kg" (sets · tonnage; no duration), delta line
  "3 melhoraram · 2 estáveis" (from existing session deltas). Expanded state (chevron ˄)
  adds "Ver sessão" orange link (→ existing session detail/edit) and "…" menu with the
  existing per-session actions (edit, delete). The "Every set" table remains at the very
  bottom, restyled, possibly inside a collapsed disclosure.

### 3.4 Program (`#program`) — mock `05-program.png`

Read-first overview; editing moves behind an "Editar" toggle.

- Header: "Programa" + right "Editar" text button → reveals the existing visual editor
  (`#programEditor`, add day, raw-JSON advanced details) in place of the overview.
- Overview: program name (26px/650) + "…" menu; meta line "Hipertrofia · 4 dias por
  semana" (goal label if known from onboarding answers, else omit goal; days = count of
  program days); "Semana 3 de 6" + segmented bar + "Iniciado em 20 jul" (from
  `programMeta.started`).
- Stat row: "2 / 4 sessões esta semana" (adherence), "N prontos para aumentar",
  "83% volume concluído" (`programVolumeCompliance()`).
- "DIAS DE TREINO": accordion per training day — collapsed row: day name + muscles line
  + "N exercícios · M séries" + chevron; expanded: exercise rows (name left,
  "4 × 4–8" right) + "Ver detalhes" orange link → exercise page of first/each exercise
  (link each row to its exercise page).
- "VOLUME SEMANAL PLANEJADO": "64 séries efetivas" + "Ver auditoria ›" link → the
  existing planned-volume audit (`#volume`), which renders below or on the Volume tab.
- "Revisar bloco" orange link + "…" → existing end-block flow (`promptEndBlock()`);
  keep `#endBlock` semantics and the block prompt banner.

### 3.5 Exercise page (`#exercise`) — mock `06-exercise-detail.png`

- Header: "‹ Progresso" back (label reflects the actual origin view: Hoje / Progresso /
  Programa / Histórico), centered "Exercício" title, "…" menu (existing actions:
  substitute, alternates, notes).
- Body: muscle eyebrow, name (28px/650), context line "Treino A · 4 × 4–8 reps ·
  RIR 0–2"; recommendation block + "Entender" orange link (opens the existing glossary
  popover for the recommendation term); stat band: sessões / maior carga / melhor e1RM /
  PRs; "PROGRESSÃO" + "12 semanas ˅" range picker (12 weeks default; existing chart data
  windowed), e1RM line chart with PR ring markers and terminal value badge; "RECORDES"
  rows (Carga "80 kg × 8" + date, e1RM "98 kg" + date) + "Ver todos" link → PRs tab;
  "SESSÕES RECENTES" rows: date, "80 × 8", "RIR 2", trend arrow icon, second line with
  the exercise session note when present.

### 3.6 Settings (`#settings`) — mock `07-settings.png`

Grouped iOS-style list. Groups are white boxes (radius 14, hairline border) of rows, or
flat hairline groups — match mock. Header: "‹ Hoje" back + centered "Ajustes".

Scope rulings (the app is local-only; do not invent features):

- Profile row: avatar circle with initials from... there is no user name — replace the
  mock's "Pedro / Sincronizado agora" with an app-identity row: RepForge mark, app name,
  caption "Dados salvos neste aparelho" (i18n) + storage note (`#storageNote` content).
  No sync claims.
- "TREINO": Timer de descanso (value "2:00", tap → inline stepper or the existing input,
  restyled), Unidades (kg/lb), Registro de RIR (Numérico / Esforço), Entrada por voz
  (toggle — existing `#voiceInputEnabled`). **No "Hápticos"** (doesn't exist).
- "NOTIFICAÇÕES": master toggle + caption; "Configurar lembretes ›" expands the four
  existing type checkboxes as toggle rows; permission status line stays.
- "APP": Idioma (English/Português), Guia do RepForge (existing tour), Sobre (version
  row, static "1.0"). **No "Aparência"** (no theme system).
- "PROGRAMA E PROGRESSÃO": Criar novo programa (→ onboarding), Usar programa iniciante
  (existing button), Controles de progressão ›" with caption "Padrões recomendados
  ativos" → expands the advanced dials (jump %, min jump, RIR ceilings) restyled.
- "DADOS": Backup e exportação (JSON + CSV rows), Importar dados (file rows, keep both
  program-JSON and backup-JSON imports reachable), Armazenamento (computed size of
  `repforge_v1` in KB/MB).
- Destructive: "Apagar todos os dados" red row (existing `#reset` flow + confirm).
- Footer: "RepForge · Feito para treinar, não para distrair." (i18n both languages).
- Install row ("Add to home screen") appears when the install prompt is available.

### 3.7 New program onboarding (`#onboarding`) — mock `08-new-program.png`

Restyle the existing 8-step wizard: top bar "Cancelar" (orange, exits to previous view)
+ centered "Novo programa"; "ETAPA n DE 8" + segmented progress; big question title
(28px/650) + `--ink-soft` explainer; options as radio cards (icon, title, caption,
radio); "O QUE ISSO MUDA" label + one-liner under the options where the step has one;
footer line "Já tenho um programa · Importar" (underlined "Importar" → program JSON
import) on step 1; sticky bottom "Continuar" CTA (last step: existing finish label).
Keep all steps, answers, and `generateProgramFromOnboarding` behavior. Back = "Cancelar"
on step 1, and a back affordance ("‹") on later steps.

### 3.8 Block review — mock `09-block-review.png`

Restyle `#blockReview` as a full-screen sheet: top "Fechar" (orange) + centered "Revisão
do bloco" + "…"; program eyebrow; "Bloco concluído" (30px/650); "6 semanas · 20 jul –
9 ago"; "X de Y sessões concluídas" + thin progress bar + right-aligned percent; stat
band melhoraram / estáveis / travado / % volume (from `buildBlockReview`);
recommendation block + "Ver análise completa" underlined link (→ Review tab);
"PRÓXIMO BLOCO": the five existing strategies as radio cards — the engine-recommended
one preselected with "RECOMENDADO" tag; when the recommendation carries suggested swaps,
show the collapsible "Alterações sugeridas" line inside that card; lock-icon caption
"Seu histórico e seus recordes serão preservados."; sticky CTA "Começar próximo bloco"
(runs selected strategy) + centered "Decidir depois" link (closes, existing behavior).

### 3.9 Everything else

Dialogs (`#importChoice`, `#endBlockConfirm`), glossary popover, tour, toast, install
banner: restyle to the new language (white sheet, hairline, radius 14, black CTA +
text-link secondary). The tour's step content references old UI names ("heat gauge") —
update copy keys where the UI element moved or died (gauge → Today readiness line).

## 4. Engineering constraints

1. **Ids and hooks**: keep every element id referenced by `app.js`/tests (`#workout`,
   `#logForm`, `#date`, `#notes`, `#bodyweight`, `#saveMeta`, `#dayTabs`, `#statsSeg`,
   `#sessions`, `#historyTable`, `#exDetail`, `#programEditor`, `#programJson`,
   `#blockReview`, nav `data-view` buttons, settings inputs, etc.). Grep before renaming
   anything; prefer adding wrappers/classes over renaming ids.
2. **i18n**: every new user-visible string goes through `data-i18n` keys or `t()` calls,
   added to BOTH `i18n-en.json` and `i18n-pt.json`. PT copy should match the mock text
   verbatim where shown. Update changed keys (nav labels, tour copy) in both files.
3. **State**: no schema changes to `repforge_v1` / `repforge_draft_v1`. UI-only state
   (e.g. which view, expanded accordions) may use the existing ui-state mechanisms.
4. **Service worker**: bump `CACHE` version in `sw.js`; keep ASSETS accurate (drop saira
   woff2 entries when the font is no longer used).
5. **Accessibility**: preserve roles/aria attributes and the tab/nav keyboard behavior;
   all text ≥4.5:1 contrast; hit targets ≥44px; `:focus-visible` outlines (2px accent).
6. **Tests must pass** (from `test/`, server on :8000):
   `node schedule.mjs`, `node recover-gate.mjs`, `node notifications.mjs`, and
   `REPFORGE_SIM_WEEKS=12 node simulation.mjs`. The simulation asserts UI selectors;
   where the redesign legitimately changed structure (e.g. topbar gauge removed, nav has
   four buttons), update the simulation's selectors/expectations to the new UI while
   keeping each check's intent. Do not delete checks; port them.
7. **No regressions in reachability**: every feature listed in README →
   command bar + voice, list/focus modes, warmup flag, substitution/alternates,
   skip/trim, per-set commit, session edit/delete, exports/imports, raw JSON editor,
   volume audit, glossary, tour, install, notifications, block lifecycle — must remain
   reachable in the new UI.
8. **Code shape**: this repo is hand-written vanilla JS with template literals; follow
   the existing style (no frameworks, no inline `import`, keep functions small and flat).
   CSS: rewrite `styles.css` coherently under the new tokens — do not append an override
   layer on top of the old theme; dead rules must go.

## 5. Definition of done

- All four logic/UI test files green against the redesigned app.
- Each of the nine mock screens has a visually corresponding implemented screen
  (side-by-side eyeball match: layout order, hierarchy, tone; not pixel-perfect).
- Both languages render correctly (open with `?` default EN and switch to PT).
- Lighthouse-level sanity: no console errors on load, service worker still installs,
  manifest still valid.
