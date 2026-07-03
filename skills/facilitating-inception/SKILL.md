---
name: facilitating-inception
level: L2-GUIDED
owner: po-agent, ux-agent, architect-agent
trigger: new project start; human says "let's start" or "new project"; /forge new project
metadata:
  category: discovery
description: Facilitates a new project inception from Lean Canvas through iteration mapping (8 phases)
---

# facilitating-inception

## Description

Facilitates the full inception process for a new project across 8 sequential phases: Lean Canvas, Empathy Mapping, Trade-off Sliders, Event Storming, UX/UI Design, Story Writing, Tech Stack + Architecture, and Iteration Mapping. Each phase produces a mandatory artifact before the next phase opens. Do not skip phases. Do not combine phases.

## CRITICAL: Plugin–Agent Boundary

**The Forge plugin handles ALL infrastructure. Your session was created by the plugin.** Before your session started, the plugin already:
- Discovered and selected the correct Linear team
- Created or verified all 14 Forge workflow states in Linear
- Created this session with the correct agent role
- Routed you to the correct inception phase

**Your job is ONE phase.** Read the phase matching your session title (e.g., "Inception Phase 1 — Lean Canvas"). Execute only that phase. Produce its one artifact. Seek human approval. End your session. The plugin creates the next session.

**Never do any of the following** — these are the plugin's job, not yours:
- Discover or select a Linear team
- Create or verify Linear workflow states (in-analysis, ready-for-dev, in-dev, ready-for-qa, in-qa, ready-for-acceptance, in-acceptance, ready-to-deploy, done, halted-*)
- Create new sessions for subsequent phases
- Chain multiple inception phases in one session
- Read or modify `.forge/` directory files (sessions.json, project-state.json)
- Read plugin source code (forge.js, plugin.ts, mcp-client.ts) to understand infrastructure

If you need a Linear operation that the plugin doesn't expose (e.g., creating issues during Phase 6), use the Linear MCP tools directly — but ONLY for content operations, never infrastructure.

Inception ends when the iteration map is committed to Linear and CONTEXT.md is in the repo root. The plugin transitions to development mode automatically.

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

### Phase 5 — UX/UI Design
**Owner:** ux-agent  
**Output:** `design-system/MASTER.md`

See `designing-ux` skill. Transforms event storm UI stickies and empathy map emotions into a concrete design system: colors, typography, spacing, component patterns, interaction states, and accessibility rules.

If the project has no UI (API-only), skip this phase and note it in the inception log.

Do not move to Phase 6 until `design-system/MASTER.md` is committed (or the project is confirmed API-only).

---

### Phase 6 — Story Writing
**Owner:** po-agent  
**Output:** Stories in Linear (`ready-for-dev` status)

See `writing-stories` skill.
For each UI sticky from the event storm, produce one user story.
All stories must pass the four-gate review before moving to `ready-for-dev`.

---

### Phase 7 — Tech Stack + Architecture
**Owner:** architect-agent  
**Output:** `docs/adr/ADR-001-platform.md`, `docs/adr/ADR-002-code-architecture.md`

Two ADRs produced in sequence in the same session:

1. **`selecting-tech-stack`** — Produces ADR-001: cloud provider, backend language/framework, frontend framework, database, CI/CD, observability, secret management.
2. **`establishing-architecture`** — Produces ADR-002: service boundaries, module structure, folder layout, integration patterns, data flow, testing strategy.

Both ADRs must be committed before Phase 8 begins.

---

### Phase 8 — Iteration Mapping
**Owner:** po-agent  
**Output:** Linear Projects (one per iteration) + active Cycle for Iteration 0

See `building-iteration-map` skill.
Inception is complete when:
- Linear Projects are produced for all iterations
- Iteration 0 Cycle is active
- Human has confirmed the iteration map

---

## State Model

This skill progresses a new project through 8 inception phases.

- `inception-phase-1` — Lean Canvas (po-agent) → `docs/lean-canvas.md`
- `inception-phase-2` — Empathy Mapping (ux-agent) → `docs/empathy-map.md`
- `inception-phase-3` — Trade-off Sliders (po-agent) → `project.constraints.yaml`
- `inception-phase-4` — Event Storming (po-agent, ux-agent) → `docs/event-storm.yaml` + `CONTEXT.md`
- `inception-phase-5` — UX/UI Design (ux-agent) → `design-system/MASTER.md`
- `inception-phase-6` — Story Writing (po-agent) → Stories in Linear (`ready-for-dev`)
- `inception-phase-7` — Tech Stack + Architecture (architect-agent) → `docs/adr/ADR-001-platform.md` + `docs/adr/ADR-002-code-architecture.md`
- `inception-phase-8` — Iteration Mapping (po-agent) → Linear Projects + Cycles
- `development-mode` — inception complete, plugin transitions to polling mode

For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Do not skip phases and do not combine phases.
2. Each phase requires human approval of its artifact before the next phase opens (except Phase 7 which is architect-driven).
3. Every user story produced later must trace to a Pain or Gain in the empathy map.
4. Trade-off sliders must be ranked with no ties and written to `project.constraints.yaml`.
5. Event storming must be complete before producing stories or design systems.
6. The design system (Phase 5) must exist before stories are written (Phase 6) — every UI story references it.
7. The tech stack ADR (ADR-001) must be accepted before the code architecture ADR (ADR-002).
8. Inception ends when the iteration map is committed to Linear and `CONTEXT.md` is in the repo root.
