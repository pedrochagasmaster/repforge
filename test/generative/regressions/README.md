# Generative regression corpus

Frozen counterexamples from generative search that earned a permanent home.

Policy (from `../README.md`): when fast-check finds a real bug, prefer
converting the minimized counterexample into a readable deterministic test
next to the code it exercises. Only cases whose value is inherently
generative (pathological shapes, long action sequences, rare interleavings)
belong here, frozen as seed/path pairs with the property they guard.

This directory is intentionally empty at Phase 1: no property failure has
survived investigation as an application bug yet. The first entry should
look like:

```
---
found-by: campaign profile, 2026-xx-xx
property: setup links: decode(encode(payload)) preserves the canonical proposal exactly
seed: 123456789
suite-seed: 987654321
status: fixed in <commit>, deterministic regression added to test/shared-setup-unit.mjs
notes: shrunk counterexample was ...
```
