# writing-stories — Loop

The L2-GUIDED story-writing loop. Converts event-storm story candidates
into INVEST-compliant user stories, runs them through a four-gate review
(PO Draft → UX → Developer → QA), and creates them in Linear as
`in-analysis`. A story that fails any gate goes back to Gate 1 — it does
not proceed.

## Entry Conditions

- `docs/event-storm.yaml` exists with `story_candidates` populated.
- `CONTEXT.md` is committed and human-approved.
- po-agent owns the loop; ux-agent, developer-agent, and qa-agent join
  for Gates 2, 3, 4 respectively.
- `loop-guardian` pre-flight has cleared (read of
  `docs/inception.loop.md` succeeded and `awaiting_human_gate` is `null`).
- `docs/inception.loop.md` `current_phase` is `story-writing`.

## Loop State Schema

Read from `docs/inception.loop.md` and Linear:

- `current_phase` — `story-writing` (Phase 5 of inception).
- `candidates_total` — count of pink stickies from `docs/event-storm.yaml`.
- `stories_drafted` — count of stories that passed Gate 1.
- `stories_passed_gate_2`, `stories_passed_gate_3`, `stories_passed_gate_4`
  — counts per gate.
- `stories_failed_current_gate` — list of `[STORY-ID]` currently failing.
- `stories_created_in_analysis` — Linear `in-analysis` count.
- `pending_security_review` — list of stories routed to
  `threat-modeling` before `ready-for-dev`.

## Single Iteration Step

1. Pull the next unprocessed story candidate from
   `docs/event-storm.yaml` `story_candidates`.
2. **Gate 1 — PO Draft.** po-agent writes the story (As a / I want / So
   that). Apply INVEST checklist. If INVEST fails → rewrite before
   proceeding.
3. **Gate 2 — UX Gate.** ux-agent reviews: does it trace to a real
   customer pain in `docs/empathy-map.md`? Persona specific? ACs from
   customer's perspective? Fail → back to Gate 1.
4. **Gate 3 — Developer Gate.** developer-agent or architect-agent
   reviews: feasible? Requires new ADR? Hidden dependencies? AC count
   ≤ 5? Fail → back to Gate 1 (possibly via `deciding-architecture` for
   the ADR).
5. **Gate 4 — QA Gate.** qa-agent reviews: every AC testable through
   UI alone? Given/When/Then specific enough for Playwright? Fail →
   back to Gate 1.
6. If the story touches auth, payments, PII, or permissions → route to
   `threat-modeling` (secops-agent) to inject security ACs before
   returning to Gate 4.
7. On all four gates passing → create story in Linear as `in-analysis`,
   assign to current iteration's Project, add ACs as sub-issues, set
   feature flag property, link empathy map reference.
8. Commit story snapshot to `stories/[STORY-ID].md`.
9. Loop back to Step 1 for the next candidate; exit when all candidates
   processed.

## Proof of Progress

- One story was either (a) advanced to the next gate, (b) sent back to
  Gate 1 with the failing gate recorded, (c) routed to
  `threat-modeling`, or (d) created in Linear as `in-analysis`.
- `stories_created_in_analysis` incremented by one for each
  pass-through outcome.
- Each created story has a `stories/[STORY-ID].md` snapshot committed.

## State Transition Rule

```
candidate (unprocessed)
  └→ Gate 1 pass → drafted
       └→ Gate 2 pass → gate_2_passed
            └→ Gate 3 pass → gate_3_passed
                 └→ (security surface?) → yes → threat-modeling → Gate 4
                                          → no  → Gate 4
                      └→ Gate 4 pass → in-analysis (Linear)
```

A story moves backwards only to Gate 1 (not to the immediately preceding
gate). Stories in `in-analysis` may flow into `building-iteration-map`.

## Halt Conditions

- Any gate fails and Gate 1 cannot produce a fix → halt; route to
  po-agent for human review of the underlying ambiguity.
- A `loop-guardian` `halted-*` report → stop; do not modify Linear.
- `awaiting_human_gate` is set → idle.
- Story has >5 ACs and cannot be split → halt; route to po-agent.
- Threat modeling returns "story cannot be made safe within scope" →
  halt; move story to `in-analysis` and re-evaluate.

## Handoff Target

- All four gates passed, no security surface → `building-iteration-map`
  (po-agent).
- Security surface detected → `threat-modeling` (secops-agent) for
  security AC injection; returns to Gate 4.
- Architecture decision needed → `deciding-architecture`
  (architect-agent) for ADR; returns to Gate 3.
- Mid-project update: undefined term encountered → route to
  `establishing-ubiquitous-language`; resume after `CONTEXT.md`
  update.
