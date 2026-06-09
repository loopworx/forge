---
name: securing-pipeline
level: L2-GUIDED
owner: secops-agent, devops-agent
trigger: iteration zero; new language/runtime/tooling introduced; recurring security failures
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

## Rules

1. Critical vulnerabilities block the pipeline.
2. High vulnerabilities require explicit human waiver if not fixed immediately.
3. Secrets in git are an immediate stop-ship event.
4. Security tool noise must be tuned — if everyone ignores it, the gate is broken.

---

## Output

Post pipeline security baseline to Linear iteration milestone:
> "Security gates active: secret scanning, dependency scan, SAST[, DAST]. Blocking thresholds configured."
