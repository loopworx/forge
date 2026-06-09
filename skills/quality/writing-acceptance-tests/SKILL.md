---
name: writing-acceptance-tests
level: L2-GUIDED
owner: qa-agent
trigger: story enters `in-dev`; AC exists and is UI-testable
---

# writing-acceptance-tests

## Description

Writes outer Acceptance Tests from acceptance criteria. These tests define done from the user's perspective and are the first executable artifact for a story. They use only the UI or other customer-visible surfaces. No backdoors, no database checks, no direct API assertions.

---

## Rules

1. One AC must map to at least one executable Acceptance Test.
2. Assertions must be customer-visible.
3. If an AC is not testable through the UI, the AC is invalid — send story back to `in-analysis`.
4. Acceptance Tests are written before implementation.

---

## Test Shape

Use Given / When / Then language in test names and comments.

Example:
```text
Given a logged-in customer
When they submit the checkout form
Then they see an order confirmation with an order number
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
> "Outer Acceptance Test for AC-[N] written and confirmed RED."
