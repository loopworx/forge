---
name: facilitating-event-storming
level: L2-GUIDED
owner: po-agent, ux-agent
trigger: Phase 4 of facilitating-inception; or "let's event storm"
description: Facilitates event storming sessions to discover bounded contexts and domain events
---

# facilitating-event-storming

## Description

Facilitates an interactive event storming session to discover the domain model through conversation. The agent asks questions; the human answers; the agent maps domain events, commands, policies, aggregates, and UI elements. The session ends by producing CONTEXT.md (the ubiquitous language) and a structured event storm artifact. Do not produce stories until event storming is complete.

---

## The Sticky Colours

| Colour | Represents | Example |
|---|---|---|
| 🟠 Orange | Domain event (past tense) | `OrderPlaced`, `PaymentFailed` |
| 🔵 Blue | Command (imperative) | `PlaceOrder`, `CancelSubscription` |
| 🟣 Purple | Policy ("when X, then Y") | `When PaymentFailed, then NotifyUser` |
| 🟡 Yellow | Aggregate / Actor | `Order`, `Customer`, `PaymentGateway` |
| 🩷 Pink | UI / Read model | `Order Confirmation Screen`, `Invoice PDF` |
| 🔴 Red | Hotspot / ambiguity | Questions to resolve later |

Pink stickies become user stories.
Orange + Blue + Purple become acceptance criteria.

---

## Session Protocol

### Phase 1 — Chaotic Exploration
> "Tell me what happens in your system. Start anywhere — what's the most important thing that happens?"

- Map every domain event the human mentions (orange)
- Don't organise yet — just capture
- Ask: "What triggers that?" → command (blue)
- Ask: "What happens next?" → next event (orange)
- Mark anything unclear as a hotspot (red)

### Phase 2 — Enforce the Timeline
> "Let's put these in order, left to right, earliest to latest."

- Arrange events on a timeline
- Identify parallel flows
- Surface gaps: "What happens between X and Y?"

### Phase 3 — Add Commands and Actors
- For each event: "What command caused this?"
- For each command: "Who or what issues this command? (human, system, timer, policy)"
- Map actors to aggregates (yellow)

### Phase 4 — Add Policies
- "Are there any automatic reactions? When X happens, does the system automatically do Y?"
- Map as purple policy stickies

### Phase 5 — Add UI / Read Models
- "What does the user see at each step?"
- "What information does the user need to issue this command?"
- Map as pink stickies
- Each pink sticky = one user story candidate

### Phase 6 — Ubiquitous Language (establishing-ubiquitous-language)
- For each aggregate: agree on the canonical name, list synonyms to avoid
- For each key event/command: agree on the canonical verb form
- Document in CONTEXT.md
- Flag ambiguities in CONTEXT.md Flagged Ambiguities section

---

## Output Artifacts

### `docs/event-storm.yaml`
```yaml
events:
  - id: EVT-NNN  # sequential event ID assigned during storming
    name: OrderPlaced
    trigger: PlaceOrder command
    actor: Customer
    aggregate: Order
    policies:
      - When OrderPlaced, notify merchant
    ui: Order Confirmation Screen

bounded_contexts:
  - name: Orders
    aggregates: [Order, OrderLine]
  - name: Payments
    aggregates: [Payment, Invoice]

story_candidates:
  - ui: Order Confirmation Screen
    pain_point: Customer needs confirmation their order was received
    events: [OrderPlaced]
```

### `CONTEXT.md`
See `establishing-ubiquitous-language` skill for the full generation protocol.

## State Model

This skill produces the discovery artifacts that feed story writing.

- Phase 1–5: `docs/event-storm.yaml` draft
- Phase 6: `CONTEXT.md` draft
- `in-analysis` — stories produced after event storming completes

## Rules

1. Ask questions and capture human answers rather than invent the domain model.
2. Map events (past tense), commands (imperative), policies, aggregates, and UI stickies by colour.
3. Mark unclear items as red hotspots; do not gloss over ambiguities.
4. Order events left-to-right on a timeline and identify parallel flows.
5. Convert each pink sticky into a user story candidate after the session.
6. Hand off to `establishing-ubiquitous-language` for Phase 6 before producing stories.
