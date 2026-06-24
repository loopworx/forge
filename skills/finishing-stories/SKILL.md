---
name: finishing-stories
level: L3-MECH
owner: po-agent, devops-agent
trigger: story enters `ready-to-deploy` and human approves release
metadata:
  category: acceptance-delivery
description: Runs smoke tests against production, flips feature flags, and retires flags after the soak period
---

# finishing-stories

## Description

Completes the final mechanical steps to ship an accepted story: verify deployment state, flip the feature flag, verify the feature is live, update Linear, and close the story. This skill begins only after human approval.

---

## Preconditions

- Story is in `ready-to-deploy`
- PO acceptance passed
- Human explicitly approved release
- Feature flag exists

---

## Protocol

1. Verify production deployment contains the code
2. Verify feature flag is OFF in production
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

## State Model

This skill transitions an accepted story to shipped via controlled feature flag enablement.

- `ready-to-deploy` — accepted story awaiting human release approval
- `done` — shipped story after successful smoke test
- `ready-for-dev` — story returned to development after failed smoke test

## Rules

1. Begin only after human explicitly approves release.
2. Verify production deployment contains the code before flipping the flag.
3. Flip the feature flag ON only after go-live approval.
4. Smoke test production through the UI immediately after flag flip.
5. On smoke test failure, flip the flag OFF immediately, post an incident note, and return the story to `ready-for-dev`.
6. Post a ship note with timestamp and flag name on success.
