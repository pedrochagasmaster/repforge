# Vendored baseline modules

Copied verbatim from PR #256 `ui-overhaul/058-system-convergence` at
`f61ce44b05b1b6717abb4ef00b2395204e9c9636`. They exist so the tournament
harness runs the real compiler, entry state machine and setup-link codec
without touching production files. Never edit them here; re-copy when the
baseline moves.

| File | Global | Purpose in the harness |
| --- | --- | --- |
| `exercises.js` | `RepForgeExercises.library` | The 271-movement library (EN/PT names, equipment, muscles, media ids) |
| `program-compiler.js` | `RepForgeProgramCompiler` | Deterministic program compiler, families, blueprints, time rules |
| `program-entry.js` | `RepForgeProgramEntry` | Entry state, `ROUTE_STEPS`, validation, resume, activation readiness |
| `program-entry-adapter.js` | `RepForgeProgramEntryAdapter` | Production services: compile, split choices, browse catalogue, build |
| `shared-setup.js` | `RepForgeSharedSetup` | Setup-link decode / validate |
| `fonts/plexsans.woff2`, `fonts/plexmono-{400,500,600}.woff2` | — | Self-hosted Plex, as in production |
| `brand/mark.png` | — | The ground-free mark used on the landing |
| `brand/today-ready-{pt,en}-{light,dark}.webp` | — | The owner-selected landing proof (baseline `assets/brand/`, shown by `TS.landingProof` with `landing.shot.today_ready.alt`; H-8) |

Exercise illustrations are referenced from the repository's own
`assets/exercises/` directory and are not copied.
