# validating-test-harness — Handoffs

## Concurrent: writing-acceptance-tests (Iteration 0 only)

**Skill:** `writing-acceptance-tests`
**Agent:** qa-agent
**Trigger:** Runs alongside `validating-test-harness` during Iteration 0
**Purpose:** The dummy harness validation test IS the first Acceptance Test. qa-agent writes it using `writing-acceptance-tests`, then validates it using this skill.
**Artifact produced:** Acceptance test scaffold file; confirmed running in CI against test environment

## On PASS

**Unblocks:** Iteration 1
**Action:** Post to Linear milestone: "Acceptance test harness validated. Iteration 1 may begin."
**Next:** developer-agents may now pull from `ready-for-dev` using `using-forge` pull protocol

## On FAIL

**Blocks:** Iteration 1 remains closed
**Routes to:** `bootstrapping-project` (devops-agent) to fix the infrastructure issue
**Action:** Post to Linear with the specific failure reason
**Do not:** Ask developer-agents to work around the harness failure — fix the harness first
