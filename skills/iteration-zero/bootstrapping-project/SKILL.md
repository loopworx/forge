---
name: bootstrapping-project
level: L3-MECH
owner: devops-agent
trigger: iteration zero starts
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
- [ ] README install path validated
- [ ] Test commands documented
- [ ] Acceptance test command documented

---

## Completion Signal

When complete, post to Linear iteration milestone:
> "Iteration 0 platform bootstrap complete. Test environment live. Feature flags live. CI green."

Iteration 1 may not start until `validating-test-harness` passes.
