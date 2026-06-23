---
name: running-regression-suite
level: L2-GUIDED
owner: qa-agent
trigger: story moved to `in-qa`
---

# running-regression-suite

## Description

Runs the relevant regression suite for a story in `in-qa`. Verifies the accepted ACs for the story and checks for regressions in adjacent flows impacted by the change. This is broader than a desk check and narrower than "test everything forever".

---

## Scope Selection

For the current story, include:
- The story's own Acceptance Tests
- Adjacent flows sharing the same page or endpoint
- Previously shipped stories in the same bounded context
- Security-sensitive flows if the story touches auth, money, PII, or permissions

Do not run the entire universe unless risk warrants it.

---

## Protocol

1. Run story Acceptance Tests on test environment
2. Run selected adjacent regression tests
3. Capture failures with exact repro steps
4. If any fail, move story back to `ready-for-dev`
5. If all pass, move story to `ready-for-acceptance`

---

## Linear Comment Templates

**Pass**
> "Regression suite PASSED for [STORY-ID]. Moving to ready-for-acceptance."

**Fail**
> "Regression suite FAILED for [STORY-ID]. Returning to ready-for-dev. Failing flow: [flow]. Repro: [steps]."

## State Model

This skill moves an `in-qa` story to accepted or back to development.

- `in-qa` — story assigned to qa-agent for regression
- `ready-for-acceptance` — regression passed; awaiting PO acceptance
- `ready-for-dev` — regression failed; returned to development

## Rules

1. Run the story's own Acceptance Tests on the test environment.
2. Run selected adjacent regression tests for flows sharing pages, endpoints, or bounded contexts.
3. Add security-sensitive adjacent tests if the story touches auth, money, PII, or permissions.
4. Do not run the entire regression universe unless risk warrants it.
5. Move the story to `ready-for-acceptance` only if all selected tests pass.
6. On failure, move the story back to `ready-for-dev` with exact repro steps.
