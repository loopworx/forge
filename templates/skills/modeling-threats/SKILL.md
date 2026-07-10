---
name: modeling-threats
level: L2-GUIDED
owner: secops-agent
trigger: new story drafted; new integration; auth/payment/PII changes
metadata:
  category: acceptance-delivery
description: Analyzes a story for security threats, injects security ACs, and determines if the story can be made safe
---

# modeling-threats

## Description

Injects security acceptance criteria into stories before development begins. Reviews the story for abuse paths, trust boundaries, sensitive data handling, and misuse cases. Security is added as visible ACs, not hidden as a separate checklist nobody reads.

---

## Protocol

For each story, ask:
- What data is sensitive here?
- What identity or permission boundary is crossed?
- What happens if the user tampers with input?
- What happens if an attacker repeats this action, automates it, or replays it?
- What audit trail is required?

Then add explicit ACs such as:
- Unauthorized users see an access denied state
- Invalid input shows safe validation, not stack traces
- Sensitive fields are masked where required
- Rate-limited actions give a safe customer-visible response

---

## Output

Update the story in Linear with security ACs before it may enter `ready-for-dev`.
If a story cannot be made safe within scope, return it to `in-analysis`.

## State Model

This skill injects security concerns into story acceptance criteria.

- `in-analysis` — story being refined, gated, or returned for rework
- `ready-for-dev` — destination after security ACs are injected and pass through `writing-stories` Gate 4
- Security surface triggers — auth, payments, PII, permission boundaries


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Review every new or changed story for sensitive data, trust boundaries, and abuse paths.
2. Add explicit, customer-visible security acceptance criteria before development begins.
3. Return the story to `in-analysis` if it cannot be made safe within scope.
4. Do not treat security as a separate hidden checklist.
