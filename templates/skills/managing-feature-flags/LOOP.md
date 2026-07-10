# managing-feature-flags — Loop

This is an L2-GUIDED lifecycle protocol that governs feature flag
creation, configuration, and retirement across the delivery lifecycle.
Every story entering in-dev gets a feature flag; the flag stays OFF
through QA and acceptance, is toggled ON at deploy, and is retired
after the soak period.

## Entry Conditions

- A story has been claimed from `ready-for-dev` and is now `in-dev`.
- The `project.constraints.yaml` feature-flag provider is configured.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

- `flag_name` — the unique flag identifier for the story.
- `flag_state` — `created` | `toggled_on` | `retired`.
- `deploy_timestamp` — when the flag was toggled ON in production.
- `soak_days` — the required soak period before retirement.

## Single Iteration Step

1. On story entering `in-dev`: create the feature flag in the flag
   provider with default state OFF.
2. On deploy: toggle the flag ON for the target audience.
3. After `soak_days` elapsed with no regressions: retire the flag and
   remove the conditional code path.

## Proof of Progress

- The flag exists in the flag provider and is verified OFF in all
  non-production environments.
- The flag is toggled ON at deploy and confirmed ON in production.
- The flag is retired and the code path is cleaned up.

## State Transition Rule

transition in-dev → in-dev
  trigger story enters in-dev
  handoff managing-feature-flags to devops-agent

transition ready-to-deploy → ready-to-deploy
  trigger flag remains OFF in production
  handoff managing-feature-flags to devops-agent

transition ready-to-deploy → ready-to-deploy
  trigger flag retired after soak period
  handoff managing-feature-flags to devops-agent

## Halt Conditions

- Flag provider is unreachable or misconfigured → halt; raise to
  devops-agent.
- Flag was toggled ON before deploy approval → halt; raise human gate.
- Soak period not met and a regression is reported → halt; toggle OFF
  and investigate.

## Handoff Target

- Flag created → return control to `running-atdd-sessions`
  (developer-agent).
- Flag toggled ON at deploy → hand off to `finishing-stories`
  (developer-agent).
- Flag retired → hand off to `using-forge` iteration completion check.
