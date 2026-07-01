---
name: writing-stories
level: L2-GUIDED
owner: po-agent
trigger: Phase 5 of facilitating-inception; or when po-agent is asked to write a story
metadata:
  category: discovery
description: Writes and refines user stories through the four-gate review process before they enter the iteration
---

# writing-stories

## Description

Writes INVEST-compliant user stories from event storming story candidates, puts them through a four-gate review, and writes them in Linear. A story that fails any gate goes back to the PO — it does not proceed. A story that passes all four gates is written in Linear with status `in-analysis`. The explicit feedback loop is: write story → gate review → if fail, fix → repeat until all gates pass.

---

## Story Format

```
As a [specific persona from empathy map],
I want to [action],
So that [customer value — traces to a Pain or Gain in the empathy map].

Acceptance Criteria:
  AC-1: Given [context], when [action], then [observable UI outcome]
  AC-2: Given [context], when [action], then [observable UI outcome]
  ...

Feature flag: [feature-flag-name]
Empathy map reference: [Pain/Gain ID from docs/empathy-map.md]
```

---

## INVEST Checklist

Every story must pass before gate review:
- [ ] **I**ndependent — deliverable without depending on an unfinished story
- [ ] **N**egotiable — ACs describe outcomes, not implementation
- [ ] **V**aluable — customer value is explicit and traces to empathy map
- [ ] **E**stimable — developer agent can assess feasibility
- [ ] **S**mall — completable in a single ATDD session (≤5 ACs; if more, split)
- [ ] **T**estable — every AC is testable through the UI alone, as an outside customer would test

---

## The Four-Gate Review

### Gate 1 — PO Draft
po-agent writes the story. Checks INVEST. If INVEST fails, rewrites before proceeding.

### Gate 2 — UX Gate
ux-agent reviews:
- Does this trace to a real customer pain in the empathy map?
- Is the persona specific enough?
- Are the ACs from the customer's perspective, not the developer's?

Fail condition: story does not trace to empathy map → back to Gate 1.

### Gate 3 — Developer Gate
developer-agent (or architect-agent) reviews:
- Is this technically feasible?
- Does implementing this require an ADR that doesn't exist yet?
- Are there hidden dependencies not captured in the iteration map?
- Rough AC count — if >5, flag for splitting.

Fail condition: infeasible or needs unwritten ADR → back to Gate 1.

### Gate 4 — QA Gate
qa-agent reviews every AC:
- Is this testable through the UI alone? No database queries, no API calls, no internal state inspection.
- Is the "then" clause observable by an outside user?
- Is the Given/When/Then specific enough to write a Playwright test?

Fail condition: any AC not UI-testable → back to Gate 1.

---

## On Pass: Write in Linear

```
1. Write story in Linear with status `in-analysis`
2. Assign to current iteration's Project
3. Add ACs as sub-issues (one per AC)
4. Set feature flag name as a Linear property
5. Link empathy map reference in description
6. Commit story snapshot to stories/[STORY-ID].md
```

The story snapshot in the repo is committed at `ready-for-dev` (when the story is locked).
Before that, Linear is the source of truth.

## State Model

This skill moves story candidates through four human-gated reviews.

- Story candidate — raw input from event storming
- Gate 1 (PO Draft) → Gate 2 (UX) → Gate 3 (Developer) → Gate 4 (QA)
- Gate failure → back to Gate 1
- `in-analysis` — story written in Linear after all gates pass and threat modeling handled


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Every story must be INVEST-compliant before gate review.
2. ACs must use Given / When / Then and be testable through the UI alone.
3. Stories must trace to a Pain or Gain in the empathy map.
4. Any gate failure returns the story to Gate 1 for rewrite.
5. Split stories with more than five ACs.
6. After gates pass, route to `modeling-threats` if the story touches auth, payments, PII, or permissions.
7. Only write the story in Linear with status `in-analysis` after all gates and threat modeling are complete.
