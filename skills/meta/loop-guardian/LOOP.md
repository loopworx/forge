# loop-guardian — Loop

## Entry Conditions

- Agent is about to start a loop iteration
- Linear state and loop-state file are readable

## Loop State Schema

`stories/[STORY-ID].loop.md` for delivery loops, or
`docs/inception.loop.md` / `docs/iteration-board.loop.md` for project loops.

Required fields:
- `current_loop` (delivery / inception / iteration-board)
- `stall_counter` (integer)
- `iteration_counter` (integer)
- `last_proof_result` (pass / fail / null)

## Single Iteration Step

1. Read current external state (Linear).
2. Read loop-state file.
3. Compare; verify they agree.
4. Check stall counter against `max_no_progress_retries`.
5. Check iteration counter against `max_iterations_per_subslice`.
6. Check wall-clock against `max_story_loop_minutes`.
7. Decide: cleared or halted.

## Proof of Progress

Decision is logged in the loop-state file under `guardian_check` with
timestamp and outcome.

## State Transition Rule

On `cleared`: do not modify any state. Return control.
On `halted-*`: append `guardian_check` with reason. Do not advance state.

## Halt Conditions

- Stall counter exhausted
- Iteration counter exhausted
- Wall-clock budget exceeded
- Linear state contradicts loop-state file
- Human gate is pending
- Unsafe feature detected

## Handoff Target

On `cleared`: return to the calling skill.
On `halted-*`: post to Linear and end session, or raise the appropriate
human gate (5, 6, or 7).
