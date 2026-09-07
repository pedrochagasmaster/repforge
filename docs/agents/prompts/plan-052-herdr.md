# Resume Plan 052 with Herdr workers

Send the following prompt to the Codex coordinator. It resumes PR #228 and
does not authorize merging it.

```text
Coordinate the remaining implementation of Taurifer Plan 052 in
pedrochagasmaster/repforge. You are the read-only implementation judge.
Delegate bounded edits through the owner's installed herdr-subagents skill,
not native Codex subagents. Read that skill completely before dispatch.
In this environment it is /home/ubuntu/herdr-subagents/skill/SKILL.md.

Read AGENTS.md and applicable nested instructions, the complete
plans/052-block-transition-provenance-foundation.md,
docs/agents/herdr-ui-overhaul-execution.md,
docs/agents/implementation-evidence.md, the Plan 052 proof checkpoint,
docs/ui-overhaul-implementation-sequence.md, and the transition/recovery
contracts required by the plan. Product decisions are already approved.
Recovery policy version 2 is fixed. Do not redesign Progress or add features.

Resume the existing PR #228, branch ui-overhaul/052-transition-provenance,
worktree /home/ubuntu/repforge-ui-052-transitions. Fetch and inspect live
branches, worktrees, PR body, review threads, checks, and active workers.
Published proposal work existed at d1a84ea0 when this prompt was written.
Plans 050 and 051 are merged in main c3491c5e or its descendants. Revalidate
those facts. Do not create a second kickoff PR, replace existing work,
delete another worktree, copy unpublished files, or rewrite history.

If the worktree has an active writer or unexplained edits, establish ownership
before dispatch. Assign one Herdr writer to this checkout. All other workers
are read-only or use separate worktrees. Have the writer explicitly merge
current origin/main, resolve deliberately, and refresh PR dependency/handoff
facts. Never amend, rebase, force-push, or merge the implementation PR.

Start with the plan's resume/proof packet, not all remaining implementation.
Independently review and re-run published rows 1–2 after integration.
Use the real compiler pair and complete ordered mapping oracle. Include
freshly rehashed invalid proposals so semantic validation is actually tested.
Then prove one proposal through actual commit, reload, archive, and DraftV2
preservation before expanding to every family and transition kind.

Before each production packet, pin its inputs, outputs, exact allowed paths,
expected assertions, failure injection, and completion barrier in the PR's
acceptance contract. Use shipped DraftV2 queues/checkpoints/CAS and the
existing program replacement transaction. Do not make List DOM, raw storage
key equality, sleeps, or generated snapshots substitute for durable proof.
Use the plan's packet order, commands, rollback and owner gates. Future tests
are planned until implemented and executed. Publish no knowingly red commit.

Validate available provider/model/effort selections through the Herdr skill.
Start ordinary bounded implementation with Sonnet high or Gemini Flash high
according to available quota. Use cheap read-only workers for inventories.
Reserve a stronger read-only worker for unresolved identity/storage questions.
Do not delegate the whole plan or let workers delegate recursively.

Each handover is one self-contained packet. Watch it until settled, inspect
the actual diff and proof, then accept or issue a bounded correction. After
one unsuccessful repair of the same contract, stop symptom patches and resolve
the state model and failing test before another implementation attempt.
Keep long tests as logged processes, avoid duplicate runs, and use focused
proof before broad regression. Preserve every required final suite.

Have the writer commit and push each coherent verified slice immediately and
update PR #228. Record actual SHAs, commands, negative proof, artifact links,
thread/process ownership, blockers and Next exact steps. Check clean status
at each takeover boundary. Continue until the plan is complete or a genuine
owner/dependency gate blocks progress. Stop at owner review, not merge.

Final report: completed packets, current remote SHA, clean worktree, focused
and broad evidence on that SHA, catalog impact, unresolved findings/gates,
and the exact next owner action. Never report approval from CI alone.
```
