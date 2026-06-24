# validating-test-harness — Loop

The L2-GUIDED test-harness validation loop. Blocks Iteration 1 until the
testing foundation is proven. The first dummy Acceptance Test must run in
CI and pass against the test environment. If the harness is flaky, slow,
or non-reproducible, Iteration 1 stays closed.

## Entry Conditions

- `bootstrapping-project` has posted its completion signal.
- `securing-pipeline` has posted its completion signal.
- Test environment URL and CI pipeline URL are written to
  `project.constraints.yaml`.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Local file state plus Linear / CI:

- `dummy_at_path` — path of the trivial Acceptance Test (e.g.,
  `tests/acceptance/iteration-0/dummy.spec.ts`).
- `local_run_result` — `pass` | `fail` | `unknown`.
- `ci_run_result` — `pass` | `fail` | `unknown`.
- `test_env_run_result` — `pass` | `fail` | `unknown`.
- `runtime_seconds` — observed runtime of the dummy test.
- `iteration_1_unblocked` — boolean; `true` only after all pass
  conditions hold.
- `failure_reason` — last failure reason posted to Linear (if any).

## Single Iteration Step

1. Confirm `bootstrapping-project` and `securing-pipeline` completion
   signals exist on Linear.
2. Confirm a dummy Acceptance Test exists
   (`writing-acceptance-tests` writes it during Iteration 0).
3. Run the dummy test locally → record `local_run_result`.
4. Push; run the dummy test in CI → record `ci_run_result`.
5. Run the dummy test against the test environment URL → record
   `test_env_run_result`.
6. Compute the verdict:
   - PASS = local + CI + test-env all `pass` AND runtime is acceptable.
   - FAIL = any of the three fails, or runtime is unacceptable, or
     failure output is not understandable.
7. Post the verdict to Linear; update `iteration_1_unblocked`.

## Proof of Progress

- `local_run_result`, `ci_run_result`, `test_env_run_result` all updated
  for this iteration.
- A Linear milestone comment records the verdict and (on PASS) unblocks
  Iteration 1, or (on FAIL) lists the specific failure reason.

## State Transition Rule

transition in-analysis → in-dev
  trigger test harness validated and passes
  handoff using-forge to all-agents

transition in-analysis → in-analysis
  trigger test harness failed
  handoff bootstrapping-project to devops-agent

## Halt Conditions

- The dummy test only passes locally → halt; the harness is not
  reproducible; route to `bootstrapping-project`.
- The dummy test flakes across repeated runs → halt; raise as a CI
  reliability issue.
- Test environment is unreachable → halt; route to `bootstrapping-project`.
- A `guarding-loops` `halted-*` report → stop; do not modify the verdict.

## Handoff Target

- PASS → return to `using-forge` Step 3 for developer-agents to begin
  pulling from `ready-for-dev`.
- FAIL → `bootstrapping-project` (devops-agent) for infrastructure
  fix.
- Concurrent during Iteration 0 → `writing-acceptance-tests` (qa-agent)
  writes the dummy harness test using the writing skill, then this loop
  validates it.
