---
name: resuming-sessions
level: L1-RIGID
owner: all-agents
trigger: any session where Linear shows an in-progress story assigned to you
description: Restores context and resumes a story in progress by reading loop state and re-routing to the correct loop
---

# resuming-sessions

## Description

How to safely resume an in-progress story after a context window ends, a session crashes, or an agent restarts. The rule is simple: re-run the outer Acceptance Test before reading anything else. The test tells you where you are. Everything else lies.

---

## The Problem This Solves

Context windows end mid-story. When an agent restarts, it has:
- A plan file that says "implement the handler next"
- A conversation summary that says "FE loop done, starting BE loop"
- A Linear card that says `in-dev`
- No reliable memory of what code actually exists

The plan file and conversation summary reflect *intentions*, not *reality*. Only the test suite reflects reality.

---

## Resume Protocol

```
1. Query Linear → verify story is still assigned to you and in `in-dev`

2. Run the outer Acceptance Test — do not read anything else first
   → RED:   note which ACs are still failing
             cross-reference with story snapshot in stories/[STORY-ID].md
             identify the last completed sub-slice
             resume ATDD loop from next sub-slice
   → GREEN: STOP. Do not proceed.
             Something unexpected happened.
             Post to Linear: "Outer AT is unexpectedly GREEN on resume — needs human review"
             Wait for human instruction.

3. Read CONTEXT.md
4. Read project.constraints.yaml
5. Continue ATDD loop
```

---

## What "Last Completed Sub-slice" Means

Verify the story snapshot at `stories/[STORY-ID].md`.
Each AC has sub-slices. Each sub-slice has a status: `pending`, `in-progress`, `done`.

The last `done` sub-slice is where you resume from — start the *next* `pending` sub-slice.
If a sub-slice is `in-progress`, treat it as incomplete — restart it from scratch.

**Never assume a sub-slice is done because the plan file says so.**
Only the test result determines done.

## State Model

This skill uses the story state during a resume verification.

- `in-dev` — story assigned to the agent when the session ended
- `in-qa` / `in-acceptance` — other in-progress states that may be assigned
- `ready-for-dev` — fallback destination if the story is no longer in progress

## Rules

1. Query Linear first; verify the story is still assigned and in `in-dev`.
2. Run the outer Acceptance Test before reading plan files or conversation summaries.
3. If the outer AT is GREEN, stop and post to Linear for human review.
4. Resume from the next pending sub-slice after the last `done` one.
5. Treat any `in-progress` sub-slice as incomplete and restart it.
6. Only test results determine reality; never trust the plan file.

## Entry Conditions

- A new session starts and Linear shows a story currently assigned to the agent in an in-progress state (`in-dev`, `in-qa`, or `in-acceptance`).

## Halt Conditions

- Outer AT is unexpectedly GREEN; story paused awaiting human instruction.
- The story is no longer assigned or no longer in progress; fall back to `using-forge` pull protocol.
- Resume protocol completes and ATDD loop continues.
