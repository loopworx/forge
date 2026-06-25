---
name: bootstrapping-project
level: L3-MECH
owner: devops-agent
trigger: iteration zero starts
metadata:
  category: iteration-zero
description: Bootstraps project infrastructure — CI/CD pipeline, environments, repo structure, and security baseline
---

# bootstrapping-project

## Description

Sets up the delivery foundation required before Iteration 1 may begin: CI/CD pipeline, test environment, production deployment path, feature flag platform, and baseline repo automation. This is mechanical execution of an agreed platform shape — not an architecture exercise.

---

## Preconditions

Before running this skill:
- `project.constraints.yaml` exists
- Required ADRs for platform shape are accepted
- Human has approved infrastructure access and credentials

---

## Checklist

### CI/CD
- [ ] CI runs unit/component tests on every push to trunk
- [ ] CI runs acceptance test scaffold
- [ ] CI runs contract tests
- [ ] CI fails fast on lint/typecheck/test failure

### Environments
- [ ] Test environment exists and is reachable
- [ ] Production deployment path exists
- [ ] Test environment URL written to `project.constraints.yaml`
- [ ] Production URL written to `project.constraints.yaml`

### Feature Flags
- [ ] Unleash (or chosen platform) is running
- [ ] Default strategy configured
- [ ] Agent access path documented

### Secrets & Security Baseline
- [ ] Secret scanning enabled in pipeline
- [ ] Minimum env vars documented
- [ ] No plaintext secrets committed

### Repo Ergonomics
- [ ] README install path verified
- [ ] Test commands documented
- [ ] Acceptance test command documented

---

## Completion Signal

When complete, post to Linear iteration milestone:
> "Iteration 0 platform bootstrap complete. Test environment live. Feature flags live. CI green."

Iteration 1 may not start until `validating-test-harness` passes.

## State Model

This skill operates during Iteration 0 before the normal story board is active.

- `in-analysis` — infrastructure stories for Iteration 0
- Iteration 0 project — bootstrapping work in progress
- Iteration 1+ projects — locked until Iteration 0 complete


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

1. Execute the checklist mechanically; no architecture decisions here.
2. CI must run unit/component tests, acceptance tests, contract tests, and fail fast.
3. Test and production environments and URLs must be written to `project.constraints.yaml`.
4. Feature flag platform must be live with default strategy configured.
5. Security baseline (secret scanning, documented env vars) must be in place.
6. Post the completion milestone comment before handing off to `validating-test-harness`.
