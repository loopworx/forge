# securing-pipeline — Loop

The L2-GUIDED pipeline-security loop. Adds and maintains security gates
in the delivery pipeline: SAST, DAST where appropriate, dependency
scanning, secret scanning, and fail-fast rules. Security gates must be
automated and visible; manual memory is not a control.

This is a one-shot setup loop, not a per-story pipeline step. Once the
gates are configured, they run automatically on every push. The loop
is invoked again only when a new language/runtime/tooling is introduced
or when recurring security failures need tuning.

## Entry Conditions

- Iteration 0 begins (`bootstrapping-project` fires concurrently); OR
- a new language/runtime/tooling is introduced (architect-agent or
  devops-agent posts to Linear); OR
- recurring security failures force threshold tuning (secops-agent
  decides).
- `project.constraints.yaml` is readable (priority `security` is known).
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Local file state plus the CI/CD pipeline definition:

- `gates_active` — map of `{ secret_scanning: bool, dependency_scan:
  bool, sast: bool, container_scan: bool, dast: bool }`.
- `blocking_thresholds` — per-gate threshold config (e.g., critical = block,
  high = require waiver).
- `last_invocation_reason` — `iteration-0` | `new-language` |
  `tune-thresholds`.
- `waivers_open` — list of high vulnerabilities with a pending human
  waiver.

## Single Iteration Step

1. Determine the invocation reason:
   - `iteration-0` → configure the full minimum gate set.
   - `new-language` → add the appropriate scanner for the new surface.
   - `tune-thresholds` → investigate recurring failures; tune thresholds;
     fix root cause; do not suppress.
2. Configure or update each gate in the CI/CD pipeline definition.
3. Verify each gate actually fires on a fixture violation (commit a
   fixture secret, run the scan, confirm the gate blocks).
4. Set or update `blocking_thresholds`.
5. Post the pipeline security baseline to the Linear iteration
   milestone:
   `"Security gates active: secret scanning, dependency scan, SAST[, DAST].
    Blocking thresholds configured."`
6. Exit the loop; gates now run automatically on every push.

## Proof of Progress

- A fixture-violation test confirmed every configured gate actually
  fires and blocks.
- A Linear milestone comment records the gates-active baseline.
- `gates_active` and `blocking_thresholds` are persisted in the loop
  state file.

## State Transition Rule

transition in-analysis → in-analysis
  trigger Iteration 0 begins
  handoff securing-pipeline to secops-agent

transition in-analysis → in-analysis
  trigger new language or runtime introduced
  handoff securing-pipeline to secops-agent

## Halt Conditions

- A gate cannot be configured for the chosen language/runtime → halt;
  raise to architect-agent for an ADR on language selection.
- A gate fires but is being routinely waived → halt; tune thresholds or
  fix the underlying issue; do not suppress.
- A plaintext secret is found in git history → halt; stop-ship event;
  raise human gate 7 (`halted-unsafe`); follow the disclosure policy.
- A `guarding-loops` `halted-*` report → stop; do not modify the
  pipeline.

## Handoff Target

- Setup complete → return control to `bootstrapping-project`
  (devops-agent) so it can post its own completion signal.
- New-language invocation → hand off to architect-agent who reviews the
  language decision via `deciding-architecture` if needed.
- Recurring failure requires human judgement → raise human gate
  (waiver review).
