# facilitating-inception — Loop

The L2-GUIDED inception loop drives a new project through eight mandatory
phases — Lean Canvas → Empathy Map → Trade-off Sliders → Event Storming →
UX/UI Design → Story Writing → Tech Stack + Architecture → Iteration
Mapping. Each phase produces an artifact that must be committed before the
next phase opens. No skipping, no combining.

## Entry Conditions

- Human triggers a new project (`/forge new project`).
- `docs/inception.loop.md` exists with `current_phase: 1` (or the resume
  target phase).
- `guarding-loops` pre-flight has cleared.
- po-agent is the owning role; ux-agent joins for Empathy Map, Event
  Storming, and UX/UI Design phases; architect-agent joins for Tech Stack
  + Architecture.

## Loop State Schema

Read from `docs/inception.loop.md`:

- `current_phase` — integer 1–8, or `complete`.
- `completed_artifacts` — list of artifact paths already approved
  (`docs/lean-canvas.md`, `docs/empathy-map.md`,
  `project.constraints.yaml`, `docs/event-storm.yaml`, `CONTEXT.md`,
  `design-system/MASTER.md`, stories in Linear, ADR-001, ADR-002,
  Linear iteration map).
- `pending_approvals` — artifacts submitted but not yet human-approved.
- `next_allowed_phase` — the phase the loop may advance to once the
  current artifact is approved.

## Single Iteration Step

1. Read `docs/inception.loop.md` and confirm `current_phase`.
2. Run the phase protocol for the current phase (see SKILL.md Phases 1–8).
3. Produce the phase artifact and commit to repo or post on Linear.
4. Update `docs/inception.loop.md`: append artifact to `completed_artifacts`
   and to `pending_approvals`.
5. On human approval → advance `current_phase` and `next_allowed_phase`,
   remove the artifact from `pending_approvals`.
6. Loop back to Step 1 with the next phase, or exit when `current_phase`
   becomes `complete`.

## Proof of Progress

- The phase artifact exists at the expected path and is committed.
- `docs/inception.loop.md` `completed_artifacts` includes the artifact
  path AND `pending_approvals` no longer contains it.
- A human approval signal was recorded (commit message referencing human
  approval, or a Linear comment from a human reviewer).

## State Transition Rule

```
transition inception-phase-1 → inception-phase-2
  trigger Lean Canvas completed and human-approved
  handoff facilitating-inception to ux-agent

transition inception-phase-2 → inception-phase-3
  trigger Empathy Map completed and human-approved
  handoff facilitating-inception to po-agent

transition inception-phase-3 → inception-phase-4
  trigger Trade-off Sliders committed to project.constraints.yaml
  handoff facilitating-event-storming to po-agent

transition inception-phase-4 → inception-phase-5
  trigger Event Storming complete and CONTEXT.md committed
  handoff designing-ux to ux-agent

transition inception-phase-5 → inception-phase-6
  trigger design-system/MASTER.md committed (or API-only confirmed)
  handoff writing-stories to po-agent

transition inception-phase-6 → inception-phase-7
  trigger all stories pass four-gate review and are in ready-for-dev
  handoff selecting-tech-stack to architect-agent

transition inception-phase-7 → inception-phase-8
  trigger ADR-001 and ADR-002 committed
  handoff building-iteration-map to po-agent

transition inception-phase-8 → development
  trigger iteration map committed to Linear + Iteration 0 Cycle active
  handoff bootstrapping-project to devops-agent
```

## Halt Conditions

- Human declines an artifact → halt the loop; the agent does not advance
  the phase until the human re-approves a corrected artifact.
- A `guarding-loops` `halted-*` report → stop; do not modify
  `docs/inception.loop.md`.
- `awaiting_human_gate` is set → idle until the human gate is cleared.
- An ambiguity (red hotspot from event storming) remains unresolved
  before story writing → halt stall; route to
  `establishing-ubiquitous-language` and back.
- A term is needed that is not in `CONTEXT.md` → halt; update CONTEXT.md
  before continuing.

## Handoff Target

- Lean Canvas (Phase 1) approved → ux-agent for Empathy Map (Phase 2).
- Empathy Map (Phase 2) approved → po-agent for Trade-off Sliders
  (Phase 3).
- Trade-off Sliders (Phase 3) committed → po-agent + ux-agent for
  `facilitating-event-storming` (Phase 4).
- Event Storming (Phase 4) complete → `designing-ux` (Phase 5).
- UX/UI Design (Phase 5) complete → `writing-stories` (Phase 6).
- Story Writing (Phase 6) complete → `selecting-tech-stack` (Phase 7).
- Tech Stack + Architecture (Phase 7) complete → `building-iteration-map`
  (Phase 8).
- Iteration Mapping (Phase 8) approved → inception is `complete`; the
  plugin transitions to development mode and `bootstrapping-project`
  (devops-agent) becomes the next active loop for Iteration 0.
