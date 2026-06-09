# deciding-architecture — Handoffs

## Inbound
Triggered by developer-agent posting:
> "Architecture decision needed: [description]. @architect-agent"

Inbound artifact: story ID, description of the decision needed, the two options the developer was considering.

## Outbound

**On ADR accepted:**
Post to Linear: "ADR accepted: ADR-XXX [title]. Stories [IDs] may proceed."
**Unblocks:** developer-agent for the affected story
**Artifact passed:** `docs/adr/ADR-XXX-[slug].md`

**If ADR changes story scope:**
Affected story returns to `in-analysis`; po-agent updates ACs.
