# finishing-stories — Loop

The L3-MECH release loop. Completes the final mechanical steps to ship
an accepted story: verify deployment state, flip the feature flag,
confirm the feature is live, update Linear, and close the story. This
skill begins only after human approval.

## Entry Conditions

- A story is in `ready-to-deploy`.
- PO acceptance PASSED (story moved here from `in-acceptance`).
- Human explicitly approved release.
- Feature flag exists (created when the story entered `in-dev`).
- Production deployment contains the story's code; flag is OFF in
  production.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Per-story loop state held in `stories/[STORY-ID].loop.md` and the
feature-flag platform:

- `feature_flag_state_prod` — `off` | `on`.
- `prod_deployment_verified` — boolean.
- `human_approval_ts` — timestamp of human go-live approval.
- `smoke_test_result` — `pass` | `fail` | `pending`.
- `ship_note_posted` — boolean.
- `final_linear_state` — `done` (on PASS) or `ready-for-dev` (on FAIL).

## Single Iteration Step

1. Confirm production deployment contains the code
   (`prod_deployment_verified = true`).
2. Confirm feature flag is OFF in production
   (`feature_flag_state_prod = off`).
3. Wait for human to explicitly approve go-live
   (`human_approval_ts` is set).
4. Flip feature flag ON in production
   (`feature_flag_state_prod = on`).
5. Run smoke test against production through the UI
   (`smoke_test_result`).
6. On smoke PASS → update Linear story to `done`; post ship note with
   timestamp and flag name; run iteration completion check (using
   `using-forge`).
7. On smoke FAIL → flip flag OFF immediately; post incident note in
   Linear; return story to `ready-for-dev`; do NOT retry without human
   review.
8. Exit the loop.

## Proof of Progress

- Feature flag was actually flipped (state transition recorded).
- Smoke test was actually executed against production and its result
  recorded.
- A Linear ship note (PASS) or incident note (FAIL) was posted with
  timestamp.
- The story moved to `done` (PASS) or `ready-for-dev` (FAIL).

## State Transition Rule

```
transition ready-to-deploy → done
  trigger smoke test passes

transition ready-to-deploy → ready-for-dev
  trigger smoke test fails
  handoff running-atdd-sessions to developer-agent
```

## Halt Conditions

- Production deployment does not contain the code → halt; route back
  to `bootstrapping-project` / devops-agent to deploy.
- Feature flag is not OFF in production before flip → halt; do not
  flip; raise human gate.
- Human has not approved go-live → halt; do not flip; wait for
  approval.
- Smoke test FAILS → immediate flag OFF → halt; do not retry without
  human review.
- A `guarding-loops` `halted-*` report → stop; do not flip the flag.

## Handoff Target

- Smoke PASS → story is `done`; run iteration completion check via
  `using-forge`. If all stories in the active Cycle are `done`, idle
  and await human gate.
- Smoke FAIL → developer-agent (pull model via `using-forge` Step 3);
  story reappears in `ready-for-dev`. Human is notified.
- Production deployment missing → devops-agent (deployment fix) →
  resume from Step 1.
