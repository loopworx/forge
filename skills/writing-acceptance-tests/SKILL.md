---
name: writing-acceptance-tests
level: L2-GUIDED
owner: qa-agent
trigger: story enters `in-dev`; AC exists and is UI-testable
metadata:
  category: quality
description: Writes the outer acceptance test for each AC so the developer can drive it to RED before implementation
---

# writing-acceptance-tests

## Description

Writes outer Acceptance Tests from acceptance criteria. These tests define done from the user's perspective and are the first executable artifact for a story. They use only the UI or other customer-visible surfaces. No backdoors, no database verification, no direct API assertions. The core feedback loop is: write test → verify it is RED → if not RED, fix test → repeat until RED.

---

---

## Test Shape

Use Given / When / Then language in test names and comments.

Example:
```text
Given a logged-in customer
When they submit the order form
Then they see an order acknowledgment with an order number
```

---

## What You May Assert

- Text visible on screen
- Button enabled/disabled state
- Navigation or route changes visible to the user
- Download started or file visible in UI
- Email preview UI, if part of product UI

## What You May Not Assert

- Database row exists
- API returned 200 directly
- Internal Redux/Vuex state
- Internal logs
- Feature flag platform internals

---

## On Completion

Commit the Acceptance Test and post to Linear:
> "Outer Acceptance Test for AC-[N] written and verified RED."

## State Model

This skill writes the outer Acceptance Test for a story AC.

- Story AC exists and is UI-testable
- Test state: draft → RED
- `in-dev` — developer-agent picks up the RED outer AT
- `in-analysis` — return destination if an AC is not UI-testable

## Rules

1. One AC must map to at least one executable Acceptance Test.
2. Assertions must be customer-visible through the UI or other customer-visible surfaces.
3. If an AC is not testable through the UI, return the story to `in-analysis`.
4. Acceptance Tests must be written before implementation begins.
5. Use Given / When / Then language in test names and comments.
