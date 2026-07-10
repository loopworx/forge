# running-regression-suite — Loop

The L2-GUIDED regression loop. Runs the relevant regression suite for a
story in `in-qa`. Verifies the accepted ACs for the story and checks for
regressions in adjacent flows impacted by the change. This is broader
than a desk check and narrower than "test everything forever".

## Entry Conditions

- A story has been moved to `in-qa` (developer-agent hand-off complete).
- The story is deployed to the test environment; feature flag is OFF.
- `project.constraints.yaml` and `CONTEXT.md` are readable.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Per-story loop state held in `stories/[STORY-ID].loop.md` and the
regression runner output:

- `regression_scope` — list of test files / flows to run (story ATs +
  adjacent flows + bounded-context regressions + security-sensitive
  flows).
- `tests_run` — count of tests executed.
- `tests_passed`, `tests_failed` — counts.
- `failures` — list of `{ flow, repro, expected, actual }`.
- `verdict` — `pass` | `fail` | `in-progress`.

## Single Iteration Step

1. Read the story's ACs and identify the regression scope:
   - The story's own Acceptance Tests.
   - Adjacent flows sharing the same page or endpoint.
   - Previously shipped stories in the same bounded context.
   - Security-sensitive flows if the story touches auth, money, PII,
     or permissions.
2. Run the story's Acceptance Tests on the test environment.
3. Run the selected adjacent regression tests.
4. Capture failures with exact repro steps (flow, repro, expected,
   actual).
5. Decide:
   - PASS → move story to `ready-for-acceptance`; post Linear
     comment `"Regression suite PASSED for [STORY-ID]. Moving to
     ready-for-acceptance."`
   - FAIL → move story back to `ready-for-dev`; post Linear comment
     `"Regression suite FAILED for [STORY-ID]. Returning to
     ready-for-dev. Failing flow: [flow]. Repro: [steps]."`
6. Exit the loop; the next pull from `ready-for-qa` starts a new
   iteration.

## Proof of Progress

- One run of the regression suite was executed and recorded
  (`tests_run`, `tests_passed`, `tests_failed`).
- A Linear comment records PASS or FAIL with the story ID and (on FAIL)
  the failing flow and repro.
- `stories/[STORY-ID].loop.md` is updated with the verdict.

## State Transition Rule

```
transition ready-for-qa → ready-for-acceptance
  trigger regression suite passes
  handoff approving-stories to po-agent

transition ready-for-qa → ready-for-dev
  trigger regression suite fails
  handoff running-atdd-sessions to developer-agent

transition in-qa → in-dev
  trigger bug found during full QA check
  handoff running-atdd-sessions to developer-agent
```

## Halt Conditions

- A failure has no reproducible steps → halt; raise to developer-agent
  with the failure log.
- A failure is in a security-sensitive flow (auth, money, PII) → halt;
  treat as a stop-ship candidate; raise human gate.
- A `guarding-loops` `halted-*` report → stop; do not modify Linear.
- The regression suite itself is flaky → halt; route to
  `validating-test-harness` to re-validate the harness.

## Handoff Target

- PASS → `approving-stories` (po-agent) when story appears in
  `ready-for-acceptance`.
- FAIL → developer-agent (pull model via `using-forge` Step 3); story
  reappears in `ready-for-dev`.
- Flaky harness → `validating-test-harness` (qa-agent) →
  `bootstrapping-project` (devops-agent) on FAIL.
