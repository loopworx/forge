# bootstrapping-project — Handoffs

## Concurrent outbound (run in parallel during Iteration 0)

**Skill:** `securing-pipeline`
**Agent:** secops-agent + devops-agent
**Trigger:** Immediately when bootstrapping-project begins — security gates are part of the pipeline, not an afterthought
**Artifact passed:** CI/CD pipeline in progress; `project.constraints.yaml` (for security priority ranking)

## Sequential outbound (after checklist complete)

**Skill:** `validating-test-harness`
**Agent:** qa-agent
**Trigger:** All bootstrapping checklist items complete, including security baseline; Linear milestone comment posted
**Artifact passed:** Test environment URL; CI pipeline URL; confirmation that `securing-pipeline` gates are active

## Blocking condition
Iteration 1 is blocked until `validating-test-harness` passes.
