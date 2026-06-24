# running-desk-checks — Loop

The L2-GUIDED desk-check loop. Verifies a completed AC against its
acceptance criteria through the UI — exactly as an outside customer
would. Produces a desk-check artifact. The developer-agent may not
proceed to the next AC until the desk check is approved. This is a
human-visible checkpoint, not a rubber stamp.

## Entry Conditions

- developer-agent has completed all sub-slices for an AC and posted
  `"Desk check ready: AC-[N] [STORY-ID]"` on the story.
- The story is in `in-dev`; the AC's outer Acceptance Test is GREEN.
- The story is deployed to the test environment; feature flag is OFF
  in test.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Per-AC state held in `stories/[STORY-ID].md` and the story's loop-state
file:

- `current_ac` — `AC-[N]` being desk-checked.
- `desk_check_status` — `pending` | `in-deskcheck` | `approved` |
  `failed`.
- `desk_check_artifact` — `{ checked_by, checked_at, environment,
  notes, failure_reason, failure_screenshot }`.
- `parent_story_state` — `in-dev` (during desk-check), `in-dev` (on
  fail), `in-dev` (on approval, while next AC is started).

## Single Iteration Step

1. Pull the next AC in `pending` desk-check status for the story.
2. Verify locally:
   - Run the outer Acceptance Test for this AC → must be GREEN.
   - Open the application locally.
   - Execute each AC step manually as a customer would (UI only; no DB,
     no API calls, no internal state).
3. Verify on the test environment:
   - Confirm story is deployed to test environment (devops-agent
     confirms).
   - Repeat the manual UI verification against the test URL.
   - Confirm the feature flag is OFF on test environment.
4. Update `stories/[STORY-ID].md` AC `desk_check` block with status,
   timestamps, environment, notes.
5. Signal result on Linear:
   - APPROVED → `"Desk check AC-[N]: APPROVED ✓"`; notify
     developer-agent to proceed to next AC.
   - FAILED → `"Desk check AC-[N]: FAILED"` with expected vs actual;
     move story back to `in-dev`; developer fixes and re-triggers.
6. Loop back to Step 1 for the next AC, or exit when no more ACs are
   pending.

## Proof of Progress

- One desk-check artifact was written and committed in
  `stories/[STORY-ID].md` (status, timestamps, environment).
- A Linear comment records APPROVED or FAILED with the AC ID.
- On FAILED, the story is moved back to `in-dev` with explicit
  expected-vs-actual.

## State Transition Rule

transition in-deskcheck → in-dev
  trigger desk check approved by QA
  handoff running-atdd-sessions to developer-agent

transition in-deskcheck → in-dev
  trigger desk check failed
  handoff running-atdd-sessions to developer-agent

transition in-deskcheck → in-qa
  trigger all ACs finalized
  handoff running-regression-suite to qa-agent

## Halt Conditions

- The outer Acceptance Test is RED during verification → halt; the
  developer-agent has not actually finished the AC; route back to
  `running-atdd-sessions`.
- Feature flag is not OFF on test environment → halt; the story is not
  safely verifiable.
- A `guarding-loops` `halted-*` report → stop; do not commit the
  artifact.
- Two consecutive FAILED desk checks on the same AC → halt; raise
  human gate.
- Test environment unreachable → halt; route to
  `validating-test-harness` / `bootstrapping-project`.

## Handoff Target

- APPROVED → `running-atdd-sessions` (developer-agent) for the next AC.
- FAILED → `running-atdd-sessions` (developer-agent) for fix and
  re-trigger of the same AC.
- Test environment unreachable → `validating-test-harness`
  (qa-agent) → `bootstrapping-project` (devops-agent) on FAIL.
