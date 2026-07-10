# RepForge Ascent

## Concept

Ascent turns progressive overload into a route through topographic terrain. Each exercise is a numbered checkpoint on one continuous trail. Readiness becomes grade: cobalt marks a conservative foothill, orange marks a steep opportunity to add load, and the route profile shows how the athlete is gaining elevation over time.

The visual system uses weatherproof map colors—bone paper, spruce ink, safety orange, and cobalt—plus contour lines, trail blazes, elevation-style numerals, dashed survey rules, and compact field-map labels. Decorative safety orange stays vivid, while a darker semantic orange provides WCAG AA text and CTA contrast. It deliberately avoids editorial layouts, generic fitness neon, card grids, blur, and glass surfaces.

## Reference principles

### Humanist mobile data visualization

Data stays tied to the athlete's next goal. Large values represent useful progress signals, readiness sits beside the exercise it affects, and the Stats view reads as a trail profile rather than an abstract dashboard.

### Topographic and trail wayfinding

Exercises share a continuous route and use checkpoint numbering for sequence. Blazes, contour intervals, map keys, summit markers, and elevation colors communicate position and direction without changing the app's underlying workout model.

### Progressive disclosure

The active route exposes the information needed to log now. Dense analysis remains behind the existing “Open full trail profile” disclosure, while focus mode, advanced settings, and editing flows keep their established behavior.

## Scope and constraints

- Static, offline-first PWA with no new dependencies.
- Existing JavaScript selectors, interactions, form semantics, labels, and mobile behavior are retained.
- The prototype changes visual presentation and map-oriented copy only; saved data remains compatible with `repforge_v1`.
- Service-worker cache is bumped to `repforge-ascent-v15`.
