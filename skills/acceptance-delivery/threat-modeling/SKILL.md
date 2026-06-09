---
name: threat-modeling
level: L2-GUIDED
owner: secops-agent
trigger: new story drafted; new integration; auth/payment/PII changes
---

# threat-modeling

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
