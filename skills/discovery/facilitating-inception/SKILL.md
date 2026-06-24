---
name: facilitating-inception
level: L2-GUIDED
owner: po-agent, ux-agent
trigger: new project start; human says "let's start" or "new project"
description: Facilitates a new project inception from Lean Canvas through iteration mapping
---

# facilitating-inception

## Description

Facilitates the full inception process for a new project: Lean Canvas, Empathy Mapping, Trade-off Sliders, Event Storming, and Iteration Mapping. Each phase produces a mandatory artifact before the next phase opens. Do not skip phases. Do not combine phases. Inception ends when the iteration map is committed to Linear and CONTEXT.md is in the repo root.

---

## Phases

### Phase 1 — Lean Canvas
**Owner:** po-agent  
**Output:** `docs/lean-canvas.md`

Facilitate a conversation to fill in:
- Problem (top 3 customer problems)
- Customer segments (who has these problems)
- Unique value proposition (one sentence)
- Solution (top 3 features that solve the problems)
- Channels (how you reach customers)
- Revenue streams
- Cost structure
- Key metrics
- Unfair advantage

Do not move to Phase 2 until the human has reviewed and approved `docs/lean-canvas.md`.

---

### Phase 2 — Empathy Mapping
**Owner:** ux-agent  
**Output:** `docs/empathy-map.md`

For each customer segment identified in the Lean Canvas:
- **Says** — quotes and defining phrases
- **Thinks** — what they're thinking (may not say aloud)
- **Does** — actions and behaviours
- **Feels** — emotions, frustrations, aspirations
- **Pains** — frustrations, obstacles, risks
- **Gains** — wants, needs, success measures

Every user story produced later must trace to a Pain or Gain in this map.
Do not move to Phase 3 until the human has reviewed and approved `docs/empathy-map.md`.

---

### Phase 3 — Trade-off Sliders
**Owner:** po-agent  
**Output:** `project.constraints.yaml` (priorities section)

Ask the human to rank these four dimensions — no ties allowed:
- **Quality** — correctness, test coverage, no regressions
- **Security** — threat model compliance, no known vulnerabilities
- **UX** — user experience, accessibility, performance
- **Cost** — infrastructure cost, build time, agent token usage

Also ask:
- Max concurrent developer agents (default: 2)
- Feature flag platform (default: Unleash)

Produce `project.constraints.yaml` and commit to repo root.
Do not move to Phase 4 until committed and human-confirmed.

---

### Phase 4 — Event Storming
**Owner:** po-agent, ux-agent  
**Output:** `docs/event-storm.yaml`, `CONTEXT.md`

See `facilitating-event-storming` skill for the full phase protocol.
This phase ends when both artifacts are committed and human-approved.

---

### Phase 5 — Story Writing
**Owner:** po-agent  
**Output:** Stories in Linear (`in-analysis` status)

See `writing-stories` skill.
For each UI sticky from the event storm, produce one user story.
All stories must pass the four-gate review before moving to `in-analysis`.

---

### Phase 6 — Iteration Mapping
**Owner:** po-agent  
**Output:** Linear Projects (one per iteration) + active Cycle for Iteration 0

See `building-iteration-map` skill.
Inception is complete when:
- Linear Projects are produced for all iterations
- Iteration 0 Cycle is active
- Human has confirmed the iteration map

## State Model

This skill progresses a new project through inception phases.

- `in-analysis` — stories being refined in Phase 5
- Iteration 0 Cycle — active after Phase 6
- `docs/lean-canvas.md` — Phase 1 artifact
- `docs/empathy-map.md` — Phase 2 artifact
- `project.constraints.yaml` — Phase 3 artifact
- `docs/event-storm.yaml` + `CONTEXT.md` — Phase 4 artifacts
- Linear Projects per iteration — Phase 6 artifacts

## Rules

1. Do not skip phases and do not combine phases.
2. Each phase requires human approval of its artifact before the next phase opens.
3. Every user story produced later must trace to a Pain or Gain in the empathy map.
4. Trade-off sliders must be ranked with no ties and written to `project.constraints.yaml`.
5. Event storming must be complete before producing stories.
6. Inception ends when the iteration map is committed to Linear and `CONTEXT.md` is in the repo root.
