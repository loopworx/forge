# securing-pipeline — Handoffs

## This skill has no pipeline outbound

`securing-pipeline` is a setup and maintenance skill, not a pipeline step.
Once gates are configured they run automatically on every push.

---

## When it is called

| Moment | Caller | Action |
|---|---|---|
| Iteration 0 begins | `bootstrapping-project` (concurrent) | Configure all security gates before first code push |
| New language or runtime introduced | architect-agent or devops-agent | Add appropriate scanner for the new surface |
| Recurring security failures | secops-agent | Tune thresholds; fix root cause; do not suppress |

---

## Completion signal

When gates are configured, post to Linear iteration milestone:
> "Security gates active: secret scanning, dependency scan, SAST[, DAST]. Blocking thresholds configured."

This signal is required before `bootstrapping-project` marks itself complete.
