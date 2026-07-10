# modeling-threats — Loop

The L2-GUIDED modeling-threats loop. Injects security acceptance criteria
into stories before development begins. Reviews the story for abuse
paths, trust boundaries, sensitive data handling, and misuse cases.
Security is added as visible ACs, not hidden as a separate checklist
nobody reads.

## Entry Conditions

- Triggered by one of: a new story is drafted; a new integration is
  introduced; an auth / payment / PII / permissions change is detected
  during `writing-stories` Gate 2 or Gate 3.
- The story exists in Linear with status `in-analysis`.
- `project.constraints.yaml` is readable (priority `security` is
  known).
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Per-story loop state held in `stories/[STORY-ID].loop.md` (when created)
and Linear:

- `security_acs_injected` — list of AC IDs added by this loop.
- `ambiguities_open` — list of unresolved security ambiguities.
- `parent_story_state` — `in-analysis` (during modeling),
  `in-analysis` (on success — story returns to gate flow),
  `in-analysis` (on unsafe — story returns for re-evaluation).
- `secops_signoff` — boolean.

## Single Iteration Step

1. Read the story (Linear + empathy map reference) and identify:
   - What data is sensitive here?
   - What identity or permission boundary is crossed?
   - What happens if the user tampers with input?
   - What happens if an attacker repeats / automates / replays this
     action?
   - What audit trail is required?
2. Add explicit security ACs to the story, e.g.:
   - Unauthorized users see an access-denied state.
   - Invalid input shows safe validation, not stack traces.
   - Sensitive fields are masked where required.
   - Rate-limited actions give a safe customer-visible response.
3. Update the story in Linear with the security ACs; notify po-agent.
4. If the story cannot be made safe within scope → return it to
   `in-analysis` and re-evaluate.
5. Exit the loop; the story proceeds through `writing-stories` Gate 4
   (QA gate) with the new ACs.

## Proof of Progress

- At least one security AC was added (or the story was returned with
  a documented reason).
- The story snapshot at `stories/[STORY-ID].loop.md` records the
  injected ACs and `secops_signoff`.
- A Linear comment from secops-agent references the new ACs (or the
  unsafe-return reason).

## State Transition Rule

transition in-analysis → in-analysis
  trigger security ACs injected into story
  handoff writing-stories to po-agent

transition in-analysis → in-analysis
  trigger story cannot be made safe within current scope
  handoff writing-stories to po-agent

## Halt Conditions

- Sensitive data is identified but cannot be made safe within scope →
  halt; return story to `in-analysis` for re-evaluation.
- Trust boundary is unclear (no ADR exists) → halt; route to
  `deciding-architecture` for an ADR before continuing.
- `project.constraints.yaml` priority `security` is missing → halt;
  route to `facilitating-inception` Phase 3 to set the slider.
- A `guarding-loops` `halted-*` report → stop; do not modify the story.
- Audit-trail requirement contradicts an existing AC → halt; raise
  conflict to po-agent.

## Handoff Target

- Security ACs injected → `writing-stories` Gate 4 (qa-agent); the
  story continues through the normal gate flow.
- Story cannot be made safe → po-agent re-evaluates in `in-analysis`;
  potentially routes back to Gate 1 (`writing-stories`).
- Missing ADR for trust boundary → `deciding-architecture`
  (architect-agent) for an ADR before the story returns here.
