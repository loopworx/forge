# facilitating-inception — Loop

The L2-GUIDED inception loop drives a new project through six mandatory
phases — Lean Canvas → Empathy Map → Trade-off Sliders → Event Storming →
Story Writing → Iteration Mapping. Each phase produces an artifact that
must be human-approved before the next phase opens. No skipping, no
combining.

## Entry Conditions

- Human triggers a new project (`"new project"`, `"let's start"`, etc.).
- `docs/inception.loop.md` exists with `current_phase: lean-canvas` (or
  the resume target phase).
- `guarding-loops` pre-flight has cleared (read of `docs/inception.loop.md`
  succeeded and `awaiting_human_gate` is `null`).
- po-agent is the owning role; ux-agent joins for Empathy Map and Event
  Storming phases.

## Loop State Schema

Read from `docs/inception.loop.md`:

- `current_phase` — one of: `lean-canvas`, `empathy-map`, `trade-off-sliders`,
  `event-storming`, `story-writing`, `iteration-mapping`, `complete`.
- `completed_artifacts` — list of artifact paths already approved
  (`docs/lean-canvas.md`, `docs/empathy-map.md`,
  `project.constraints.yaml`, `docs/event-storm.yaml`, `CONTEXT.md`,
  Linear iteration map).
- `pending_approvals` — artifacts submitted but not yet human-approved.
- `next_allowed_phase` — the phase the loop may advance to once the
  current artifact is approved.

## Single Iteration Step

1. Read `docs/inception.loop.md` and confirm `current_phase`.
2. Run the phase protocol for the current phase (see SKILL.md Phases 1–6).
3. Produce the phase artifact and submit for human approval (commit to
   repo or post on Linear).
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
transition in-analysis → in-analysis
  trigger Lean Canvas completed and human-approved
  handoff facilitating-inception to ux-agent

transition in-analysis → in-analysis
  trigger Empathy Map completed and human-approved
  handoff facilitating-inception to po-agent

transition in-analysis → in-analysis
  trigger Trade-off Sliders committed to project.constraints.yaml
  handoff facilitating-event-storming to po-agent

transition in-analysis → in-analysis
  trigger Event Storming complete and CONTEXT.md committed
  handoff writing-stories to po-agent

transition in-analysis → in-analysis
  trigger all stories pass four-gate review
  handoff building-iteration-map to po-agent
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
- Event Storming (Phase 4) complete → `establishing-ubiquitous-language`
  for Phase 6 of event storming, then `writing-stories` (Phase 5).
- Story Writing (Phase 5) complete → `building-iteration-map` (Phase 6).
- Iteration Mapping (Phase 6) approved → inception is `complete`; the
  board opens Iteration 0 and `bootstrapping-project` (devops-agent)
  becomes the next active loop.
