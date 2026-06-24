# resuming-sessions — Loop

This is the L1-RIGID session-resume loop. It overrides plan files and
conversation summaries. The rule: re-run the outer Acceptance Test before
reading anything else; the test tells you where you are. Before each
iteration of this loop, `guarding-loops` pre-flight is REQUIRED.

## Entry Conditions

- A session has started and Linear shows a story assigned to the agent in
  an in-progress state (`in-dev`, `in-qa`, or `in-acceptance`).
- The story snapshot at `stories/[STORY-ID].md` exists (or can be derived
  from Linear).
- `guarding-loops` pre-flight has cleared the current iteration.

## Loop State Schema

Read from:

- `stories/[STORY-ID].loop.md` (per-story loop state for the delivery
  loop: `current_loop`, `stall_counter`, `iteration_counter`,
  `last_proof_result`, `guardian_check`).
- `stories/[STORY-ID].md` snapshot — sub-slice statuses:
  `pending` → `in-progress` → `done`.

Session-level fields:

- `assigned_story_state` (`in-dev` | `in-qa` | `in-acceptance`).
- `outer_at_last_result` (`RED` | `GREEN` | `unknown`).
- `resume_decision` (`continue-atdd` | `route-to-qa` | `route-to-acceptance`
  | `await-human` | `fallback-pull`).

## Single Iteration Step

1. Run `guarding-loops` pre-flight (L1-RIGID prerequisite — do not skip).
2. Query Linear: confirm the story is still assigned to this agent and
   still in an in-progress state. If not → fall back to `using-forge`
   Step 3 (Pull).
3. Run the outer Acceptance Test for the story (the
   `outer_at_command` from `project.constraints.yaml`).
4. Cross-reference the result with the story snapshot:
   - If `RED` → identify the last `done` sub-slice; resume ATDD loop
     from the next `pending` sub-slice (restart any `in-progress`
     sub-slice from scratch).
   - If `GREEN` → STOP. Outer AT should not be green at resume. Post to
     Linear: "Outer AT is unexpectedly GREEN on resume — needs human
     review." Wait for human.
5. Read `CONTEXT.md` and `project.constraints.yaml`.
6. Hand off to `running-atdd-sessions` to continue the ATDD loop (or to
   `running-regression-suite` / `approving-stories` if `in-qa` /
   `in-acceptance`).

## Proof of Progress

- The outer Acceptance Test was actually executed and its result recorded
  on the loop-state file (`outer_at_last_result`).
- A resume decision was made (`continue-atdd`, `route-to-qa`,
  `route-to-acceptance`, `await-human`, or `fallback-pull`) and timestamped
  in `guardian_check`.
- Story snapshot `stories/[STORY-ID].md` reflects the resumed-from
  sub-slice.

## State Transition Rule

transition in-dev → in-dev
  trigger session resume with outer AT RED and story assigned
  handoff running-atdd-sessions to developer-agent

transition in-qa → in-qa
  trigger session resume with story in QA
  handoff running-regression-suite to qa-agent

transition in-acceptance → in-acceptance
  trigger session resume with story in acceptance
  handoff approving-stories to po-agent

transition in-analysis → ready-for-dev
  trigger session resume with no story assigned
  handoff using-forge to all-agents

transition in-dev → halted-human-gate
  trigger outer AT unexpectedly GREEN on resume
  handoff using-forge to all-agents

## Halt Conditions

- `guarding-loops` reports any `halted-*` → stop; do not resume.
- Outer AT is unexpectedly GREEN on resume → stop; raise human gate.
- Story is no longer assigned or no longer in progress → fall back to
  `using-forge` pull protocol (do not auto-reassign).
- Plan file disagrees with test reality → Linear wins; update the plan
  file after the loop completes.

## Handoff Target

- On `continue-atdd`: hand off to `running-atdd-sessions`
  (developer-agent, from the next pending sub-slice).
- On `route-to-qa` (rare on resume): hand off to `running-regression-suite`
  (qa-agent).
- On `route-to-acceptance` (rare on resume): hand off to `approving-stories`
  (po-agent).
- On `await-human`: post to Linear; end session; await human instruction.
- On `fallback-pull`: return to `using-forge` Step 3 (Pull protocol).
