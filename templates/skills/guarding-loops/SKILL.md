---
name: guarding-loops
level: L1-RIGID
owner: all-agents
trigger: before every loop iteration
metadata:
  category: meta
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
3. Verify proof prerequisites (commands exist, environment reachable).
4. Verify stall counters and no-progress conditions.
5. Verify whether a human gate is pending.
6. Verify whether the loop is in an unsafe or ambiguous state.
7. Verify git commit exists for the current AC (if in `in-dev` and AC work was done).
8. Either clear the loop to proceed or halt it with an explicit reason.

## State Model

- `cleared` — loop may proceed
- `halted-stall` — no progress detected; budget exhausted
- `halted-ambiguous` — state is unclear; raise human gate 6
- `halted-human-gate` — required human approval missing
- `halted-unsafe` — feature is unsafe; raise human gate 7


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Always run before any loop iteration step.
2. If any verification fails, halt with the specific reason.
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
- Git commit missing for a completed AC (no `feat({STORY-ID}): AC{n}` commit found after AC GREEN)
