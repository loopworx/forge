# selecting-tech-stack — Loop

The L2-GUIDED tech stack selection loop. Decides the concrete platform
for the project — cloud, languages, frameworks, databases, CI/CD,
observability, secrets. Produces `docs/adr/ADR-001-platform.md` as the
foundational architecture decision.

## Entry Conditions

- Inception Phase 7 is active (after story writing, before iteration
  mapping).
- Stories exist in Linear and have been reviewed.
- `docs/lean-canvas.md` and `project.constraints.yaml` exist.
- `docs/event-storm.yaml` exists with bounded contexts identified.
- `design-system/MASTER.md` exists (if UI project).
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Local file state:

- `constraints_read` — boolean.
- `story_patterns_analyzed` — counts of UI/API/integration/data stories.
- `bounded_contexts_identified` — list from event storm.
- `decisions_made` — list of section names completed.
- `priorities` — copied from `project.constraints.yaml`.

## Single Iteration Step

1. Read `project.constraints.yaml`. Record priority ranking.
2. Read stories from Linear. Categorize: UI, API, integration,
   data-heavy. Count each category.
3. Read `docs/event-storm.yaml`. Identify bounded contexts, command/
   query split, external integrations.
4. For each of the 7 sections (cloud, backend, frontend, database,
   CI/CD, observability, secrets):
   a. Filter options by priority ranking (cost → managed/serverless,
      quality → proven/typed, security → cloud-native, ux → SSR/fast).
   b. Cross-reference story patterns and event storm needs.
   c. Choose one option. Write what + why + alternatives rejected.
5. Write `docs/adr/ADR-001-platform.md` with all 7 sections.
6. Post summary to Linear on the inception story.

## Proof of Progress

- `docs/adr/ADR-001-platform.md` exists with all 7 sections.
- Every choice is concrete (provider name, framework name, version if
  relevant).
- Every choice has a justification tied to constraints or stories.
- At least 2 alternatives listed per section with rejection reasons.
- ADR status is "Accepted".

## State Transition Rule

```
transition inception-phase-6 → inception-phase-7
  trigger stories written in Linear
  handoff selecting-tech-stack to architect-agent

transition inception-phase-7 → inception-phase-7
  trigger tech stack ADR accepted
  handoff establishing-architecture to architect-agent (same session)

transition inception-phase-7 → inception-phase-8
  trigger both ADR-001 (platform) + ADR-002 (code architecture) committed
  handoff building-iteration-map to po-agent
```

## Halt Conditions

- `project.constraints.yaml` missing → halt; route back to Phase 3.
- No stories in Linear → halt; route back to Phase 6.
- `docs/event-storm.yaml` missing → halt; route back to Phase 4.
- A `guarding-loops` `halted-*` report → stop; do not write ADRs.
- Two cloud providers are equally ranked under constraints → halt;
  raise to human for the final word.

## Handoff Target

- Platform ADR accepted → `establishing-architecture` (architect-agent)
  continues in the same session to produce ADR-002 (code architecture).
- Both ADRs accepted → `building-iteration-map` (po-agent) begins
  Phase 8, mapping stories to iterations with the technology
  constraints in mind.
