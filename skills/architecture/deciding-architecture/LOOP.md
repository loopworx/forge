# deciding-architecture — Loop

The L2-GUIDED architecture-decision loop. Writes Architecture Decision
Records (ADRs) for stories that need architectural clarity before
development begins. Defines service boundaries, integration contracts,
storage decisions, and key trade-offs. ADRs capture decisions, not
implementation detail.

## Entry Conditions

- Triggered by one of: Iteration 0 / Iteration 1 prep, a developer-agent
  posting `"Architecture decision needed"` on a Linear story, an event
  storming session revealing a new bounded context, or a story that would
  otherwise require speculative design during implementation.
- `CONTEXT.md` and `project.constraints.yaml` are readable.
- `loop-guardian` pre-flight has cleared.

## Loop State Schema

Local file state plus Linear:

- `adr_drafts_in_progress` — list of `docs/adr/ADR-XXX-[slug].md` paths
  not yet accepted.
- `adrs_accepted` — list of accepted ADR IDs.
- `pending_decisions` — Linear story IDs awaiting an ADR.
- `priorities` — copied from `project.constraints.yaml`
  (`quality`, `security`, `ux`, `cost`).

## Single Iteration Step

1. Define the forcing function in one sentence: `"We need a decision
   about [X] because story [STORY-ID] cannot proceed without it."`
2. Enumerate 2–4 realistic options. For each: boundary ownership, data
   flow, failure mode, operational cost, security implications.
3. Check `project.constraints.yaml` priorities. The higher-ranked
   dimension wins when options trade off (e.g., quality over cost,
   security over ux).
4. Write the ADR (`docs/adr/ADR-XXX-[slug].md`) with Status: Proposed,
   Context, Decision, Consequences, Alternatives Considered, Story
   Impact.
5. Commit the ADR; set Status: Accepted.
6. Post to Linear: `"ADR accepted: ADR-XXX [title]. Stories [IDs] may
   proceed."`
7. Move the affected story out of `in-dev` block; if the ADR changes
   scope of an already-accepted story, return it to `in-analysis`.

## Proof of Progress

- One ADR was committed with Status: Accepted and a timestamp.
- The Linear comment on the affected story references the ADR ID.
- If the ADR changes scope: the story's Linear state was moved back to
  `in-analysis`.

## State Transition Rule

- An `in-dev` story blocked on architecture decision stays in `in-dev`
  (paused) until the ADR is Accepted.
- An `in-analysis` story touched by an ADR stays in `in-analysis` until
  the next gate review or refinement.
- An accepted story that has its scope changed by an ADR → `in-analysis`
  for re-evaluation by po-agent.
- ADR draft (Status: Proposed) → ADR accepted (Status: Accepted) →
  stories resume their previous state (or move to `in-analysis` if
  scope changed).

## Halt Conditions

- The forcing function cannot be stated in one sentence → halt; the
  problem is not yet crisp enough.
- `project.constraints.yaml` priorities are missing or contradictory →
  halt; route back to `facilitating-inception` Phase 3.
- A `loop-guardian` `halted-*` report → stop; do not modify ADRs.
- Two options are equivalent under the priorities → halt; raise to
  human for the final word.

## Handoff Target

- ADR accepted, no scope change → unblocks the calling developer-agent
  who resumes `running-atdd-sessions` (developer-agent).
- ADR changes scope → affected story returns to `in-analysis`;
  `writing-stories` (po-agent) re-evaluates the ACs.
- Multiple stories depend on the ADR → loop continues until all
  dependent stories are unblocked or routed.
