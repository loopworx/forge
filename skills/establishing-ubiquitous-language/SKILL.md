---
name: establishing-ubiquitous-language
level: L2-GUIDED
owner: po-agent
trigger: Phase 6 of facilitating-event-storming; or when a new term is encountered mid-project
metadata:
  category: discovery
description: Establishes and maintains a shared vocabulary in CONTEXT.md for consistent communication across all agents
---

# establishing-ubiquitous-language

## Description

Generates and maintains CONTEXT.md — the project's shared domain vocabulary. Run as the final phase of every event storming session. Also triggered mid-project when any agent encounters a term not in CONTEXT.md. CONTEXT.md is the single source of truth for how things are named in this project.

---

## Why This Matters

Agents dropped into a project with no shared vocabulary use 20 words where 1 will do. More dangerously, two agents may use the same word to mean different things, producing subtle bugs and miscommunications that are nearly impossible to trace.

A ubiquitous language means: the word used in conversation, the word used in code, the word used in tests, and the word used in Linear cards are all the same word.

---

## Generation Protocol (post-event-storming)

For each aggregate identified in the event storm:
```
1. State the candidate name
2. Ask: "Is there another word people use for this?"
3. If yes: "Which is more precise? Let's make that canonical."
4. Document: canonical name, avoided synonyms, reason
```

For each key command/event:
```
1. Verify the verb form (past tense for events, imperative for commands)
2. Verify for collisions: does this word mean something else elsewhere in the domain?
3. Document in the domain terms section
```

For ambiguities (red hotspots from event storming):
```
1. Present the ambiguity to the human
2. Resolve it with a precise definition
3. Document in Flagged Ambiguities with the resolution
```

---

## Mid-project Update Protocol

When any agent encounters an undefined term:
```
1. STOP — do not use the undefined term
2. Post to Linear story comment:
   "CONTEXT.md update needed: [term] is not defined.
    Proposed definition: [definition]
    Proposed avoid list: [synonyms]
    @po-agent please review."
3. Wait for po-agent to update CONTEXT.md
4. Resume after CONTEXT.md is updated
```

---

## CONTEXT.md Structure

See the CONTEXT.md template in the repo root.
Sections: Domain Language, Bounded Context Boundaries, Agent Communication Protocol, Flagged Ambiguities.

The Agent Communication Protocol section is pre-populated with Forge delivery terms (outer Acceptance Test, sub-slice, desk review, etc.) and must not be modified without a process reason.

## State Model

This skill maintains the shared vocabulary artifact used by all agents.

- `in-analysis` (stories) — triggers vocabulary review when new terms appear
- `docs/event-storm.yaml` — input aggregate, event, command, policy, and story candidates
- `CONTEXT.md` — single source of truth for domain language
- `Flagged Ambiguities` — unresolved or resolved ambiguities


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

1. Maintain `CONTEXT.md` as the single source of truth for project terminology.
2. After event storming, agree on canonical names for every aggregate and avoid all synonyms.
3. Use past-tense verbs for domain events and imperative verbs for commands.
4. Present ambiguities to the human and document resolutions.
5. When an undefined term is encountered mid-project, stop using it until po-agent updates `CONTEXT.md`.
6. Do not modify the Agent Communication Protocol section without a process reason.
