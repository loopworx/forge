# running-tdd-loops — Handoffs

## Context

`running-tdd-loops` is called from *within* `running-atdd-sessions` for each sub-slice.
It does not hand off to a different skill when complete — control returns to `running-atdd-sessions`.

## Return protocol

```
FE inner loop complete (RED → GREEN → REFACTOR):
  → return to running-atdd-sessions
  → running-atdd-sessions begins BE inner loop for the same sub-slice

BE inner loop complete (RED → GREEN → REFACTOR):
  → return to running-atdd-sessions
  → running-atdd-sessions marks sub-slice done in story snapshot
  → running-atdd-sessions moves to next sub-slice or signals desk check
```

## If new behaviour found during refactor

Do NOT continue implementing it inside this loop.

```
→ STOP refactor
→ add new sub-slice to story snapshot with status: pending
→ return to running-atdd-sessions
→ running-atdd-sessions will schedule the new sub-slice
```

## Never fires independently

`running-tdd-loops` is never triggered by a Linear state or session start.
It is only ever called from within `running-atdd-sessions`.
