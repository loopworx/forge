# facilitating-event-storming — Loop

The L2-GUIDED event storming loop. Facilitates an interactive session to
discover the domain model: domain events, commands, policies, aggregates,
UI stickies, and ubiquitous language. Six phases, each producing visible
artifacts. No story may be written until Phase 6 (Ubiquitous Language)
is committed.

## Entry Conditions

- Phase 4 of `facilitating-inception` is the current phase (or
  `facilitating-event-storming` is invoked directly).
- po-agent and ux-agent are present.
- `guarding-loops` pre-flight has cleared (read of
  `docs/inception.loop.md` succeeded and `awaiting_human_gate` is `null`).

## Loop State Schema

Read from `docs/inception.loop.md`:

- `current_phase` — must be `event-storming` (Phase 4 of inception).
- `completed_artifacts` — must already contain
  `docs/lean-canvas.md`, `docs/empathy-map.md`,
  `project.constraints.yaml`.

Local event-storm state (held in `docs/event-storm.yaml` draft and in
`docs/inception.loop.md` `completed_artifacts` / `pending_approvals`):

- `phase_1_done`, `phase_2_done`, `phase_3_done`, `phase_4_done`,
  `phase_5_done`, `phase_6_done` — booleans derived from artifacts.
- `orange_event_count`, `blue_command_count`, `purple_policy_count`,
  `yellow_aggregate_count`, `pink_ui_count`, `red_hotspot_count` —
  counters for sticky colours produced so far.
- `ambiguities_open` — number of unresolved red hotspots.

## Single Iteration Step

1. Read `docs/inception.loop.md` and confirm `current_phase: event-storming`.
2. Determine the next unfinished phase (1–6) from the loop-state file.
3. Run that phase:
   - Phase 1: chaotic exploration → capture orange / blue / red stickies.
   - Phase 2: enforce timeline (left → right).
   - Phase 3: add commands and actors (blue + yellow).
   - Phase 4: add policies (purple).
   - Phase 5: add UI / read models (pink) — each pink = one story candidate.
   - Phase 6: ubiquitous language → `CONTEXT.md`.
4. Persist the draft to `docs/event-storm.yaml` (and `CONTEXT.md` for
   Phase 6).
5. Surface the artifact for human review (commit + Linear comment).
6. Advance the loop-state file when the human approves.

## Proof of Progress

- `docs/event-storm.yaml` (or `CONTEXT.md`) was updated and committed.
- The loop-state file records the phase advancement (`completed_artifacts`
  includes the new artifact path; `pending_approvals` no longer does after
  human approval).
- Sticky counters in the event-storm YAML grew by at least one entry per
  phase iteration, except for re-entry iterations that only resolve
  hotspots.

## State Transition Rule

```
transition in-analysis → in-analysis
  trigger event storming phases 1-5 complete
  handoff establishing-ubiquitous-language to po-agent

transition in-analysis → in-analysis
  trigger CONTEXT.md committed and human-approved
  handoff writing-stories to po-agent
```

## Halt Conditions

- Any red hotspot (ambiguity) remains at end of Phase 5 → halt; route to
  `establishing-ubiquitous-language` to resolve it.
- Human declines the artifact → halt; do not advance phase until a
  corrected artifact is human-approved.
- A `guarding-loops` `halted-*` report → stop; do not modify the loop
  state.
- `awaiting_human_gate` is set → idle.
- Two agents disagree on the canonical name for an aggregate → halt the
  phase until the human decides.

## Handoff Target

- Phase 6 complete (`CONTEXT.md` committed and approved) →
  `writing-stories` (po-agent) to convert pink stickies into stories.
- If `CONTEXT.md` ambiguities need mid-project resolution →
  `establishing-ubiquitous-language` (po-agent) updates `CONTEXT.md` and
  returns control.
- After all six phases done → return to `facilitating-inception` Phase 5
  (Story Writing); inception advances to `story-writing`.
