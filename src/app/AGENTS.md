# Application commands

Start with the user action: workout/Focus in `workout.js`, installed edits/custom
movements/replacement in `program.js`, History corrections in `history.js`, Progress/Overview projections in
`progress-read-models.js`, Review
confirmation in `review.js`, Settings/profile in `settings.js`/`profile.js`, private
import flow in `entry.js`, backup acknowledgement in `interchange.js`.

`session.js` owns one frozen acknowledged snapshot. Views receive `read` and
named commands; only composition/persistence publication receives `publish`.
Commands capture identities and speculative inputs before awaiting, then validate
the current head under the existing durable lock. Do not publish a proposal as an
acknowledged snapshot. Finish/activation require their qualified settlement;
backup `lastExport` keeps its distinct either-replica policy.

Read models contain facts for presentation. They do not issue durable commands,
render DOM, allocate identity, or create a second training algorithm. Private
Entry text/review undo is never a training snapshot or export section.

Discover the exact owning command with `node tools/run-tests.mjs fast --list`
and the matching browser lane (`state`, `entry`, `workout`). Run the focused owner
through that runner. A pure command proof cannot replace the real lock/replica/
reload proof when changing a durability boundary. Keep failures and provenance.

Migration remains active: root `app.js` still has temporary composition and
unmigrated responsibilities. Consult `docs/architecture/migration-status.md`;
do not add another permanent host callback bag or infer completion from a file.

Progress readers capture facts per operation and share the pure policies exposed
by `training/progress.js`; retain no acknowledged snapshot in a view factory.
Run `progress-overview-owner`, `progress-record-owner`, `session-outcome-owner`
and the actual lifecycle/recovery/Exercise browser journeys for that boundary.
The preserved historical-lift record-key omission is a separate policy defect,
not permission to change scope selection during an ownership move.
