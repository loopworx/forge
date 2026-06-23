# loop-guardian — Handoffs

## On CLEARED

The loop may proceed. Return control to the calling skill.

## On HALTED

The loop is halted. The agent must:

1. Post the halt reason to the Linear story comment.
2. If `halted-human-gate` or `halted-unsafe`: raise the appropriate human gate.
3. End the session or move to a different (non-blocked) story.

## Outbound

**On cleared:** return to caller (`using-forge`, `running-atdd-sessions`, etc.)

**On halted-stall:** do NOT auto-retry. Post to Linear and wait for human.

**On halted-human-gate:** post to Linear and end session.

**On halted-unsafe:** post to Linear and raise human gate 7.
