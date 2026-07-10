# High Score

This isolated RepForge prototype treats a workout as a restrained electromechanical pinball game: sets are targets, progression readiness is a lit lamp, PRs are score reels, the rest timer is the ball-in-play clock, and saving a workout runs a brief lamp chase.

The reference is a 1950s–1970s backglass and control panel, not an arcade terminal. Black lacquer, cream sign-painting, cherry red, amber lamps, sparing cyan, and geometric linework provide the atmosphere. Display faces use the existing condensed sign-painter typeface rather than a pixel font. Inset numeric wells and visibly raised controls carry the physical metaphor; there is no terminal copy, generic neon, glass blur, or card-grid decoration.

## Usability constraints

- Existing IDs, selectors, DOM hierarchy, labels, focus behavior, and data flow remain intact.
- The metaphor reinforces state: amber means ready or complete, cyan remains the cool/back-off signal, and red is reserved for primary action and urgency.
- Controls keep their text labels. Physical styling is a signifier, not a replacement for instructions or accessible names.
- Numeric wells are high-contrast and recessed; buttons are raised, have a pressed state, and retain keyboard focus rings.
- The rest timer stays in the persistent top bar and remains stoppable with one tap.
- The completion chase is decorative, lasts under one second, never blocks input, and is skipped when `prefers-reduced-motion: reduce` is active.
- Mobile remains the primary layout. Geometric framing compresses rather than forcing horizontal scrolling.

## References and architectural translation

### Physical affordances and signifiers

Don Norman distinguishes an affordance from the perceptible cue that communicates it, calling the cue a signifier. In a screen interface, styling must make actions discoverable rather than merely imitate material. RepForge therefore reserves raised edges, highlights, and downward travel for actual buttons; editable values alone receive recessed wells.

- Don Norman, [“Signifiers, not affordances”](https://jnd.org/signifiers-not-affordances/)
- Don Norman, [“Affordances and Design”](https://jnd.org/affordances-and-design/)

### Real-time score display

Electromechanical pinball moved from illuminated scoring panels to mechanical reel counters in the 1950s, making changing totals legible at a glance without consuming the whole backglass. RepForge translates that hierarchy into dark, inset number windows for metrics and PR values while leaving descriptive text outside the display.

- Russ Jensen / Internet Pinball Database, [“Pinball Scoring Themes”](https://www.ipdb.org/archive/russjensen/scoring.htm)
- Terra Technica, [“1953: Introduction of reel counters and improved electromechanics”](https://www.terratechnica.info/en/time-travel/pinball/1953)

### Snappy motion as architecture

Motion is state feedback, not ambient spectacle. Nielsen Norman Group recommends roughly 100 ms for simple feedback and 200–300 ms for larger state changes, with the shortest non-jarring duration preferred. The prototype keeps presses near-instant, existing view transitions brief, and the completion chase isolated behind one body state. That class is set only after persistence succeeds, so motion reflects application truth rather than running ahead of it.

- Nielsen Norman Group, [“Executing UX Animations: Duration and Motion Characteristics”](https://www.nngroup.com/articles/animation-duration/)

The architecture remains dependency-free: existing render functions own state, CSS owns presentation, and one `lampChase()` function bridges successful workout persistence to decorative feedback. Reduced-motion handling exists in both JavaScript and CSS so the effect is never initiated for users who request less motion and remains suppressed if styles load independently.
