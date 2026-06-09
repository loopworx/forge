# establishing-ubiquitous-language — Handoffs

## Outbound handoff

**Skill:** `writing-stories`
**Agent:** po-agent
**Trigger:** `CONTEXT.md` committed to repo root and human-approved
**Artifact passed:** `CONTEXT.md`

**Effect on all agents:** `CONTEXT.md` is now available for session start protocol. All agents must read it. All agents may propose updates mid-project via the mid-project update protocol.

## Mid-project handoff (inbound)

Any agent → po-agent
**Trigger:** Agent encounters undefined term
**Protocol:** Post to Linear story comment; po-agent updates `CONTEXT.md`; agent resumes
