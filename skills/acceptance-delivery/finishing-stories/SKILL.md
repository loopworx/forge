---
name: finishing-stories
level: L3-MECH
owner: po-agent, devops-agent
trigger: story enters `ready-to-deploy` and human approves release
---

# finishing-stories

## Description

Completes the final mechanical steps to ship an accepted story: verify deployment state, flip the feature flag, confirm the feature is live, update Linear, and close the story. This skill begins only after human approval.

---

## Preconditions

- Story is in `ready-to-deploy`
- PO acceptance passed
- Human explicitly approved release
- Feature flag exists

---

## Protocol

1. Confirm production deployment contains the code
2. Confirm feature flag is OFF in production
3. Human approves go-live
4. Flip feature flag ON
5. Smoke test production through the UI
6. Update Linear story → `done`
7. Post ship note with timestamp and flag name

---

## Fail path

If smoke test fails after flag flip:
1. Flip flag OFF immediately
2. Post incident note in Linear
3. Return story to `ready-for-dev`
4. Do not retry until human review
