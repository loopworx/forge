---
name: validating-test-harness
level: L2-GUIDED
owner: qa-agent
trigger: after bootstrapping-project completes; before Iteration 1 opens
metadata:
  category: iteration-zero
description: Verifies that the test harness is operational, regression suite infrastructure works, and pipelines gate correctly
---

# validating-test-harness

## Description

Blocks Iteration 1 until the testing foundation is proven. The first dummy Acceptance Test must run in CI and pass against the test environment. If the harness is flaky, slow, or non-reproducible, Iteration 1 stays closed.

---

## Required Proof

### Dummy acceptance test
Create one trivial end-to-end test that proves the harness works:
- Opens the application
- Verifies a deterministic page element
- Runs in CI
- Runs against test environment

### Pass conditions
- [ ] Test passes locally
- [ ] Test passes in CI
- [ ] Test passes against test environment URL
- [ ] Runtime is acceptable for repeated use
- [ ] Failure output is understandable

### Fail conditions
- Test only passes locally
- Test depends on manual setup
- Test flakes across repeated runs
- CI environment differs materially from test environment

---

## Decision

if all pass conditions hold:
> Post to Linear: "Acceptance test harness validated. Iteration 1 may begin."

if any fail condition holds:
> Post to Linear: "Acceptance test harness NOT validated. Iteration 1 blocked. Reason: [reason]"

Iteration 1 is blocked until validation is green.

## State Model

This skill determines whether Iteration 1 may open.

- Iteration 0 — harness validation in progress
- Iteration 1 — blocked until validation green
- `ready-for-dev` — unlocked after validation passes
- `bootstrapping-project` — returned to on failure


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Create one deterministic, trivial end-to-end test that opens the app and verifies a page element.
2. The test must run locally, in CI, and against the test environment URL.
3. Runtime must be acceptable for repeated use and failure output must be understandable.
4. If any pass condition is missing, block Iteration 1 and return to `bootstrapping-project`.
5. Do not ask developer-agents to work around a harness failure.
