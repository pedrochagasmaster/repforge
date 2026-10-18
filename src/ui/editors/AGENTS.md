# Shared program editor

`program.js` owns mounted DOM, focus/caret restoration, expansion, move/undo presentation, and optional drag lifetime. `contracts.js` describes its normalized host documents and the concrete optional vendor interface. Construction mounts nothing; each mount must be disposed by its host.

Use `training/authoring.js` for document editing and Suggest loads policy. Speculative document mutations belong in `authoring/internal/editor-document.js`; canonical installed/setup validation and publication belong to their application commands. The UI must never import persistence, read storage, or obtain training rules from a browser global.

The host's `read` returns `{document, token}`. `commit` returns an explicit receipt; the host owns whether that edit is staged or durable. Keep pending DOM name edits and caret state private to the mount. A late acknowledgement from a disposed mount must not repaint its replacement.

Run `node test/editor-document-rules.mjs` for document rules. Browser coverage includes `program-editor-text-fields`, `per-side-execution-mode-capture-browser`, `native-editor-lifetime`, and `custom-mutation-recovery`. Preserve their independently authored identities, saved-data checks, and browser-Back assertions. Do not recapture historical fixture bytes.

`review.js` mounts recommendation Review; its host owns the private baseline, edit log, recommendation verification and session writes. It imports `authoring.review` for edits, replay, change counts, blockers and catalog policy. `review-contracts.js` keeps host receipts, sheet modes and transient tab/reorder state explicit. Never duplicate those training algorithms in rendering. Review serializes edits, drops queued work when disposed and lets a host operation already issued settle without repainting, announcing or clearing a replacement owner's busy state.

Review changes use the retained production `program-entry-s4` journey and the new `native-review-lifetime` malformed-action/disposal boundary proof. Keep source-schema validation in the authoring owner; a forged DOM attribute must not bypass it.
