# establishing-ubiquitous-language — Loop

The L2-GUIDED ubiquitous-language loop. Generates and maintains
`CONTEXT.md` — the project's shared domain vocabulary. Runs as the final
phase of every event storming session, and may also be triggered
mid-project when any agent encounters an undefined term.

## Entry Conditions

- Phase 6 of `facilitating-event-storming` is the current phase (initial
  generation), OR an agent has flagged an undefined term in a Linear
  comment (`"CONTEXT.md update needed: ..."`).
- `docs/event-storm.yaml` exists and contains the aggregates, events,
  commands, and policies.
- `loop-guardian` pre-flight has cleared (read of
  `docs/inception.loop.md` succeeded and `awaiting_human_gate` is `null`).

## Loop State Schema

Read from `CONTEXT.md` and `docs/inception.loop.md`:

- `aggregate_count` — number of aggregates whose canonical name is defined.
- `ambiguities_open` — number of unresolved red hotspots in
  `CONTEXT.md`'s Flagged Ambiguities section.
- `terms_pending_approval` — terms proposed but not yet human-approved.
- `current_phase` (inception state) — must be `event-storming` (Phase 6)
  during generation, or any phase during mid-project updates.

## Single Iteration Step

1. Read `docs/event-storm.yaml` aggregates and key events/commands.
2. For each aggregate: confirm canonical name, list avoided synonyms,
   document in `CONTEXT.md` Domain Language section.
3. For each key event/command: confirm verb form (past tense for events,
   imperative for commands); check for collisions; document.
4. For each unresolved red hotspot: present to the human; resolve;
   document in `CONTEXT.md` Flagged Ambiguities section with resolution.
5. Commit `CONTEXT.md`.
6. On human approval → mark all entries as resolved; advance
   `docs/inception.loop.md` (for end-of-storming) or post the updated
   `CONTEXT.md` to the originating story (for mid-project).

## Proof of Progress

- `CONTEXT.md` was updated and committed with at least one new term or
  ambiguity resolution.
- `docs/inception.loop.md` `completed_artifacts` includes `CONTEXT.md`
  after a generation iteration.
- For mid-project updates: a Linear comment posted on the originating
  story references the new `CONTEXT.md` commit hash.

## State Transition Rule

- During event-storm Phase 6: state remains `event-storming` until every
  aggregate is named, every key verb form is canonical, and every red
  hotspot is resolved. On full resolution → `event-storming` →
  `story-writing` in `docs/inception.loop.md`.
- During mid-project updates: state remains whatever phase the calling
  agent is in. The loop does not change Linear story state — it only
  mutates `CONTEXT.md` and posts a comment.

## Halt Conditions

- The human cannot agree on a canonical name → halt; route back to event
  storming to clarify the aggregate boundary.
- A `loop-guardian` `halted-*` report → stop; do not modify
  `CONTEXT.md`.
- `awaiting_human_gate` is set → idle until cleared.
- Two agents use the same word for different things (collision
  detected) → halt the loop; resolve with the human before continuing.
- A term is invented mid-project without going through this loop → the
  calling agent is sent back to use the canonical term; the term may be
  added only via this loop.

## Handoff Target

- Generation iteration complete → return to `facilitating-event-storming`
  Phase 6 → then `writing-stories` (po-agent).
- Mid-project update complete → return control to the calling agent
  (any role); they may now use the new term.
- Ambiguity cannot be resolved → return to `facilitating-event-storming`
  to re-clarify.
