---
name: approving-stories
level: L3-MECH
owner: po-agent
trigger: story enters `in-acceptance`
metadata:
  category: acceptance-delivery
description: Verifies the delivered story matches the original story intent and every acceptance criterion
---

# approving-stories

## Description

The po-agent verifies that the delivered story matches the original story intent and every acceptance criterion. This is not exploratory testing and not a design discussion. The question is simple: does the shipped behavior satisfy the agreed story, yes or no? The explicit feedback loop is: verify ACs → if fail, return to dev → re-verify after fix → repeat until all ACs pass.

---

## Protocol

1. Read the story in Linear and the locked snapshot in `stories/[STORY-ID].md`
2. Read linked empathy map reference
3. Verify each AC through the UI on the test environment
4. Verify the desk review and regression suite already passed
5. Decide:
   - PASS → move to `ready-to-deploy`
   - FAIL → move to `ready-for-dev`

---

## Pass criteria
- Every AC behaves exactly as written
- Customer value is present, not just technical completion
- No visible mismatch between UX expectation and implementation

## Fail criteria
- Any AC missing or altered
- UX contradicts the story intent
- Story solves a different problem than the one described

---

## Linear Comment Templates

**Pass**
> "PO acceptance PASSED for [STORY-ID]. Ready for deploy approval."

**Fail**
> "PO acceptance FAILED for [STORY-ID]. Reason: [reason]. Returning to ready-for-dev."

## State Model

This skill moves the story through the final acceptance gate.

- `in-acceptance` — story assigned to po-agent for PO acceptance
- `ready-to-deploy` — accepted story awaiting human release approval
- `ready-for-dev` — failed story returned to development


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

1. Read the story snapshot, Lean Canvas, and empathy map before deciding.
2. Verify every AC through the UI on the test environment.
3. Verify the desk review and regression suite passed before accepting.
4. Move to `ready-to-deploy` only if every AC behaves as written and customer value is present.
5. On failure, move the story back to `ready-for-dev` with specific reasons.
