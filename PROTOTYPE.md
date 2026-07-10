# Metrocycle

Metrocycle treats a workout as one continuous transit journey. Each training day is a colored line, each exercise is a station, each set is a stop, and a saved set is a punched, illuminated stop. History reads as a service map rather than a stack of cards.

## Metaphor

- **Lines:** Day tabs use saturated route colors and a continuous rail, so changing days feels like changing services.
- **Stations:** Exercises sit on one vertical blue route. The station circle communicates sequence without changing the existing exercise order or controls.
- **Stops:** Set numbers remain the fastest way to identify and change set type. Completing a set fills its stop green while preserving the existing check action and rest-timer behavior.
- **Service map:** History sessions share one red route and use interchange-style circles. Tables retain dense, tabular detail as timetable boards.
- **Network control:** Stats, Program, and Settings use flat rules, line colors, and service-board hierarchy instead of dashboard cards.

## Usability decisions

The metaphor supports the workout; it does not rename core actions or hide data behind novelty. Weight, reps, RIR, and Save remain in the same left-to-right order. Exercise names and recommendations lead each station, while secondary setup and history information stays visually quieter.

Progressive disclosure remains unchanged: List/Focus, collapsible exercises, advanced sections, and stats segments still expose detail only when requested. Mobile inputs retain their existing touch targets and the bottom navigation remains fixed. Saturated colors always have a shape or text counterpart, so status does not depend on color alone.

No JavaScript selectors, form controls, IDs, accessibility labels, or application behavior were changed. Metrocycle is a presentation-only prototype apart from wayfinding copy in static section eyebrows.

## Researched inspiration

- [TfL Line Diagram Standard](https://content.tfl.gov.uk/tfl-line-diagram-standard.pdf): continuous route geometry, strict spacing based on line thickness, 45/90-degree construction, and open station/interchange circles.
- [TfL Basic Elements Standard](https://content.tfl.gov.uk/tfl-basic-elements-standards-issue-08.pdf): disciplined typography, mode colors, strong information strips, and consistent visual identity.
- [Tokyo Metro subway map and station numbering](https://www.tokyometro.jp/en/subwaymap/index.html): line-specific colors plus circled letter/number identifiers that make position and direction quickly scannable.
- [Hevy workout set types](https://www.hevyapp.com/features/workout-set-types/) and [Hevy workout logging](https://www.hevyapp.com/hevy-tutorial/): fast set entry, tappable set numbers, previous performance context, and a check action that completes a set and starts rest.

Strong and Hevy establish the useful logging hierarchy: exercise first, then previous performance, then a compact set-entry row, then completion. Metrocycle keeps that hierarchy intact and adds wayfinding continuity around it.

## Visual system

Warm ivory is the map stock; deep navy is the wayfinding ink. Blue is the primary workout route, red signals progression and history service, yellow marks the current line, green marks completed stops, and purple identifies program planning. Plex Sans and Plex Mono provide neutral signage and tabular numerals. Corners are square, shadows are minimal, and surfaces are separated with rules rather than card grids or glass effects.

Palette values are exposed through semantic surface, text, route, state, and chart tokens. The canvas chart reads those computed CSS tokens rather than carrying a separate hard-coded theme. Text-bearing route colors meet WCAG AA against ivory: red 5.85:1, hold yellow 6.07:1, active blue with white 6.50:1, chart labels 6.31:1, and chart values 13.87:1.
