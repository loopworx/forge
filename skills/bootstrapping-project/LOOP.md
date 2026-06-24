# bootstrapping-project — Loop

The L3-MECH Iteration 0 bootstrap loop. Sets up the delivery foundation
required before Iteration 1 may begin: CI/CD pipeline, test environment,
production deployment path, feature flag platform, and baseline repo
automation. This is mechanical execution of an agreed platform shape,
not an architecture exercise.

## Entry Conditions

- Iteration 0 starts (`docs/iteration-board.loop.md` `iteration_0_status`
  becomes `in_progress`).
- `project.constraints.yaml` exists.
- Platform-shape ADRs (CI/CD, environments, feature flags) are accepted
  in `docs/adr/`.
- Human has approved infrastructure access and credentials.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Read from `docs/iteration-board.loop.md`, `project.constraints.yaml`,
and Linear:

- `iteration_0_status` — `pending` → `in_progress` → `complete` |
  `blocked`.
- `checklist_progress` — counts per bucket:
  - `ci_cd_complete` (boolean for each: unit/component CI, acceptance
    scaffold, contract tests, fast-fail lint/typecheck).
  - `environments_complete` (test env reachable, prod deployment path,
    URLs written to constraints).
  - `feature_flags_complete` (Unleash running, default strategy,
    agent access documented).
  - `security_baseline_complete` (secret scanning on, env vars
    documented, no plaintext secrets).
  - `repo_ergonomics_complete` (README install path, test commands,
    acceptance test command).
- `awaiting_human_gate` — `null` until human approves go-live.

## Single Iteration Step

1. Read `docs/iteration-board.loop.md` and confirm
   `iteration_0_status: in_progress`.
2. Pull the next unchecked item from the bootstrap checklist.
3. Execute that item (configure CI job, spin up environment, set feature
   flag default strategy, etc.).
4. Update `checklist_progress` in the loop-state file.
5. Run the smoke check for that item (does CI pass? does test env
   respond? does Unleash respond? does secret scanning block on a
   fixture secret?).
6. Loop back to Step 2 until every checklist bucket is complete.
7. Post to Linear iteration milestone:
   `"Iteration 0 platform bootstrap complete. Test environment live.
    Feature flags live. CI green."`
8. Hand off to `validating-test-harness` (qa-agent).

## Proof of Progress

- `checklist_progress` is updated for the iterated bucket; each
  completed bucket has a verification artifact (commit hash, env URL,
  job URL).
- A Linear milestone comment records the bootstrap completion signal.
- `securing-pipeline` has posted its own completion signal before this
  loop may mark itself complete.

## State Transition Rule

transition in-analysis → in-analysis
  trigger bootstrapping begins
  handoff securing-pipeline to secops-agent

transition in-analysis → in-analysis
  trigger bootstrapping checklist complete and security baseline ready
  handoff validating-test-harness to qa-agent

## Halt Conditions

- A checklist item requires an architecture decision that has no ADR →
  halt; route to `deciding-architecture`.
- Infrastructure access not approved by human → halt; raise human gate.
- `securing-pipeline` has not signalled completion → halt; do not mark
  bootstrap complete.
- A `guarding-loops` `halted-*` report → stop; do not modify the
  checklist state.

## Handoff Target

- Checklist complete + `securing-pipeline` signalled → fire
  `validating-test-harness` (qa-agent) with the test environment URL
  and CI pipeline URL.
- Concurrent on start → `securing-pipeline` (secops-agent +
  devops-agent) configures gates in parallel.
- On FAIL in `validating-test-harness` → loop returns to
  `bootstrapping-project` to fix the infrastructure issue.
