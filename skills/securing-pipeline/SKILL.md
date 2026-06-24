---
name: securing-pipeline
level: L2-GUIDED
owner: secops-agent, devops-agent
trigger: iteration zero; new language/runtime/tooling introduced; recurring security failures
metadata:
  category: acceptance-delivery
description: Configures SAST, DAST, dependency scanning, and secret detection in CI/CD pipelines
---

# securing-pipeline

## Description

Adds and maintains security gates in the delivery pipeline: SAST, DAST where appropriate, dependency scanning, secret scanning, and fail-fast rules. Security gates must be automated and visible; manual memory is not a control.

---

## Minimum Gates

- Secret scanning on every push
- Dependency vulnerability scanning on lockfile changes
- SAST on application code
- Container/image scanning if containers are used
- DAST against test environment for externally exposed apps when practical

---

## Output

Post pipeline security baseline to Linear iteration milestone:
> "Security gates active: secret scanning, dependency scan, SAST[, DAST]. Blocking thresholds configured."

## State Model

This skill maintains the pipeline security configuration for all future pushes.

- Iteration 0 — gates configured concurrently with `bootstrapping-project`
- Pipeline state: gates active on every push
- New language/runtime/tooling introduced — new scanner added
- Recurring security failures — gate tuning required

## Rules

1. Configure secret scanning on every push.
2. Configure dependency vulnerability scanning on lockfile changes.
3. Configure SAST on application code.
4. Configure container or image scanning if containers are used.
5. Configure DAST against the test environment for externally exposed apps when practical.
6. Critical vulnerabilities block the pipeline.
7. High vulnerabilities require explicit human waiver if not fixed immediately.
8. Secrets in git are an immediate stop-ship event.
9. Tune noisy tools so the gate remains meaningful.
