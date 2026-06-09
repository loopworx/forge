---
name: deciding-architecture
level: L2-GUIDED
owner: architect-agent
trigger: iteration zero; developer blocked by missing architecture decision; new bounded context or integration point discovered
---

# deciding-architecture

## Description

Writes Architecture Decision Records (ADRs) for stories that need architectural clarity before development begins. Defines service boundaries, integration contracts, storage decisions, and key trade-offs. ADRs capture decisions, not implementation detail. A developer-agent may not invent architecture mid-story; if an architecture decision is needed, development stops until an ADR exists.

---

## When This Skill Fires

Run this skill when:
- A story depends on a new service boundary, integration, queue, or storage pattern
- A developer-agent posts: "Architecture decision needed"
- Event storming reveals a new bounded context
- A story would otherwise require speculative design during implementation

Do NOT run this skill for:
- Renaming variables
- Local refactoring inside an existing boundary
- Small code structure choices inside an established architecture

---

## Output

One ADR per decision in `docs/adr/ADR-XXX-[slug].md`

Format:
```markdown
# ADR-XXX: [Decision Title]

## Status
Proposed | Accepted | Superseded

## Context
What problem forces this decision now?

## Decision
What do we choose?

## Consequences
What becomes easier? Harder? What constraints now exist?

## Alternatives Considered
Why were other options rejected?

## Story Impact
Which stories depend on this ADR?
```

---

## Decision Protocol

### Step 1 — Define the forcing function
State the problem in one sentence:
> "We need a decision about [X] because story [STORY-ID] cannot proceed without it."

### Step 2 — Enumerate options
List 2–4 realistic options only.
Each option must include:
- Boundary ownership
- Data flow
- Failure mode
- Operational cost
- Security implications

### Step 3 — Check project constraints
Read `project.constraints.yaml` before choosing.
If `quality` outranks `cost`, choose the safer design over the cheaper one.
If `security` outranks `ux`, choose the more defensible integration even if it adds friction.

### Step 4 — Write the ADR
Decide. Document. Commit.
Do not write "it depends". Do not leave the decision open.

### Step 5 — Signal downstream agents
Post to Linear:
> "ADR accepted: ADR-XXX [title]. Stories [IDs] may proceed."

---

## Rules

1. ADRs define boundaries and constraints, not class names or folder structure.
2. One ADR = one decision. If you are deciding two things, write two ADRs.
3. Developers may not continue blocked stories until the ADR exists and is accepted.
4. If an ADR changes an already accepted story, that story must return to `in-analysis`.
