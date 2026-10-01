# Exercise illustration style: movement glyph

## Status and authority

- **Status:** proposed; awaiting owner approval. Nothing here is implemented.
- **Proposed:** 2026-10-01
- **Applies to:** every exercise illustration Taurifer ships: the exercise
  detail field, the preview page (`.exthumb--lg`) and the list thumbnails
  (`.exthumb--sm` at 52 px, `.exthumb--md` at 72 px).
- **Does not change:** the rendering contract in
  [Exercise detail illustration treatment](./exercise-detail-illustration.md)
  (placement, the light-mode bridge, the dark-mode plate, alt text, no
  placeholders), or the closed-set rule in `AGENTS.md` and `PRODUCT.md`. Until
  new art is licensed and lands, movements without media keep the empty tile.

This document is the source of truth for **what an exercise illustration looks
like**: canvas, palette, figure, camera, poses, composition, equipment, the
orange mark, and how a finished image is accepted. It is written so that an
illustrator, an image-generation pipeline and a reviewer reach the same picture
from the same brief.

The style was chosen from a six-direction comparison (editorial diagram,
training-manual linework, bold movement glyph, rotoscoped figure, technical
engraving, duotone poster). The bold movement glyph won on the constraint that
matters most here: the art is shown as a 52 px tile far more often than as a
450 px picture, and only solid shapes survive that.

## 1. What a glyph is

A movement glyph is a pictogram of one exercise: two solid ink figures on warm
paper, the start position then the end position, with the load marked in
orange. It must be identifiable at 52 px and mechanically correct at 450 px.

When two requirements conflict, the higher one wins:

1. **Mechanically correct.** Joint angles, grip, stance, equipment and contact
   points match the movement. A beautiful wrong squat is a failure.
2. **Legible at 52 px.** Movement family, equipment and the difference between
   the two positions read on a phone list row.
3. **Consistent across the library.** Every image uses the same figure, scale,
   camera rules, palette and layout grid, so 271 tiles read as one set.
4. **On brand.** Paper, ink and one orange mark (`DESIGN.md`, the One Mark
   Rule).
5. **Attractive.** Nice-looking, but only after the four above.

## 2. Owner decisions

These gate production. Each has a recommended default, and the rest of the
spec assumes it.

| # | Decision | Recommended default | Why |
|---|---|---|---|
| D1 | Do glyphs replace the 96 shipped black-figure illustrations? | **Yes, all of them.** | Two styles in one picker list look like two apps. The shipped set also varies its camera angle, paper colour (69 of 96 files drift 13+ levels from the reference paper) and orange use from file to file, which this spec exists to fix. |
| D2 | Which figure? | **One canonical lifter**, deliberately low on gender and ethnic markers (no face, no beard, no hair texture). | A featureless silhouette is the most consistent across 271 images and the least likely to put anyone off. Alternating figures doubles the consistency problem. |
| D3 | Where do the reference poses come from? | **A 3D mannequin posed and rendered by Taurifer** at the camera angles in §6. | The EXDB/Gym Visual media is not licensed to Taurifer (`NOTICE.md`), and its camera angles are not ours. Restyling a reference that is already in the right view keeps the generator from re-projecting poses, which is where mechanics break. See §13. |
| D4 | Do list thumbnails crop to one pose? | **Not yet.** Keep the full image, but compose every image so a single-pose crop is possible without regenerating (§8.5). | Showing one large figure would read much better at 52 px, but it changes `exerciseMedia()` and the thumbnail contract, so it is a separate decision. |

## 3. Canvas and export

| Property | Value |
|---|---|
| Master canvas | 1024 × 1024 px, square. All dimensions in this spec are in master pixels. |
| Shipped file | 768 × 768 px WebP, matching the `width="768" height="768"` hints. |
| Encoding | Lossless WebP first. If the lossless file exceeds 40 KB, use lossy at quality ≥ 85. Hard cap 48 KB per file (the shipped set averages 32 KB). |
| Colour space | sRGB, no embedded profile, no alpha. |
| Background | Flat paper (§4), edge to edge. No texture, grain, vignette, border, or frame. |
| File name | `assets/exercises/<library id>.webp`, as today. |

Flat paper is a requirement, not a taste. The detail page builds its light-mode
bridge from the image's paper colour (`mediaBg`). A textured or drifting paper
redraws the hard rectangle that treatment exists to remove. With one paper
value, every `mediaBg` becomes the same value and the per-file sampling turns
into a check rather than a correction.

## 4. Palette

The art uses exactly five colours, plus anti-aliasing between neighbours.
Nothing else is allowed: no gradients, tints, highlights or shadows.

| Role | Hex | Used for | Contrast vs paper |
|---|---|---|---|
| **Paper** | `#EEE5D6` | Background and incisions (§5.4). | — |
| **Ink** | `#1B1A17` | The lifter, entirely. Same value as the app's `--ink`. | 13.9 : 1 |
| **Frame** | `#878075` | All equipment that is not load: bars, handles, benches, machine frames, pads, cables, pulleys, rails, racks. | 3.1 : 1 (4.5 : 1 vs ink) |
| **Load** | `#E04E14` | The face of the load: plates, dumbbell heads, kettlebells, the selected stack block, a belt plate. Same value as `--accent`. | 3.2 : 1 |
| **Load edge** | `#B8410E` | The rim or side face of a load (plate thickness, dumbbell head side), and the gaps between stack plates. Same value as `--accent-deep`. | 4.4 : 1 |

Notes:

- **Paper** is the shipped set's median paper (`#ECE0CF`) lifted slightly
  toward the page paper (`#F4F2EF`, 1.12 : 1 apart). The light-mode bridge
  still has a step to cover, but a small one. In dark mode the image stays a
  cream plate, unchanged, as `docs/brand-guide.md` requires.
- **Ink, Frame, Load** form a three-step value ladder: the body reads first,
  the load second, the equipment last. That ordering is what makes a machine
  exercise legible at 52 px. In the shipped set, the black machine frame swallows
  the black lifter.
- **Load and Frame have almost the same luminance (1.02 : 1)**, so they differ
  only by hue. Never let identity depend on that difference: a load is always
  recognisable by its shape (disc, bell, stack block) and always carries a
  Load-edge rim.
- **Quantisation is mandatory.** Every output is snapped to this palette before
  export (§13, step 4), whatever produced it. The only off-palette pixels
  allowed are anti-aliasing between two palette colours that touch (§12.1 sets
  the threshold).

## 5. The lifter

### 5.1 Build and proportion

- **Stature H.** Everything in the library is drawn to one scale (§8.3). H is
  the lifter's standing height.
- **Head height:** H / 7.5.
- **Shoulder width** (front view): 2 head heights. **Hip width:** 1.5 head
  heights.
- **Build:** a trained recreational lifter, not a bodybuilder. The silhouette
  shows a deltoid cap, a calf, a glute line, a tapered waist. No internal
  anatomy: no abs, pecs, veins or muscle separation.
- **Real-world proportion:** the lifter represents a 1.75 m adult. Equipment is
  sized against that (§9.1).

### 5.2 Head and face

- Smooth ovoid head with short hair folded into the silhouette. No hairline,
  curls, ears or beard.
- Profile view (§6) shows a gentle brow, nose and chin step so the facing
  direction reads. Front and back views show a plain oval.
- No eyes, mouth or expression in any view.
- Neck is always visible. The head is never hidden by equipment (§6.2 explains
  the camera rotation that guarantees this for barbell movements).

### 5.3 Hands, feet and clothing

- **Gripping hand:** a closed mitten wrapped around the implement, thumb shown
  as a small notch. At 450 px, the wrist and knuckle orientation must make
  pronated, supinated and neutral grips distinguishable (a single knuckle
  incision across the back of the fingers is allowed for this).
- **Pressing hand** (on a pad or the floor): a flat open shape, no separate
  fingers.
- **Feet:** low trainers, flat soles. The toe shows which way the lifter faces.
- **Clothing:** fitted short-sleeve top and shorts ending one hand-width above
  the knee. Clothing is the same Ink as the body and appears only as a small
  step in the silhouette at sleeve and hem. No seams, logos or folds.

### 5.4 Incisions

An incision is a line of Paper cut through Ink. It is the only internal detail
the lifter has.

- **Where:** only where one part of the body overlaps another, so the overlap
  stays readable (an arm across the torso, the near leg over the far leg, a
  forearm over the upper arm in a curl). The incision outlines the nearer part.
- **Width:** 8 px, uniform, round caps. In a 52 px tile that is 0.4 CSS px
  (about 1 device pixel on a 3× phone), so incisions blur into the ink at
  thumbnail size and separate limbs at detail size. That is intended.
- **Count:** at most 8 per figure. If a pose needs more, the camera or pose is
  wrong for that exercise.
- **Never** for muscle definition, clothing seams, facial features or
  decoration.

Equipment never needs an incision against the body, because it is a different
colour. Where an equipment part passes in front of the lifter, draw it over the
Ink without an outline.

## 6. Camera

### 6.1 Projection

- **Orthographic.** No perspective convergence and no lens distortion. Parallel
  lines stay parallel, and the two poses are directly comparable.
- **Camera axis horizontal** for standing, seated, kneeling and hanging
  lifters. For a lying lifter, the camera axis follows the view definitions
  below, which are defined relative to the body rather than to the room.
- **No roll.** The floor, when implied, is horizontal.

### 6.2 The three views

Views are named by the plane of the body that faces the camera, measured from
the trunk in the start pose.

| View | Code | Camera position | Used when the working joint moves in… |
|---|---|---|---|
| **Profile** | `P` | At the lifter's left side, rotated **20° toward their front** (body yaw 70° from camera). | the sagittal plane: squats, hinges, rows, presses, curls, extensions, calf raises, crunches. |
| **Front** | `F` | Facing the lifter's front. For a supine lifter, this is directly above. | the frontal plane, seen best from the front: lateral raises, flyes, adduction/abduction, shrugs, side bends, twists. |
| **Back** | `B` | Facing the lifter's back. | the frontal plane, seen best from behind: wide-grip vertical pulls, reverse flyes. |

Profile is rotated 20° rather than shown as a true side view for one reason:
in a true profile, the near barbell plate sits exactly over the lifter's
shoulder and covers the head and neck (a 45 cm plate on a 23 cm head). At 20°
the plates separate from the body, the head stays clear, and sagittal joint
angles shrink by only cos 20° ≈ 6 %, which is too little to misread.

### 6.3 Facing and orientation

- **Standing, seated, kneeling or hanging start:** in `P`, the lifter faces
  **right**. Reading left to right, start to end, the lifter moves into the
  page.
- **Lying start** (supine, prone, side-lying, or trunk supported horizontally
  on a bench or pad): **head to the left** in every view.
- **Mirroring** the whole image to satisfy these rules is always allowed. Which
  arm or leg works in a one-sided movement does not change the exercise. It is
  not the "misleading mirror" that the experiment rubric treats as a hard
  failure.
- In `F` and `B`, a one-sided movement works the lifter's **right** limb
  (screen left in `F`, screen right in `B`), so the library is consistent.

### 6.4 View by movement pattern

Defaults keyed to the library's `patterns` vocabulary. An exercise may override
its view in its brief (§13) when the default hides the working joint; the
override and its reason are recorded there.

| Pattern | View | Typical layout | Notes and expected overrides |
|---|---|---|---|
| `squat` | P | A | Lunges and split squats may need the A scale step-down (§8.4). |
| `hinge` | P | A | Glute bridge and hip thrust are lying starts (head left) and usually B. |
| `row` | P | A | Seated cable and machine rows are usually B. |
| `press` | P | B | Bench and push-up variants are horizontal (B). Dips are A. |
| `incline_press` | P | B | Bench angle drawn true: 30° unless the movement specifies otherwise. |
| `shoulder_press` | F | A | Barbell overhead press overrides to P (bar path past the face). |
| `pulldown` | B | A | Wide-grip pulldown and pull-up. Close/neutral grip and chin-up override to P. |
| `pull` | P | A | Pullovers and straight-arm pulldowns are shoulder extension in profile. |
| `lateral_raise` | F | A | |
| `rear_delt` | B | A | Face pull stays B. Supine reverse fly is F from above. |
| `delts` | P | A | Front raise P. Upright row overrides to F. |
| `chest_iso` | F | A | Standing cable flyes and pec deck from the front. Lying dumbbell flyes are F from above, head left. |
| `curl`, `arms` | P | A | Hammer and reverse curls rely on the §5.3 grip rule. |
| `triceps` | P | A | |
| `forearms` | P | A | |
| `traps` | F | A | Shoulder elevation reads only from the front. The barbell shrug's bar is too wide for A and lands in B. |
| `calves` | P | A | |
| `leg_curl` | P | A or B | Lying leg curl is B, head left. |
| `leg_extension` | P | A | |
| `adduction`, `abduction` | F | A | |
| `abs` | P | A or B | Twists, side bends and oblique raises override to F. |

## 7. Poses

### 7.1 Which two positions

- **Start (left or top):** the position the first repetition begins from.
- **End (right or bottom):** the opposite extreme of the range of motion, where
  the repetition turns around.

| Exercise | Start | End |
|---|---|---|
| Back squat | Standing, bar on upper back | Bottom: hip crease below the top of the knee |
| Deadlift | Bar on the floor at the shins | Standing lockout |
| Bench press | Arms locked out over the shoulders | Bar touching the lower chest |
| Pull-up | Dead hang, arms straight | Chin over the bar |
| Lateral raise | Arms at the sides | Arms at shoulder height |
| Curl | Arms extended | Forearm vertical, fully flexed |
| Cable fly | Arms open, slight elbow bend | Hands meeting in front of the chest |

### 7.2 Form standard

Draw the textbook version a coach would demonstrate, at the range of motion the
library entry names:

- full range unless the exercise is itself a partial (rack pull, for example);
- neutral spine, unless the exercise is defined by flexion (crunch) or
  extension (hyperextension);
- feet flat in squats and hinges; knees track over the toes;
- barbell over mid-foot in squats, hinges and overhead presses;
- the bar path, cable line or handle path consistent between the two poses, so
  the image implies one path.

Reviewers check joint angles against the pose reference with a tolerance of
±10°, and contact points (hands, feet, back, seat) exactly.

### 7.3 Between the poses

Nothing. No arrows, motion trails, ghosted intermediate figures, numbers or
labels. Reading order (left→right or top→bottom) carries the sequence. The
experiment comparison showed arrows cost legibility and add a generation
failure mode for no information the order does not already give.

## 8. Composition

### 8.1 Grid

```text
 0      80                         512                        944   1024
 ┌──────┬───────────────────────────┬───────────────────────────┬──────┐  0
 │      │        LIVE AREA  864 × 864 (margins 80 on all sides) │      │
 │   ┌──┼───────────────────────────────────────────────────────┼──┐   │  80   overhead limit
 │   │  │   cell 1 (start)          │   cell 2 (end)            │  │   │
 │   │  │   centre x = 284          │   centre x = 740          │  │   │
 │   │  │                           │                           │  │   │
 │   │  │   ┌───────┐               │   ┌───────┐               │  │   │  240  standing head top (H = 640)
 │   │  │   │ pose  │               │   │ pose  │               │  │   │
 │   │  │   │ group │  ≥ 48 clear   │   │ group │               │  │   │
 │   │  │   └───────┘               │   └───────┘               │  │   │
 │   │  ┼─────────────── shared baseline y = 880 ───────────────┼  │   │  880
 │   └──┼───────────────────────────────────────────────────────┼──┘   │  944
 └──────┴───────────────────────────────────────────────────────┴──────┘ 1024
                         LAYOUT A — side by side

 ┌──────┬───────────────────────────────────────────────────────┬──────┐  0
 │      │   row 1 (start)   x-centre 512                        │      │  80
 │      │   ┌────────────── pose group ──────────────┐          │      │
 │      ┼────────────────── baseline y = 480 ───────────────────┼      │  480
 │      │                     32 gap                            │      │
 │      │   row 2 (end)                                         │      │  528
 │      │   ┌────────────── pose group ──────────────┐          │      │
 │      ┼────────────────── baseline y = 912 ───────────────────┼      │  912
 └──────┴───────────────────────────────────────────────────────┴──────┘ 1024
                         LAYOUT B — stacked
```

A **pose group** is one figure with all the equipment it touches. Each pose
group sits entirely inside its own cell or row.

### 8.2 Layout A: side by side

The default, for poses taller than they are wide.

- Two cells, centred on x = 284 and x = 740. With 48 px between groups, the
  widest pose group that fits is 408 px.
- **Shared baseline at y = 880** for every floor-supported group, in every
  Layout A image in the library. The feet, bench legs and machine bases stand
  on it. Because the baseline never moves, thumbnails line up down a list.
- **Hanging groups** (pull-ups, hanging raises) hang from the bar instead: the
  bar's top edge is at y = 96 in both cells.
- At least 48 px of clear paper between the two groups at their closest point.

### 8.3 Scale

| Layout | Stature H | Share of canvas |
|---|---|---|
| A | **640 px** | 62.5 % |
| A, stepped down | 608, 576 or 544 px, the largest that fits | 59–53 % |
| B | **400 px** | 39 % |

Within a layout, the scale is fixed library-wide, so a dumbbell is the same
size in every Layout A image at the same step. 640 is the largest stature at
which a bodyweight overhead reach (about 1.25 H) still clears the top of the
live area from the y = 880 baseline. Anything that puts plates overhead, or
spreads a barbell across the profile view, steps down.

### 8.4 Choosing the layout

Run this for each exercise, using the pose groups at Layout A scale:

1. Try Layout A at H = 640. A group fits when it is at most 408 px wide and
   stays between y = 80 and the baseline (or the hanging-bar line). If both
   groups fit, use it.
2. Otherwise step H down through 608, 576 and 544 and retest.
3. If neither fits at 544, use Layout B at H = 400.

Expected outcomes: free-standing dumbbell, cable and bodyweight movements stay
at 640. Barbell lifts in profile land around 576–608, because the 20° view
spreads the two plates about 430 px apart at full scale. Overhead barbell
presses step down for plate clearance. Lying, seated-row, long-stride and
front-view barbell movements (a 2.2 m bar is 805 px wide at H = 640) go to
Layout B. Record the result in the brief (§13) so it is decided once, not per
render.

### 8.5 Single-pose crop readiness

Every image must allow a square crop around either pose group without that
crop clipping the figure or its load, and without the other group intruding.
This keeps decision D4 open at no regeneration cost. Keeping each group inside
its own cell (with the 48 px gap) satisfies it in Layout A; in Layout B the
crop is the row's full width, letterboxed.

## 9. Equipment

### 9.1 Scale

Draw equipment to real size against the 1.75 m lifter:

| Item | Real size | At H = 640 |
|---|---|---|
| Olympic plate (largest) | 45 cm diameter | 165 px |
| Barbell shaft | 2.2 m long, 28 mm thick | 805 px long, drawn 12 px thick |
| Dumbbell head | 18 cm diameter | 66 px |
| Flat bench pad top | 43 cm from the floor | 157 px |
| Kettlebell (body) | 22 cm diameter | 80 px |

Shafts and handles have a **minimum drawn thickness of 12 px**, cables
**6 px**. In a 52 px tile on a 3× phone those are about 1.8 and 0.9 device
pixels: still present as a line, which is all a thumbnail needs.

### 9.2 Draw what the body touches

Show only what the lifter touches, what moves, and the load. Leave out the
rest of the machine.

- **Barbell:** shaft in Frame, plates in Load with a Load-edge rim. In `P`
  both plates show, offset by the 20° rotation. In `F`/`B` the plates are seen
  edge-on as tall narrow rounded rectangles: a Load face and a Load-edge
  side. Collars are not drawn. A rack or bench is drawn only if the exercise
  uses it.
- **Dumbbell:** handle in Frame, heads in Load with a Load-edge rim, hexagonal
  heads not allowed (round only, so all dumbbells match).
- **Cable station:** one upright column in Frame, a pulley wheel at the cable's
  exit point, the cable as a straight 6 px Frame line from pulley to handle, the
  handle or attachment in Frame, and **one stack block in Load** at the column's
  base. Twin-column stations (crossover) draw two narrow columns at the edges of
  the pose group with a short stack block each. Cable lines are straight and
  aligned with the force; they never sag.
- **Selectorised machine:** a simplified rectilinear frame in Frame, the pads
  the body touches in Frame, the moving arm in Frame, and the stack block in
  Load. Upholstery seams, adjustment pins, labels and handles the exercise does
  not use are left out.
- **Plate-loaded machine:** as above, with the load as plates on the horns
  instead of a stack.
- **Smith machine:** two vertical rails in Frame, cropped just above the
  highest bar position and at the baseline; bar and plates as a barbell.
- **Bench:** a single slab and two legs in Frame; the incline angle drawn true.
- **Pull-up bar:** a single horizontal Frame bar with two short uprights,
  cropped.
- **Bodyweight:** only the support the body uses (floor implied by the
  baseline, a bar, a bench, parallel bars).

### 9.3 Stacks and orange area

A weight stack is the load, but a whole stack is a large orange field. Draw the
stack as a block **no taller than 1.5 head heights**, plates separated by 4 px
Load-edge gaps, so it reads as "stack" without dominating.

## 10. The orange mark

Orange marks the load, the thing a lifter adds weight to. That is what
Taurifer tracks and what changes over time, so it follows the One Mark Rule
(orange marks what is live or what changed).

- **Orange is on:** plates, dumbbell heads, kettlebells, the stack block, plates
  on a plate-loaded machine, the plate on a dipping belt or weight vest.
- **Assisted machines:** the stack is orange; it is what the lifter adjusts.
- **Bodyweight movements have no orange.** That is correct, not an omission:
  there is no added load to mark.
- **Orange is never on:** the lifter, clothing, pads, seats, frames, cables,
  handles, bars, the floor, or any arrow or decoration.
- **Orange area:** at most 10 % of the canvas, measured after quantisation. A
  barbell profile lift with four visible plates is about 7–8 %; the cap stops
  stacks and plate-loaded machines from turning into orange fields.

## 11. Never

- Text, numbers, labels, logos, brand names, watermarks or signatures.
- Faces, hair texture, beards, skin tones, muscle definition.
- Arrows, motion trails, ghosted poses, speed lines.
- Shadows, cast shadows, floor lines, reflections, glow.
- Gradients, textures or grain anywhere, including the paper.
- A third figure, a spotter, a coach, or background objects.
- Perspective views, dramatic angles, or crops that cut through the lifter or
  the load.
- Any colour outside §4.

## 12. Acceptance

### 12.1 Automatic checks (every file)

| Check | Pass condition |
|---|---|
| Decode and size | Decodes; 768 × 768; ≤ 48 KB. |
| Paper | The 16 px border ring is `#EEE5D6` ± 2 on every channel. `tools/sample-media-bg.mjs` returns that value. |
| Palette | ≥ 95 % of pixels within ΔE2000 4 of a §4 colour, measured on the shipped file. |
| Ink coverage | Ink is 4–30 % of the canvas (Layout B lying figures sit near the bottom of that range). |
| Orange area | Load + Load edge ≤ 10 %; exactly 0 % for bodyweight entries with no added load. |
| Margins | No non-paper pixel inside the 60 px (shipped scale) border. |
| Baseline | For Layout A floor groups, the lowest Ink or Frame pixel in each cell sits at y = 660 ± 6 at shipped scale (880 at master). |
| Group separation | In Layout A, a vertical paper channel ≥ 36 px wide (shipped scale) separates the two groups. |
| Text | OCR finds no text. |

### 12.2 Thumbnail test

Render each image at 52 × 52 and 156 × 156 (a 3× phone) next to five other
glyphs from different patterns. A reviewer who has not seen the brief must name
(a) the movement family, (b) the equipment family, and (c) what changes
between the two figures. Any miss is a fail. Use a different reviewer for each
batch of 24.

### 12.3 Mechanics review (detail size)

At 768 px, beside the pose reference:

- joint angles within ±10° at the working joints, hips, knees and spine;
- contact points identical: hands on the implement, feet, back on the bench,
  hips on the seat;
- grip type correct (pronated, supinated, neutral, mixed);
- equipment type and count correct; the cable or bar path consistent between
  poses;
- start and end in the right order, both present.

### 12.4 Hard failures

Any of these rejects the image regardless of other scores. The first six match
the experiment pack's mechanics hard-fail flags.

- wrong exercise or pose;
- a meaningful joint or grip change;
- a missing, extra, or reordered pose;
- wrong or missing equipment;
- equipment that does not touch the body where it should;
- a mirror that changes the movement's meaning (whole-image mirroring under
  §6.3 is allowed);
- the head hidden by equipment;
- any item from §11;
- orange anywhere §10 forbids it.

## 13. Production pipeline

1. **Brief.** One row per library entry, written before any image work:
   `id`, `view` (§6.4, with override reason), `layout` and `H` (§8.4), start
   pose and end pose in one sentence each, implement and grip, and the load
   item to colour. The brief is reviewed once by someone who knows the lift,
   not per render.
2. **Pose reference.** A neutral 3D mannequin built to the §5.1 proportions,
   posed for each endpoint and rendered orthographically at the brief's view,
   with simplified equipment at true scale. This settles the mechanics and the
   camera before any styling. Because the reference is our own render, it also
   settles the rights question (decision D3).
3. **Restyle.** Convert the reference into the glyph style with the chosen
   generator, using the golden set (§14) as style references. The reference's
   geometry and camera are authoritative; restyling never re-poses or
   re-projects.
4. **Snap and clean.** Quantise to the §4 palette, flatten the paper to its
   exact value, remove stray marks, enforce margins. Optionally vectorise and
   re-rasterise: five flat colours trace cleanly, and the result is crisp at
   any size.
5. **Check.** Run §12.1 automatically, then §12.2 and §12.3 by review.
6. **Export.** §3 encoding, named by library id.

### 13.1 Relationship to the style-transfer experiment pack

`taurifer-style-transfer-experiment-pack-v4-codex-judge.zip` was written for
the black-figure style and for EXDB sources. If this spec is approved, the pack
needs these changes before another run:

- the P2 style paragraph and the rubric's `style_match` definition describe the
  glyph (§4, §5, §10, §11) instead of Greek black-figure pottery;
- content images are §13 step 2 pose references, so "preserve the camera
  viewpoint" stays true and the generator is never asked to change the view;
- the gold pairs are rebuilt from the §14 golden set; the four current
  `generated_*.webp` targets are black-figure and would teach the wrong style;
- the corpus target is the library (271 entries), not all 1,324 EXDB
  exercises.

## 14. Golden set

Six images, drawn or approved by hand, that become the style references for
everything else. Together they cover every view, both layouts, every equipment
family and the no-orange case.

| Library id | Exercise | View | Layout | Covers |
|---|---|---|---|---|
| `sq_bb` | Barbell back squat | P | A | Profile rotation, plates clearing the head, baseline |
| `pr_bb` | Barbell bench press | P | B | Lying start (head left), bench, stacked layout |
| `lr_db` | Dumbbell lateral raise | F | A | Front view, dumbbells, fine arm angle |
| `ci_cb` | Cable fly | F | A | Twin columns, cable lines, stack blocks |
| `pup_bw` | Pull-up | B | A | Back view, hanging alignment, no orange |
| `le_mc` | Leg extension | P | A | Selectorised machine, Frame vs Ink separation |

Approve the six against this spec, run the §12.2 thumbnail test on them as a
group, and only then generate the rest.

## 15. When the art lands

These follow from the spec but are separate changes, each with its own review:

- `MEDIA_IDS` in `tools/build-exercises.mjs` grows to the delivered set, and
  `exercises.js` is regenerated.
- `tools/exercise-media-bg.json` is regenerated; every value should be
  `#eee5d6`.
- The closed-set wording in `AGENTS.md`, `PRODUCT.md` and `NOTICE.md` is
  updated to name the new licence and count.
- The `sw.js` cache revision is bumped and the screen catalog recaptured.
- [Exercise detail illustration treatment](./exercise-detail-illustration.md)
  is re-measured: its gradient stops were tuned to the shipped art's empty
  bands, which the §8 grid changes (80 px margins, a fixed baseline).
