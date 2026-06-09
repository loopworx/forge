---
name: approving-stories
level: L3-MECH
owner: po-agent
trigger: story enters `in-acceptance`
---

# approving-stories

## Description

The po-agent verifies that the delivered story matches the original story intent and every acceptance criterion. This is not exploratory testing and not a design discussion. The question is simple: does the shipped behavior satisfy the agreed story, yes or no?

---

## Protocol

1. Read the story in Linear and the locked snapshot in `stories/[STORY-ID].md`
2. Read linked empathy map reference
3. Verify each AC through the UI on the test environment
4. Confirm desk checks and regression suite already passed
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
