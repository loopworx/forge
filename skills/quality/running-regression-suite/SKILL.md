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
