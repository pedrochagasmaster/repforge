# Trainer loop concept mock

**Status:** concept for trainer interviews, 2026-11-25. It describes no shipped behavior and is not an approved design; open work is listed only in [the backlog](../../backlog.md).

`index.html` is one self-contained clickable story in English and Portuguese: a trainer adds a client, hands a program over by QR or link, the client trains and sends three weeks back, the trainer reviews attendance, notes and loads, changes one exercise, and the client accepts the update. Every screen derives from one step counter; nothing is stored or sent.

Open the file through any static server from the repository root (it reads the app's fonts by relative path). Wide windows show both phones; phone width shows the one acting.

What the interviews should settle before any plan is written:

- whether the client review answers what a trainer wants to know about solo sessions;
- whether a client list on the trainer's own phone is how they want to work;
- how the handoff and the return actually travel (link size limits are unmeasured);
- copy and naming, which must stay inside `CONTEXT.md` (Taurifer is never called a coach).
