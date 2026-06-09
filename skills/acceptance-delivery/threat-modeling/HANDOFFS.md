# threat-modeling — Handoffs

## Inbound
Triggered during `writing-stories` Gate 2 or Gate 3 when story touches:
- Authentication or authorization
- Payment flows
- Personally identifiable information (PII)
- Permission boundaries

## Outbound

**After security ACs injected:**
**Routes to:** `writing-stories` Gate 4 (QA gate)
**Action:** Update story in Linear with security ACs; notify po-agent
**Artifact passed:** Security ACs added to story; story proceeds through normal gate flow

**If story cannot be made safe within scope:**
**Routes to:** `in-analysis`; po-agent re-evaluates story
