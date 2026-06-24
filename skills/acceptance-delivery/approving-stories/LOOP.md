# approving-stories — Loop

The L3-MECH PO acceptance loop. The po-agent verifies that the delivered
story matches the original story intent and every acceptance criterion.
This is not exploratory testing and not a design discussion. The
question is simple: does the shipped behavior satisfy the agreed story,
yes or no?

## Entry Conditions

- A story is in `in-acceptance` (claimed via `using-forge` Step 3).
- `running-regression-suite` PASSED; the story is in `ready-for-acceptance`
  (the pull moves it to `in-acceptance`).
- The story snapshot at `stories/[STORY-ID].md` is locked.
- Desk checks are approved; regression suite passed.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Per-story loop state held in `stories/[STORY-ID].loop.md`:

- `story_snapshot_locked` — boolean (must be true).
- `linked_empathy_map_ref` — string (path + ID in `docs/empathy-map.md`).
- `ac_results` — list of `{ ac_id, expected, observed, pass }`.
- `verdict` — `pass` | `fail` | `in-progress`.
- `failure_reason` — string (on FAIL).

## Single Iteration Step

1. Read the story in Linear and the locked snapshot in
   `stories/[STORY-ID].md`.
2. Read the linked empathy map reference in `docs/empathy-map.md`.
3. For each AC, verify through the UI on the test environment:
   - Does the UI behave exactly as the AC states?
   - Is the customer value present, not just technical completion?
   - Is there a visible mismatch between UX expectation and
     implementation?
4. Confirm desk checks and regression suite already passed (read from
   the story snapshot).
5. Decide:
   - PASS → move story to `ready-to-deploy`; post Linear comment
     `"PO acceptance PASSED for [STORY-ID]. Ready for deploy
     approval."`
   - FAIL → move story to `ready-for-dev`; post Linear comment with
     which AC failed and expected vs observed.
6. Exit the loop; the next pull from `ready-for-acceptance` starts a
   new iteration.

## Proof of Progress

- One PO acceptance decision was made and recorded (PASS or FAIL).
- A Linear comment records the verdict and the AC evidence (expected
  vs observed on FAIL).
- The story snapshot `stories/[STORY-ID].loop.md` reflects the
  `verdict`.

## State Transition Rule

```
transition in-acceptance → ready-to-deploy
  trigger ACs pass and human approves production release
  handoff finishing-stories to po-agent

transition in-acceptance → ready-for-dev
  trigger any AC failed
  handoff running-atdd-sessions to developer-agent

transition in-acceptance → in-dev
  trigger PO or UX finds issues, returns bug report
  handoff running-atdd-sessions to developer-agent
```

## Halt Conditions

- Any AC behaves differently from how the AC is written → halt;
  verdict = FAIL.
- The story solves a different problem than the one described → halt;
  verdict = FAIL; po-agent writes specific expected vs actual.
- A desk check is not in `approved` state → halt; route back to
  `running-desk-checks`.
- A `guarding-loops` `halted-*` report → stop; do not modify Linear.

## Handoff Target

- PASS → `finishing-stories` (po-agent + devops-agent) on human
  approval of release.
- FAIL → developer-agent (pull model via `using-forge` Step 3); story
  reappears in `ready-for-dev`.
- Missing or altered ACs → `writing-stories` (po-agent) Gate 1 to
  rewrite; story returns to `in-analysis`.
