# RepForge Persona Product Feedback Report

Date: 2026-07-01

## Overview

This report captures brutally honest product feedback from seven high-signal user personas. Each persona imagines having used RepForge seriously for months or years, then writing a candid email to the developer about what could be improved, what feels broken or naive, where the app lacks vision, taste, or touch with reality, and what should be built next.

The feedback is grounded in the current RepForge implementation (`app.js`, `index.html`, feature specs, and the hypertrophy mechanics review).

---

## 1. The serious hypertrophy power user

**Subject:** I want to love RepForge. I can't finish a workout in it.

Hey —

I've been running RepForge seriously for a few months alongside Strong and Hevy (and I still keep FitNotes on a backup phone and a Google Sheet for mesocycles I don't trust apps with). I'm the person you're building for: 4–5 days/week, double progression, RIR on every working set, I care about load history and whether I'm actually progressing, not gamification. I'm writing because RepForge has ideas I haven't seen done this cleanly anywhere else, and also because I keep almost switching to it and then rage-quitting mid-session. You clearly know training. The product doesn't yet know what it's like to log a workout with chalk on your hands and 90 seconds on the clock.

### What RepForge gets right

Local-only PWA with offline service worker is the correct bet for this category. I don't want my squat numbers on your server. JSON backup/import plus CSV export means I can actually own my data — Strong's export has always felt like a hostage negotiation. The default 3-day machine split is a real program, not a toy template, and the visual program editor *and* raw JSON is exactly the right power-user split: I can sketch in the UI and then hand-edit the weird stuff (superset pairings, exercise swaps) without fighting a wizard.

The logging model — load, reps, RIR per set, draft autosave, copy-last, kg step buttons tied to `minJump` — is conceptually right. Double progression recommendations with the heat metaphor (add/add2/hold/reduce/new) and RIR awareness are smarter than Strong's "did you beat last time?" badge and more honest than Hevy's PR confetti. Matching lifts by `exerciseId` *and* name via `matchLift` shows you've thought about program edits not nuking history. Previous session inline is gold; that's the thing I actually look at between sets. Fatigue watch (2+ stalled/reduce on a 3+ exercise day) is the first built-in feature in any app I've used that acknowledges bad days without moralizing. Stats that matter to me: Epley e1RM, top load chart, attention board, completed hard sets and 7/28d rolling volume — that's a hypertrophy person's dashboard, not a Strava cosplay. Session edit/delete in History with the full set table is non-negotiable and you have it.

### Where RepForge falls short

No rest timer. I cannot say this loudly enough. Strong and Hevy both know that between-set timing is half of session execution. I am not scrolling a full-day form looking for a save button while my rest window dies. You autosave drafts but you don't save *me* from losing track of time — that's backwards priority for a logging app.

Kg only, no lbs toggle. Fine for you, not fine for the US gym where half the plates are in pounds and I'm doing mental math at 6am. FitNotes at least lets me pick units.

Save workout only persists sets with load > 0, and there's one Save at the bottom after I've scrolled through the entire day. On a 3-day split that's a long vertical form. I finish legs, I've got chalk on my phone, I hit Save, and I discover I forgot to put load on set 3 of leg curl because I was copying last session and got interrupted — now I'm hunting through the scroll graveyard. Strong saves per exercise or per session with clear completion states. Hevy is tap-happy but at least I know what's committed.

Logging speed is not competitive. Copy-last helps; kg step buttons help; draft autosave helps. None of it is as fast as Strong's plate calculator flow or FitNotes' "repeat last, change one field" muscle memory. Every extra scroll is a tax I pay every set.

No cloud isn't a feature when I switch phones. JSON import works once if I'm disciplined. In practice I'm not exporting before every device change. Strong sync is why people stay.

Recommendations use `matchLift` by id/name but logs carry `exerciseId` — I've had rename/edit moments where the recommendation felt like it was talking about a different lift than the history row. Trust in the coach layer is fragile.

### Where the product lacks touch with reality

You built a program editor and a stats lab for someone who lives in spreadsheets, but the in-session loop assumes I'm calmly filling a form at a desk. Real sessions: gym Wi-Fi drops (your SW handles offline — good), someone asks for a machine, I swap exercises, I do a backoff set not in the template, I log warmups differently than work sets, I need to note "left shoulder weird." RepForge's model is "here is today's entire prescription, scroll and comply." That's how a program *looks* on paper, not how it unfolds under fatigue.

Fatigue watch is smart but it's watching *stalls on programmed lifts*, not "you've been in the gym 95 minutes and your RIR entries are drifting." I've had days where every lift gets a "hold" and the app is technically correct while I'm clearly overcooked. The product sees progression math; it doesn't see session quality.

Machine-only default split is honest, but most serious lifters aren't machine-only forever. The editor can fix it — yet the app's soul reads as "here's my Planet Fitness circuit" unless I JSON-surgery it. That's a positioning smell for the persona you attract with e1RM and hard-set volume.

Settings like `jumpPct`, `minJump`, `rirHigh`, `hardRir` are the right knobs — buried in Settings, not surfaced when I'm deciding whether to take the "+2 kg" recommendation on a lift where the jump is wrong for microplates. The app knows my increment rules; it doesn't apply them at the moment of decision.

### Where the product lacks taste, polish, or vision

The heat metaphor for recommendations is clever once and then it's UI noise. "Add2" vs "add" vs "hold" — I get it, I'm serious. The metaphor doesn't make me faster or more confident; Strong's simple green/red does, insulting as that is. Taste is knowing when not to brand your math.

It's a PWA that feels like a PWA: functional, slightly inert, no sense of session momentum. Hevy is bloated but there's a rhythm — finish set, timer, next. RepForge feels like a data entry job with a nice stats page waiting at home.

Vision gap: you have progression logic, attention board, rolling hard sets — the ingredients of a *training system* — but the product presents as a logger with opinions. I can't tell if RepForge wants to be FitNotes-plus (dumb pipe, fast hands) or a coach (smart defaults, interrupt me when I'm wrong). Right now it's neither decisively; it's a smart backend wearing a slow form.

Polish: inline previous session is great; everything else in the log view is density without hierarchy. What do I tap *right now*? What's done? What's next? I shouldn't have to read the whole day to know.

### What I would build next

1. Rest timer per set or per exercise — default on, background notification, optional auto-start on set complete. This is not optional for serious use.
2. Session mode: one exercise at a time, big tap targets, "complete set" commits to draft immediately, visible progress through today's work. Save becomes "finish workout" at the end, not a treasure hunt.
3. Surface recommendations at the set row when I open an exercise, with `minJump`/`jumpPct` applied to the suggestion so "+2.5" isn't fantasy on a dumbbell row.
4. Lbs/kg toggle or at least display conversion — international isn't just Europe.
5. Warmup vs working set distinction (or "don't count toward volume/hard sets") — my 7/28d numbers are lying when I log ramp sets the same as work sets.
6. Faster "same as last time, +1 rep" one-tap on the active set. Copy-last exists; make it the default gesture.

### What I would absolutely not build

Social feed, leaderboards, AI chat coach, exercise GIF libraries, subscription paywall for "advanced progression," or cloud accounts as the default story. Don't Hevy-ify this. Don't add a marketplace of programs. Don't gamify streaks — I train 4–5x/week; I don't need a flame icon to shame me for deload week. And please don't add fifteen onboarding screens explaining RIR to beginners; that's a different product and it will slow down the people who already know.

### One sharp product thesis

RepForge should be the fastest honest log for people who already know how to train — local-first, progression-aware, no theater — and it should win or lose on the sixty seconds between sets, not on the stats tab I open once a week.

Right now you're building the spreadsheet I admire and the logger I abandon. Fix the session loop and I'll uninstall Strong on my main phone. Until then you're my Sunday planning tool and my weekday excuse to open Hevy again.

---

## 2. The beginner intimidated by lifting

**Subject:** I want to trust you, but I don't know what half of this means

Hi — I'm writing this because I actually *want* RepForge to work for me. I downloaded it after my first few gym sessions because I kept forgetting what weight I used and I liked the idea of something telling me when to add weight. I'm not a lifter yet. I'm someone trying to become one, and right now RepForge feels like it was built for someone who already speaks the language.

### What RepForge gets right

The logging flow is fast. Day tabs, kg/reps/RIR columns, Save workout — I can get in and out without fumbling. That's huge when I'm already nervous standing in front of a machine.

The recommendations are the reason I kept using it. When a card says "Add load" with a target kg, or "Hold · recover," I feel like *something* is watching my numbers even if I don't fully understand the logic. The heat bar on each exercise and the "forge" gauge in the header give me a gut feeling: red/hot = maybe I'm ready to go up. I don't need to be an expert to notice that.

I also appreciate that it's local-only. I'm not ready to sync my embarrassing beginner numbers to the cloud. And the default 3-day split at least *looks* like a real program — someone clearly thought about quads, hamstrings, chest, back. I didn't have to invent a routine from scratch.

### Where RepForge falls short

Nobody taught me RIR. The app asks me to log it on every set, shows "RIR 0–2" on every card, and has settings called "Target RIR ceiling" and "Hard-set RIR ceiling" — but never once explains what RIR is, how to estimate it, or what happens if I guess wrong. I'm basically making up a number and hoping the app forgives me.

Same with rep ranges. "2×4–8 reps" — do I stop at 8? Am I failing if I only get 5? When it says "Push reps" because I "left reps in reserve," I don't know if that means I was too easy or if I'm doing fine and should just add one more rep next time.

The recommendation copy assumes I already understand double progression. "You topped the range with reps to spare. Jump up boldly." — topped *what* range? Why boldly vs. regular "Add load"? What's the difference between "Add load" and "Add load ++" besides the plus signs? I see "Target 47.5 kg" and I trust the math, but I don't trust *my understanding* of why that's the right call.

The default exercises are a wall of jargon. Day 1 opens with "Hack squat or pendulum squat." My gym has a leg press and maybe a hack squat machine with no label. "Incline converging chest press" — is that the machine where the handles come together? "45 degree leg press, quad-biased" — how do I bias quads on a leg press? "Smith machine RDL or machine hip hinge" — I don't know what an RDL is, and I've never seen a hip hinge machine. I'm standing in the gym with my phone, reading exercise names like a menu in a language I don't speak.

Settings is a trap for beginners. "Load jump %," "Minimum jump (kg)," "Target RIR ceiling," "Hard-set RIR ceiling" — four dials with zero tooltips, zero defaults explained, zero "leave these alone if you're new." I changed something once, got different recommendations, and panicked that I'd broken the app.

### Where the product lacks touch with reality

RepForge assumes I have a commercial gym full of specific machines and that I can map your exercise names to what's on the floor. Most beginners don't have that. We have "the chest machine," "the thing for legs," and whatever the last person left loaded. There's no "I don't have this machine — show me an alternative." No photos. No "look for a plate-loaded press with a chest pad." No fallback to dumbbells or cables.

It also assumes I'm honest and calibrated about RIR. On week two, I cannot reliably tell the difference between 1 RIR and 3 RIR. I'm still learning what failure feels like. The whole recommendation engine is built on a number I'm faking, and the app never acknowledges that beginners fake it.

The Program tab is built for someone who already knows anatomy and programming. "Muscles are comma-separated; secondary muscles count as a half set in the volume audit." I read that sentence three times and closed the tab. I don't know what a volume audit is, why half sets matter, or whether "Mid/upper back" is one muscle or two. The weekly volume bars are pretty, but without context they're anxiety, not guidance.

There's no onboarding moment that says: "Here's what to do on your first day. Pick a weight that feels challenging but not scary. Log it. Come back next week." Instead I land on Day 1 with six exercises and a "New lift" chip that tells me to "pick a load you can hold for 4–8 reps at 0–2 RIR" — which is exactly the vocabulary I'm here to learn.

### Where the product lacks taste, polish, or vision

The forge/heat metaphor is cool for people who get it. For me it's vibes without a legend. What does "forge" mean when nothing is hot? What does 82% heat on a bar mean vs. 100%? The meta description says "Heat means you are ready to add load" — that's one line buried in HTML, not something the app teaches me while I use it.

The voice is inconsistent. Some copy is plain ("Every set hit the top of the range. Add weight.") and some is gym-bro poetry ("Jump up boldly," "bank some recovery," "Stalled · deload"). "Hold · recover" with a middle dot feels designed for people who already know periodization. I'm not there.

Branding says REP*FORGE* like I'm smithing iron. I'm a person who still checks if the pin is secure on the weight stack. The product vision seems to be "precision hypertrophy instrument" but the user you actually have on day one is "scared human trying not to look stupid." Those two visions haven't met.

Stats has "Completed hard sets," "e1RM," "Top loads by exercise," fatigue watch banners about deloads — it's a dashboard for someone mid-journey. I'm pre-journey. I need confidence, not a ledger called "The ledger."

### What I would build next

1. A real first-week path — not a tutorial essay, but 3–4 screens: what RIR means in plain English with a "could I do 1–2 more reps?" framing; what rep ranges mean; what to do when you see "Add load" vs. "Hold."
2. Exercise cards with human fallbacks — "Hack squat or pendulum squat" becomes "Leg machine: squat angle (hack squat, pendulum, or similar). Ask staff if unsure." Even one line of gym-floor guidance per exercise.
3. Glossary on tap — tap RIR, rep range, volume audit, deload, anything jargon-y; get a two-sentence answer without leaving the log screen.
4. Beginner-safe settings — hide the four progression dials behind "Advanced" and ship sensible defaults with a note: "You don't need to touch these for months."
5. "I don't know my RIR" mode — let me log Easy / Hard / Max effort instead, and map that internally until I learn the real scale.
6. Simpler default program option — same split structure but names like "Leg press," "Chest press machine," "Lat pulldown." Save the biomechanics nerd names for people who opt in.

### What I would absolutely not build

- A social feed, leaderboards, or sharing PRs — I'm not trying to compete; I'm trying to show up.
- A 20-minute onboarding video course — I'll bounce.
- AI chat that lectures me about hypertrophy — I don't need a coach in my pocket; I need the app to stop assuming I already have one.
- More stats, more charts, more volume math — I'm drowning in numbers I don't understand. Don't add complexity upstream of comprehension.
- Replacing the recommendations with generic motivational quotes — the recommendations are the best thing you have. Make them understandable, don't dumb them into irrelevance.

### One sharp product thesis

RepForge is already making decisions for me — I just can't participate in them yet. The product should treat "beginner" not as a skill level to grow out of, but as a literacy gap to close in the first 60 seconds of every screen: tell me what to do, tell me why in one breath, and let me log the set before the shame sets in. Confidence is the feature. The forge can wait until I know what I'm forging.

---

## 3. The time-constrained parent

**Subject:** I love that you built this — but it assumes I have 90 minutes and a functioning brain

Hi, I'm writing this at 5:47 a.m. because it's the only quiet window I get before the kids wake up. I'm not mad at you — I'm tired, and I train anyway. I wanted a tool that respects that reality. RepForge is close in spirit, but in practice it still talks to the version of me who has a full gym block, a clear head, and a week that went according to plan. That guy doesn't exist anymore.

### What RepForge gets right

Draft autosave is the feature that actually saved me. Kid meltdown mid-set, phone buzzes from work, someone needs a snack — I can close the app and come back without losing the log. That matters more than any chart.

The fact that I can save a partial workout (only sets with load > 0) is also real. I didn't finish the whole day, but I didn't throw the session away. That's the right instinct: imperfect data beats no data.

And honestly, the progressive-overload focus is why I'm here. I don't need another generic workout timer or a social feed. I want to know if I'm moving forward. You clearly care about that too.

### Where RepForge falls short

The core flow — one form for the whole training day, save at the bottom after everything — assumes I will complete the programmed day in order, with full attention, in one sitting. I won't. Not consistently. Not with two young kids and a job that doesn't care that it's leg day.

There's no short workout mode. No skip exercise. No substitution flow. So when I'm 35 minutes in and the babysitter window is closing, I'm stuck scrolling past exercises I'm not doing, mentally negotiating guilt while trying to log what I actually did.

Day tabs assume a rigid split. Miss Monday because someone was sick? Tuesday still shows Tuesday's work like the week is a clean spreadsheet. There's no missed-session handling, no "I'll do Monday's push on Wednesday," no schedule flexibility. Life isn't a 4-day split. It's a pile of competing urgencies.

Fatigue watch suggesting a lighter session is almost cruel without a one-tap deload or exercise trim. You're telling me I'm cooked, then handing me the full menu anyway. That's not coaching — that's a warning label on the same workload.

No readiness check-in. No "minimum effective workout" guidance. So on the days I'm running on four hours of sleep, I'm guessing whether benching is brave or stupid, and whether two compounds and done is enough or I'm sandbagging.

### Where the product lacks touch with reality

You built for the athlete's *intent*, not the parent's *constraints*.

I don't fail because I don't care. I fail because the window closed, someone threw up, or I misjudged how fried I am. RepForge treats every programmed exercise as mandatory UI surface area even when I'm only doing half the day. The form still shows the whole cathedral while I'm trying to log a chapel service.

Partial save helps the data layer but not the experience layer. I'm still looking at a long form full of exercises I'm not touching, which feels like failure before I tap Save.

And there's no vocabulary for "good enough." Serious lifters who are also parents don't need permission to quit — we need permission to *adapt* without breaking the log, the plan, or our sense that we're still training seriously.

### Where the product lacks taste, polish, or vision

The product knows how to count reps. It doesn't yet know how to read the room.

Suggesting lighter work without offering a lighter *path* feels like product design that stopped at the insight and didn't finish the job. Taste is follow-through: one tap that says "do the essentials" and reshapes the session.

Vision-wise, RepForge still imagines training as execution of a plan. The vision I'd buy is training as *negotiation* with a plan — same long-term goals, different daily contracts.

Polish isn't gradients and animations. It's reducing cognitive load at 6 a.m. when I haven't had coffee. A long scrollable day form with every exercise visible is administrative labor. I need decisions made for me on bad days and flexibility handed to me on chaotic ones.

### What I would build next

1. "Minimum effective workout" mode — After a 10-second readiness check (sleep, stress, time available), surface 2–3 priority lifts for today with targets scaled to readiness. One tap to accept; log and leave.
2. Skip / substitute with memory — Skip an exercise with a reason; substitute with something from a small curated list; remember substitutions so I'm not re-deciding every cramped session.
3. Flexible schedule, not rigid day tabs — Missed sessions roll forward or can be explicitly deferred. The week is a queue of work, not a calendar of shame.
4. One-tap deload from fatigue watch — If you're going to tell me I'm under-recovered, offer "trim 30%" or "essentials only" and rewrite today's prescription in place.
5. Short workout builder — "I have 25 minutes." App picks the highest-leverage movements from today's template and hides the rest from the active log (not just at save time).

### What I would absolutely not build

- Social features, leaderboards, or streak shame. I don't need another thing judging me.
- A bloated exercise encyclopedia with GIFs I'll never open mid-session.
- AI chat that "motivates" me. I don't have time for a pep talk; I need a decision.
- Complicated periodization dashboards that require Sunday afternoon planning. If it needs a spreadsheet mindset, it won't survive Tuesday at 5:45 a.m.
- Gamification that punishes missed days. My life already gamifies scarcity; I don't need the app piling on.

### One sharp product thesis

RepForge should optimize for the smallest serious workout a tired parent can complete and still trust the log — not for the fullest workout an ideal week would allow. Build for the interrupted session, the swapped exercise, the 28-minute window, and the morning after bad sleep — and the people who still show up anyway will stay.

---

## 4. The coach / personal trainer

**Subject:** I love what you built for lifters — and I can't use it to coach anyone

Hi, I'm a personal trainer with about 25 active clients. I found RepForge through a client who asked if they should switch off my spreadsheet + WhatsApp check-ins. I spent a week using it myself, walking one willing client through a JSON export/import handoff, and pretending I had a "coach workflow." I'm writing because the product is genuinely good at something I'm not your customer for — and I think you should decide whether that's a feature or a ceiling before you build more.

### What RepForge gets right

The logging flow is excellent. kg, reps, RIR, previous session on screen, double-progression nudges, the heat gauge — that's the stuff my serious clients actually need mid-session, not another "motivational quote of the day." The program editor is more capable than most apps my clients pay $15/month for. Volume audit separating *planned* weekly sets from *completed* hard sets is the kind of thinking that tells me you understand training, not just UI.

The local-only model is a real selling point from my side of the desk. Clients are rightly paranoid about who sees their numbers. No account, no cloud, no "we updated our privacy policy" email — I'd actually recommend this to a privacy-conscious lifter who trains alone and doesn't need me in the loop.

For a solo athlete who owns one phone and one program, RepForge is one of the sharpest tools I've seen in this space. Full stop.

### Where RepForge falls short

There is no coach. Not "coach features are light" — there is no second person in the system at all. One `localStorage` blob, one device, one human. My entire job is the second human.

What I need that doesn't exist:

- **Templates I can assign** — I have a push/pull/legs template, a machine-biased beginner block, a deload week. Today I'd have to screenshot my program editor or email JSON and pray they import it correctly. That's not coaching; that's IT support.
- **Adherence I can see without begging** — Did they train Monday? Did they skip legs again? Did they log sets or just open the app? Right now I get a CSV or JSON when they remember to send it. That's a report, not a pulse.
- **Comments on sessions** — Session notes exist, but they're a monologue. I need to say "drop the load 5% on hack squat, knee looked off in your video" and have it show up *on their next log screen for that exercise*. WhatsApp works because it's conversational. RepForge is a diary.
- **Substitutions** — Client's gym doesn't have the exact machine from your default 3-day split. They hack something in the program editor or just log wrong exercise names. I can't prescribe "if no chest press, use dumbbell press, same rep range" in a way that survives into their stats.
- **Client progress at a glance** — I need 25 rows: last session date, streak, top lifts trending, volume vs plan, flags. You have beautiful charts for *one* person on *one* phone. I have a Google Sheet with conditional formatting that took me an hour to build and breaks every month.

JSON export/import is a manual file handoff. I tried it with one client. They exported, sent me a file via WhatsApp, I edited their program in a text editor, sent it back, they imported and overwrote their whole state. It worked once. Nobody will do that weekly. CSV export is fine for my own analysis but it's post-mortem data, not a live coaching relationship.

### Where the product lacks touch with reality

You built for the lifter in the gym with headphones on. I build for the lifter who texts me "gym was packed, what do I do?" at 6:47pm on a Tuesday.

Real coaching is asynchronous, multi-client, and messy. People switch phones, forget to log, train at different gyms, miss weeks, come back injured, and need a human to notice before the spreadsheet does. RepForge assumes one consistent athlete, one consistent program, one consistent device, and honest logging. That's a power user fantasy. My reality is 40% adherence on a good month and three different cable machines that aren't labeled the same way.

The program editor *could* be copied — I see the vision — but without client management it's a personal notebook, not a coaching platform. I'm not asking you to become Trainerize. I'm saying the gap between "great solo logger" and "tool a coach could adopt" isn't a few features; it's a whole relationship model you haven't designed for.

Also: default machine-only 3-day split is fine for your demo persona. Half my clients are barbell, half are hotel gyms. The product reads like it was forged for one person's gym, which is charming until I realize I'd rebuild every client's program from scratch on day one.

### Where the product lacks taste, polish, or vision

The copy is trying too hard to be a brand. "The blueprint," "The ledger," "The dials," "forge" on the heat gauge — I get it, you're RepForge. My clients don't want lore; they want "what do I do today." The eyebrow headings are cute once and then they start feeling like a newsletter from a supplement company.

Raw JSON behind an "Advanced" accordion is the right escape hatch for nerds. For everyone else — including me when I'm on my phone between clients — it's a liability dressed up as power-user cred. A coach product needs guardrails, not a textarea that replaces the whole program.

There's no sense of *why* I'd open this app on Sunday night. Stats are rich for the lifter reflecting on their own progress. There's no "week ahead" view, no "coach left you a note," no gentle accountability. The vision stops at self-improvement. That's a choice, but it means the product doesn't imagine anyone else caring whether you showed up.

Privacy-first local-only is appealing until you realize it also means privacy-first *from your coach*. You've optimized for data never leaving the device. I've optimized for data reaching the person who can interpret it. Those are opposite defaults.

### What I would build next

If you want coaches without becoming a bloated SaaS monster:

1. Read-only coach link or periodic sync — Client opts in, coach sees adherence + last sessions + flags. Doesn't have to be real-time cloud; even "share last 7 days as a signed link" would change my life.
2. Program templates as first-class objects — Export/import a *program only*, not the whole backup. Let me publish "Pedro's PPL v2" without touching their log history.
3. Exercise substitutions tied to slots — Primary + approved alternates. Stats roll up correctly.
4. Coach comments pinned to exercise or session — Shows on the client's next relevant log screen.
5. Adherence dashboard that's dead simple — Trained / partial / missed this week. I don't need AI summaries; I need red and green.

Do that and I'd pilot it with five clients tomorrow and cancel one SaaS subscription.

### What I would absolutely not build

- A social feed, leaderboards, or "community" — My clients don't need to compare hack squat numbers with strangers.
- AI-generated workout plans — They need *my* plan, adjusted with *my* judgment. Auto-programming is how you lose trust with serious coaches.
- Mandatory accounts and cloud-first storage — You'd lose the one thing that made me pay attention. Don't torch your differentiation chasing CoachRx.
- In-app messaging — I have WhatsApp. Don't rebuild it badly.
- Billing, scheduling, nutrition, habit tracking — Feature creep that turns a sharp logger into a mediocre everything-app. Stay dangerous at one thing.

### One sharp product thesis

RepForge is a superb private training log for the athlete who doesn't want a coach in their software — which is exactly why it will stay in my recommendation pile for solo lifters, and out of my workflow for everyone I actually train, until you decide whether "local-only" means "local to the lifter" or "local to the coaching relationship." Right now it's the first. That's honorable. Just don't market around the edges of coaching if you're not willing to let another human into the room.

---

## 5. The privacy maximalist

**Subject:** RepForge respects my threat model — then asks me to be my own SRE with a JSON file

Hi, I installed RepForge because I'm tired of fitness apps that treat my training log like ad-targeting fuel. I wanted something that works offline, never phones home, and doesn't need an account. I've been using it for a few weeks. This is the honest version.

### What RepForge gets right

The core philosophy is correct and increasingly rare: **all state in `localStorage` (`repforge_v1`, `repforge_draft_v1`), no backend, no accounts, no analytics-shaped holes in the architecture.** The service worker caches app assets only — not my log — which is exactly how a privacy-first PWA should behave. Data leaves the device only when I explicitly export it.

The Settings copy is refreshingly blunt: *"Everything lives in this browser under `repforge_v1`. Export a backup before clearing site data or switching phones — there is no cloud copy."* That's not marketing; it's a liability disclaimer, and I respect it. JSON export/import exists. CSV export exists for portability without re-import semantics. PWA install works. For someone who wants **local-only, offline, no-accounts**, RepForge is aligned with my values in a way Strong/Hevy/JEFIT simply aren't.

### Where RepForge falls short

You've chosen the most fragile durable storage browser vendors offer and called it a feature.

`localStorage` is synchronous (main-thread jank as the log grows), quota-capped and eviction-prone under storage pressure, wiped by "clear site data," OS browser cleanups, privacy tools, and Safari's enthusiastic storage management, and not encrypted at rest — anyone with filesystem access to an unlocked phone gets plaintext JSON.

There is **no automatic backup**, **no scheduled export reminder**, **no "last backup" timestamp**, **no integrity check**, **no merge on import** (import replaces everything — one wrong tap and my careful incremental history is gone). The draft key (`repforge_draft_v1`) is a nice touch for in-session resilience, but it doesn't protect against the catastrophic failures that actually matter: new phone, browser reset, accidental delete, corrupted storage.

You warn me to export before disaster. **Warnings are not durability.** They're how you transfer operational risk to the user while keeping the architecture simple.

### Where the product lacks touch with reality

RepForge assumes I am a disciplined backup engineer. I am not. I am a human who upgrades phones every 2–3 years, lets Safari "optimize storage," and forgets Settings exists until something breaks.

Real migration path today:

1. Remember RepForge exists on old phone.
2. Navigate to Settings.
3. Export JSON.
4. AirDrop/email/USB/file-manager the file without losing it in Downloads purgatory.
5. Install PWA on new phone.
6. Import JSON.
7. Hope I didn't import an old backup over newer data because there's no merge and no diff.

Step 0 fails constantly. People lose years of training data not because they chose cloud sync — because **local-only without backup automation is a trap for anyone who isn't paranoid enough to maintain a personal backup ritual.**

Also: no accounts is great for privacy and **terrible for device migration discipline.** You've built a product for people who already behave correctly. The rest of us are one "Clear Website Data" away from grief.

### Where the product lacks taste, polish, or vision

The backup story feels like an afterthought bolted onto an otherwise thoughtful app. Export and Import are steel buttons in Settings next to CSV — fine functionally, zero narrative. No "your data is N sessions / last saved X days ago." No gentle nudge after 30 days without export. No export-on-save option. No Web Share Target for importing a backup file. No checksum in the JSON so I know the file isn't truncated.

Import is silent about what it's destroying. A toast — *"Backup imported."* — after **full state replacement** is insufficient consent UX for something this destructive.

The privacy posture is strong; the **data stewardship posture is amateur.** You've optimized for "nothing leaves the device" but not for "nothing should ever be lost on the device." Those are different problems. Right now RepForge solves the first and shrugs at the second.

### What I would build next

1. **Local-first durability without cloud:** move from `localStorage` to **IndexedDB** (larger quota, async, better fit for growing logs). Still no server. Still no accounts.
2. **Optional client-side encryption** with a passphrase-derived key (Web Crypto). Ciphertext at rest; export produces an encrypted blob. I unlock on new device with my passphrase. Privacy preserved; migration becomes intentional instead of accidental.
3. **Backup hygiene, still local:** "Last export: never / 47 days ago." Optional weekly reminder (local notification via PWA if feasible, or in-app banner). One-tap export with Web Share API so the file actually lands in Files/iCloud/Drive **without** me thinking about filenames.
4. **Import safety:** preview diff (session count, date range) before replace. Optional merge-by-session-id instead of nuclear overwrite.
5. **Integrity:** version field, schema version, simple hash in export metadata so I know the backup is complete.

All of this keeps the thesis: **my data, my device, my exports — no vendor custody.**

### What I would absolutely not build

- Accounts, sync servers, "RepForge Cloud," or any backend that holds training logs — even E2E encrypted. The moment you operate infrastructure, you become a data custodian, a breach surface, and a business that will eventually rationalize telemetry.
- Third-party analytics, crash reporters that phone home, Firebase, Mixpanel, "anonymous usage stats." I can read the source; keep it that way.
- Social features, leaderboards, coach portals, share-to-Instagram workout cards. Wrong product.
- "Sign in with Apple so we can sync." That's just cloud sync with extra steps and a prettier privacy nutrition label.
- Automatic upload to iCloud/Google Drive via opaque SDKs I can't audit. If backup leaves the device, **I** must initiate it.

### One sharp product thesis

RepForge should be the app that proves you don't need a server to take data ownership seriously — but local-only is not the same as local-safe, and until you close the durability gap, you're selling sovereignty with a single point of failure called `localStorage`. I want to love this app. The philosophy is mine. The implementation still asks me to be more careful than I am — which means, eventually, it will fail me.

---

## 6. The spreadsheet maximalist

**Subject:** I logged 847 sessions in Excel. RepForge is fast — and that's not enough.

Pedro, I'm not writing this because I hate the app. I'm writing it because I almost switched, then spent a weekend rebuilding what you gave me in Google Sheets anyway. That's the honest outcome. You asked for spreadsheet-person feedback; here it is, unfiltered.

### What RepForge gets right

**Speed on the gym floor.** Tap load, reps, RIR, save. No spinners, no account wall, no "syncing…" anxiety. For a 90-minute session with 18 working sets, this is genuinely better than my phone spreadsheet. Copy-last-set is the kind of small thing that shows you've actually lifted.

**Local-first is not a gimmick.** My training log is embarrassingly personal. JSON backup to my own drive, no cloud dependency — I respect that. The PWA loads offline. I don't have to trust your servers because there aren't any.

**Opinionated defaults that work.** Double progression with RIR-aware recommendations, the heat metaphor, hard-set volume with secondary muscles at 0.5 — these are real programming choices, not checkbox features. Someone thought about hypertrophy mechanics. The included 3-day machine split is coherent.

**The program editor exists.** Visual reorder, JSON textarea for bulk edits, volume audit by muscle — you're not pretending customization is a v2 feature. That's more than most logging apps offer on day one.

### Where RepForge falls short

**My spreadsheet is a database. Yours is a diary.**

I have columns for: estimated 1RM (Epley, Brzycki, and my own rolling 3-session average), session tonnage, hard-set flags, mesocycle block ID, week-in-block, bodyweight, exercise variant, equipment notes, and whether a set counted toward a PR. RepForge computes e1RM internally (`load × (1 + reps/30)`) but only surfaces it in aggregate stats — not per set, not in export, not sortable. I can't ask "what was my best e1RM on incline press in block 3?" because the question has no home.

**No PR history.** You show "best e1RM" and a top-load chart. I want a PR ledger: date, load, reps, RIR, delta from previous PR, flag for estimated vs. absolute. I've been chasing numbers for years. A line chart of top load per session is a thumbnail of the story, not the story.

**CSV export is raw inputs, full stop.** `session,date,day,name,set,load,reps,rir,notes,created` — fine as an interchange format, useless as an analysis artifact. No e1RM column. No volume column. No muscle tags. No hard-set boolean. I export, open in Sheets, and immediately re-derive everything your app already calculated. That's not portability; that's homework.

**Progression logic is trapped in `app.js`.** Your double-progression rules, stall detection, RIR thresholds — I can't inspect them without reading source. I can't fork the logic. I can't write `=IF(rir<=2, load+2.5, load)` next to my data and know it matches what the app told me. Transparency means the rules travel with the data.

**Program JSON strips IDs in the editor display.** I see the array without `id` fields. I edit a name, save, and hope history still resolves via `migrateLog()` name-matching. It usually does. "Usually" is not a data model. Rename "Chest-supported machine row" to "Hammer high row" and you've introduced a discontinuity my spreadsheet would never allow — because I'd have a stable `exercise_key` column that never changes.

**No mesocycles.** Training isn't one infinite timeline. I run 6-week accumulation blocks, deload weeks, exercise rotations. RepForge has sessions on a flat calendar. I can't tag "week 4 of hypertrophy block" or compare volume within a block vs. across blocks. The volume audit is a rolling 7-day window — useful, but it's a speedometer with no odometer.

**No bodyweight field.** Load on the bar is half the progressive-overload picture for anyone who cares about relative strength or cut/bulk phases. This is a one-column addition that signals you understand long-term tracking.

**No exercise variants.** "Hack squat or pendulum squat" is one program slot. In reality I ran pendulum weeks 1–4 and hack weeks 5–8. My spreadsheet has `variant` and `equipment` columns. Your app has one name string that pretends they're the same lift.

### Where the product lacks touch with reality

You built for the lifter who starts today, not the lifter who has three years of history. Import JSON works if I began in RepForge. I didn't. I have CSVs from Strong, custom Sheets, and a Notion export. There's no migration path that preserves my computed columns, my block structure, or my PR annotations. "Export CSV" implies I might analyze elsewhere; "Import CSV" doesn't exist. The asymmetry tells me export is a checkbox, not a workflow.

Exercise identity is fragile and you don't warn me. `exerciseId` backfills on load via name matching. Rename in the program editor and history follows — until it doesn't, because matching is `name` + `day` fallback. I've seen apps silently fork exercise histories. The toast says "Exercise removed. Logged history will stay." Stay where? Under what key? In my spreadsheet, delete a row from the program tab and the log tab still has `exercise_id = 47`. Immutable.

Hard-set counting is opinionated but not configurable in ways I need. `hardRir` ceiling plus 0.5 credit for secondary muscles — I can live with that. What I can't live with is not seeing the derivation. Which sets counted? Why did adductors show 4.5 effective sets? In Sheets I'd filter `rir <= hard_rir` and audit row by row. Here I get a bar chart and trust.

Notes exist per set but vanish from analytics. I write "left shoulder pinch, dropped ROM" on set 2. It's in the CSV. It's nowhere in stats, history summaries, or export logic. For injury tracking and exercise selection over mesocycles, notes are data. You treat them as graffiti.

### Where the product lacks taste, polish, or vision

Stats mixes incompatible metrics without labeling the mismatch. Top load per session, session-level e1RM (best set), tonnage volume — these answer different questions and get presented as one dashboard. My spreadsheet has separate tabs: `strength`, `volume`, `audit`. Yours blends them and calls it Stats. It feels designed for a screenshot, not for someone who will stare at it for twenty minutes trying to decide whether to add load.

The chart is top-load only. No e1RM trend. No volume trend. No rep-range overlay. One line, one metric, exercise picker. For a product named RepForge, the rep is oddly secondary in visualization.

"Heat" is charming until you need to explain your decision to yourself in January. I don't remember why the app said "stalled · deload" in November. There's no decision log. No "on this date, rule X fired because Y." Spreadsheets are ugly but auditable. RepForge is pretty but amnesiac.

Program JSON advanced mode is power-user cosplay. IDs stripped, no schema, no validation beyond parse-or-toast, no diff against previous program. Real power users want stable identifiers, versioned program snapshots, and the ability to say "my log from March references program v3." You gave us a textarea and a prayer.

No vision for longitudinal identity. The app knows exercises, sessions, and settings. It doesn't know *training phases*, *goals*, or *the lifter*. Bodyweight, mesocycles, PRs — these aren't feature requests. They're the difference between a logbook and a training system. Right now RepForge is a very good logbook that dreams of being software.

### What I would build next

1. Stable exercise IDs everywhere — visible in JSON editor, preserved on rename, never stripped. `exercise_id` in CSV export. History keyed to ID, name is display only.
2. Rich CSV export (or "analysis export") — append computed columns: `e1rm`, `tonnage`, `primary`, `secondary`, `is_hard_set`, `exercise_id`. Let me pivot in Sheets without reverse-engineering your formulas.
3. Exportable rules document — a Settings page or JSON field that serializes progression logic: jump %, min jump, RIR thresholds, stall window. "This is what the app would recommend given these inputs." Auditable. Forkable.
4. Mesocycle blocks — tag sessions with `block_id`, `week`, `phase` (accumulation/deload/realization). Filter stats and volume audit by block. This is the single feature that would keep me opening the app instead of my spreadsheet for review sessions.
5. PR ledger per exercise — auto-detect PRs (load PR, rep PR, e1RM PR), show history with dates, optional manual override. I want to feel the PR without calculating it myself.
6. Bodyweight on session — one field, session-level, flows to export. Enables relative strength later without blocking the simple case.
7. Per-set e1RM in History — read-only computed column. I shouldn't need Stats aggregation to see that my third set was the best stimulative set of the day.

### What I would absolutely not build

- Social features, leaderboards, or "community workouts." I don't want anyone else's data near mine.
- AI coaching chat that hallucinates my RIR. I have rules. I want them enforced, not narrated.
- A hundred exercise animations or a built-in rest timer empire. Scope creep that doesn't touch the spreadsheet gap.
- Cloud sync as the default path before local export/import is bulletproof. Fix portability first; then maybe sync.
- Replacing the JSON editor with a no-code wizard that hides structure. I need more schema, not less.
- Multiple e1RM formulas in the UI before you nail one exportable column. Don't give me Brzycki vs. Epley vs. Lombardi toggles — give me the number in the CSV with the formula documented.

### One sharp product thesis

RepForge will only kill my spreadsheet when the data and the logic leave the app together — stable IDs, computed columns in export, block structure, and rules I can read without opening DevTools. Mobile speed got me in the door. Control, transparency, and portability are what keep me from walking back out.

---

## 7. The minimalist lifter

**Subject:** RepForge is still a logbook — please don't turn it into a dashboard

### Opening note to the developer

I train four days a week, same machines, same split. I don't want a fitness product — I want a tool that gets out of my way between sets. I used RepForge for a few weeks the way I'd actually use it: open, log, save, leave. This isn't a feature wishlist from someone who collects apps. It's a warning from someone who'd uninstall the moment this stops feeling like a forge and starts feeling like a cockpit.

### What RepForge gets right

The core loop is real. I open **Log**, see last session, get a recommendation (Add load / Hold / Back off), punch in kg/reps/RIR, hit **Save workout**, done. No account, no feed, no coach voice in my ear. Local-only is not a limitation for me — it's the whole point.

The heat metaphor works when it stays small: the ember strip on each lift, the gauge in the header. "Ready to add load" is a sentence I can remember. Double progression with RIR is the right abstraction — not e1RM worship, not percentage charts.

Five tabs is the right ceiling. **Program** for setup, **Log** for daily use, **History** as a ledger, **Stats** when I'm curious, **Settings** once. No social. No bloat. The industrial aesthetic isn't cosplay — monospace charts and forge copy actually match how I think about training: blunt, repeatable, no fluff.

### Where RepForge falls short

**Stats** is becoming a second app. Attention board, metrics grid, exercise trend chart, completed hard sets with 7/28-day windows, recent performance table, top loads table — I scrolled past four screens of analysis to answer a question I didn't ask on a Tuesday morning. The **Log** tab respects my time. **Stats** doesn't yet.

**Program** duplicates anxiety. Planned weekly volume audit *and* Stats → Completed hard sets is the same anxiety twice, once aspirational and once retrospective. I don't need both visible by default.

Settings exposes too much surface for a "set and forget" user: load jump %, minimum jump, target RIR ceiling, hard-set RIR ceiling — four dials that sound like they need a spreadsheet to tune. I changed none of them. The defaults should be the product; the dials should be buried.

There's no graceful "I'm done configuring" state. Every tab still looks like it wants something from me. A minimalist app should feel finished after week two. RepForge still feels like it's asking me to explore.

### Where the product lacks touch with reality

I don't stand in the gym wondering about "completed hard sets per muscle within my RIR ceiling over a rolling 28-day window." I wonder: *Did I add weight on incline press or not?* The fatigue banner and attention board are smart heuristics dressed up like a coaching product. Useful, maybe — but they're the first crack in "log and leave." In the gym I'm counting plates, not reading chips that say "back off."

Renaming an exercise breaks history continuity (keyed by name, not id). That's a power-user footgun hiding in a product that claims to be simple. If I edit my program on Sunday, I shouldn't silently orphan Monday's data.

No sync is fine. No *migration path* when I get a new phone is not fine. Export JSON is a developer feature wearing a "backup" label. My mom couldn't restore that file. Minimalist doesn't mean "you figure out data portability."

The default 3-day machine split is a starting point, but nothing tells me when I've outgrown it or how to simplify. The app assumes I'm a programming nerd, not a person who just wants to log what I already do.

### Where the product lacks taste, polish, or vision

The soul is **Log**. The investment is drifting toward **Stats** and **Program**. That's backwards. Every new widget — heat gauge in the header, fatigue watch, attention board, volume windows — is another voice competing with the one thing that works: type numbers, save, leave.

"Advanced · edit raw JSON" under Program is honest, but it's also a confession that the visual editor isn't trusted for real edits. Either commit to the visual editor or admit this is a hacker's side project. Right now it's both, which reads as indecision.

Copy is sharp in places ("Workout forged") and lab-manual in others ("Sets per muscle from this program template, assuming each day is trained once per week"). The lede paragraphs are where minimalism dies — explanatory text stacked on explanatory text.

The aesthetic is cohesive but cold. Fine for a forge. Less fine when I'm tired at 6am and every subhead reads like a technical spec: "Completed hard sets," "The ledger," "The blueprint." Atmosphere is doing work the UI should do silently.

### What I would build next

1. **Collapse Stats to one screen** — today's actionable signals only: what to add, what to hold, what to back off. Chart and volume tables behind a single "Dig deeper" affordance. Default view should fit one thumb-scroll.
2. **First-run → done** — import or accept default program, log one session, never see onboarding again. Settings dials behind "Use defaults" with one tap to expand.
3. **Exercise identity that survives renames** — stable ids, display names editable. Non-negotiable for long-term trust.
4. **Dead-simple phone transfer** — QR export/import or share sheet. One action, not a JSON file hunt.
5. **Protect Log at all costs** — anything new ships hidden, off by default, or on a tab I never open during training.

### What I would absolutely not build

- Social, leaderboards, "community," or sharing workouts
- AI coaching, chat, or "personalized programs"
- Wearable sync, HRV, sleep scores, readiness dashboards
- Exercise video libraries, form cues, substitution engines
- Notifications ("Time to train!" — I'd delete the app)
- More chart types, more windows, more audit modes
- Accounts, cloud sync, subscriptions — the moment this needs a login, it's not RepForge anymore
- Gamification: streaks, badges, XP, "forge level"
- A sixth tab

If any of these show up, you've built a different product and slapped the forge logo on it.

### One sharp product thesis

RepForge should be the last app I open in the gym and the first one I close — not because it's missing features, but because it already told me what I needed to know in under ten seconds. Everything else is vanity that will kill the soul you actually have: a local, honest, heat-stamped logbook for people who train instead of browse. Guard that. Hide the rest.

---

# Synthesis

## 1. The biggest recurring product problems

| Problem | Who raised it | Severity |
|---|---|---|
| **The in-gym session loop is too slow** — full-day scroll form, one Save at bottom, no rest timer, no per-exercise focus | Power user, parent, minimalist | Critical |
| **No adaptation primitives** — skip, substitute, short workout, flexible schedule, one-tap deload | Parent, power user, coach | Critical |
| **Recommendations lack legibility** — RIR jargon, heat metaphor without legend, settings unexplained | Beginner, coach | High |
| **Data durability gap** — `localStorage` fragility, manual backup ritual, nuclear import, no migration UX | Privacy maximalist, minimalist, spreadsheet | High |
| **Data portability is half-built** — CSV lacks computed columns, logic trapped in code, no mesocycles/blocks | Spreadsheet maximalist, coach | High |
| **Stats/Program complexity creeping past Log** — duplicate volume views, attention board, four settings dials | Minimalist, spreadsheet | Medium |
| **Exercise identity still fragile** — rename/orphan risk despite `exerciseId` migration | Power user, spreadsheet, minimalist | Medium |
| **Machine-jargon default program** — assumes specific commercial gym | Beginner, coach, power user | Medium |

**Through-line:** RepForge has a strong brain (progression logic, volume audit, local-first) wearing a weak body (session UX, adaptation, data stewardship).

## 2. The strongest product opportunities

1. **Session-first logging** — rest timer + one-exercise-at-a-time mode + visible session progress. This is the single highest-leverage change; it unblocks power users, parents, and minimalists simultaneously.

2. **Adaptation without guilt** — skip/substitute, "essentials only," time-boxed workouts, fatigue watch → one-tap trim. Turns RepForge from a rigid plan executor into a serious-lifter tool that respects real life.

3. **Local-safe, not just local-only** — IndexedDB, backup hygiene UI, import preview/merge, Web Share export, optional encryption. Closes the gap between philosophy and practice without accounts.

4. **Legible intelligence** — glossary-on-tap, plain-language recommendation copy, beginner effort scale mapped to RIR, hide advanced settings. Makes existing logic usable by more people without dumbing the engine.

5. **Data + logic leave together** — rich export (computed columns, stable IDs, progression rules doc), mesocycle blocks, PR ledger. The spreadsheet killer path.

6. **Collapse Stats to actionable defaults** — attention board *is* the stats page; charts and volume tables behind "dig deeper." Protects minimalist soul while keeping depth.

## 3. Features that are probably distractions

Consensus across personas on what **not** to build:

- Social feeds, leaderboards, community, PR sharing
- AI coaching chat / auto-generated programs
- Full coach SaaS (billing, scheduling, nutrition, in-app messaging) — at least not before solo loop is excellent
- Wearable/HRV/sleep/readiness dashboards
- Exercise GIF libraries and form-check empires
- Gamification (streaks, badges, XP)
- Mandatory cloud accounts / RepForge Cloud as default
- Marketplace of programs
- A sixth tab

**Coach features are a conditional opportunity, not the next bet.** The coach persona wants them, but five of seven personas explicitly said coach/cloud/social would betray the product. If pursued at all, it should be **opt-in, client-initiated sharing** (program-only export, periodic read-only snapshot) — not a platform pivot.

## 4. Product principles RepForge should follow

1. **Win between sets, not on the stats tab.** If it doesn't make logging faster or decisions clearer in the gym, it's secondary.

2. **Local-first means local-safe.** Privacy without durability is a broken promise. User-initiated backup is fine; making backup discipline the only safety net is not.

3. **Intelligence must be legible.** Every recommendation needs a one-breath "why." Jargon is a bug for anyone who didn't write the hypertrophy review doc.

4. **Adaptation beats adherence theater.** Missed days, short sessions, and substitutions are normal for serious lifters. The app should negotiate with the plan, not shame deviation.

5. **Data and logic travel together.** Exports should include what the app computed and the rules it used. Stable IDs are non-negotiable for long-term trust.

6. **Protect the Log tab's soul.** New features ship hidden, collapsed, or off-tab. Stats depth is for Sunday review, not Tuesday between sets.

7. **Refuse to become a wellness platform.** No social layer, no motivation product, no "fitness operating system." Stay a sharp progressive-overload logbook.

## 5. Prioritized roadmap

### Next 2 weeks (high impact, fits static PWA scope)

| Item | Rationale |
|---|---|
| **Rest timer** (per exercise, optional auto-start) | #1 gap vs Strong/Hevy; zero architectural risk |
| **Skip exercise + hide skipped from active log** | Unblocks parents and chaotic sessions; data layer already skips zero-load sets |
| **Recommendation copy pass** — plain language, tap-to-explain RIR/rep range | Beginner literacy without new features |
| **Hide progression settings behind "Advanced"** | Reduces beginner panic and minimalist noise |
| **Backup hygiene** — last export date, import preview before overwrite, Web Share export | Privacy maximalist critical path |
| **Fatigue watch → "Trim session" stub** — hide non-essential exercises for today | Connects insight to action |

### Next 2 months

| Item | Rationale |
|---|---|
| **Session mode** — one exercise at a time, progress indicator, finish workout | Fixes core session loop |
| **Substitution flow** — approved alternates per exercise slot | Parent, coach, power user |
| **Short workout / essentials mode** — time or readiness input → 2–3 lifts | Parent thesis made real |
| **Rich CSV export** — e1rm, tonnage, muscle tags, `exercise_id`, `is_hard_set` | Spreadsheet maximalist unlock |
| **IndexedDB migration** from `localStorage` | Durability without cloud |
| **lbs/kg unit toggle** | US market, power user |
| **Stats collapse** — actionable board default, charts behind expand | Minimalist protection |
| **Program-only export/import** | Coach-adjacent without platform |
| **Stable exercise ID surfacing** in editor + export | Trust foundation |

### Next 6 months

| Item | Rationale |
|---|---|
| **Mesocycle blocks** — tag sessions, filter stats/volume by block | Spreadsheet killer; training system maturity |
| **PR ledger** per exercise | Motivation without social |
| **Flexible schedule** — deferred/missed day queue, not rigid calendar | Parent + adherence |
| **Import merge** by session ID | Data safety |
| **Optional client-side encrypted export** | Privacy maximalist migration path |
| **Bodyweight per session** | Longitudinal tracking, minimal scope |
| **Warmup vs working set flag** | Volume audit accuracy |
| **Opt-in coach snapshot** (client shares last N days via export/link) | Test coach opportunity without SaaS pivot |
| **Beginner program variant** — plain exercise names, gym-floor hints | Lower floor without new product |

## 6. Final recommendation

### What RepForge should become

**The fastest honest progressive-overload log for serious solo lifters** — local-first, offline-capable, RIR-aware, progression-smart, and ruthless about in-gym speed.

The product's unfair advantage is not stats depth or program editing. It's the combination of:

- **No account, no cloud, no social noise**
- **Real hypertrophy mechanics** (double progression, hard-set volume, fatigue signals)
- **A static, auditable codebase** a privacy-conscious user can trust

The path to product-market fit runs through **session UX** (rest timer, focus mode, adaptation) and **data stewardship** (durable storage, portable exports, safe import) — not through feature accumulation on the Stats tab.

### What RepForge should refuse to become

- A **social fitness app** (feeds, leaderboards, sharing culture)
- A **bloated coaching platform** (Trainerize-lite with accounts and subscriptions)
- An **AI program generator** or chat coach
- A **generic wellness dashboard** (HRV, sleep, readiness scores, habit streaks)
- A **content library** (exercise GIFs, form courses, motivation)

The honest positioning: **RepForge is a private forge for people who already decided to train seriously and want software that respects that decision** — fast logging, clear progression signals, owned data, no performance for an audience.

The biggest strategic fork is coach features. The feedback says: **don't build a coach platform; build solo-lifter excellence first.** If coach value emerges later, it should be **export-shaped and opt-in** — program templates, read-only snapshots, pinned notes — not a second product wearing the same logo.

---

**Bottom line:** RepForge's progression engine and local-first philosophy are genuinely differentiated. The product loses users in the gym (session loop) and on new phones (data durability), and it alienates beginners (literacy gap) while simultaneously building stats complexity that worries its best advocates (minimalists). Fix the session, make the intelligence readable, make the data safe and portable — then decide if anyone else belongs in the room.
