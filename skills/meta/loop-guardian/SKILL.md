---
name: guarding-loops
level: L1-RIGID
owner: all-agents
trigger: before every loop iteration
description: Guards every loop iteration against stalls, unsafe conditions, and budget overruns
---

# guarding-loops

## Description

L1-RIGID pre-flight guardian for every Forge loop. Runs *before* any loop
iteration, not just at session start. Either clears the loop to proceed or
halts it with an explicit reason.

This skill overrides everything. If `guarding-loops` halts, the agent must
halt — no rationalization, no overrides.

## Responsibilities

1. Re-read current external state (Linear story status).
2. Read the relevant loop-state file (e.g., `stories/[STORY-ID].loop.md`).
3. Check proof prerequisites (commands exist, environment reachable).
4. Check stall counters and no-progress conditions.
5. Check whether a human gate is pending.
6. Check whether the loop is in an unsafe or ambiguous state.
7. Either clear the loop to proceed or halt it with an explicit reason.

## State Model

- `cleared` — loop may proceed
- `halted-stall` — no progress detected; budget exhausted
- `halted-ambiguous` — state is unclear; raise human gate 6
- `halted-human-gate` — required human approval missing
- `halted-unsafe` — feature is unsafe; raise human gate 7

## Rules

1. Always run before any loop iteration step.
2. If any check fails, halt with the specific reason.
3. Do not modify external state during pre-flight.
4. Read `loop:` block in `project.constraints.yaml` for budget limits.

## Entry Conditions

- An agent is about to start a loop iteration
- Linear state and loop-state file are readable

## Halt Conditions

- Story assigned to a different agent
- Loop-state file contradicts Linear state
- Stall counter exceeds `max_no_progress_retries`
- Iteration counter exceeds `max_iterations_per_subslice`
- Wall-clock exceeds `max_story_loop_minutes`
- Required human gate is pending
- Unsafe feature detected
