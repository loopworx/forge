# Forge

**Forge** is a lean software delivery framework for AI agents — from inception to production.

Where other agent frameworks hand you a coding assistant, Forge gives you an autonomous engineering organization: seven specialized agents, a shared delivery state machine, and a strict ATDD-first process built on battle-tested XP and Lean delivery practices.

Your agents don't just write code. They run discovery workshops, write INVEST-compliant user stories, make architecture decisions, implement vertical slices test-first, desk check each acceptance criterion, manage feature flags, and ship — continuously, to production, without you babysitting them.

---

## The Big Idea

Most agent frameworks start at "write code". Forge starts at "what are we building and why".

Every story in Forge traces back to a customer pain identified in an empathy map. Every acceptance criterion is testable through the UI alone — no backdoors, no database queries, no internal system access. Every feature ships behind a feature flag on trunk. Nothing goes to production that a QA agent and a PO agent haven't independently verified against the original acceptance criteria.

This is how high-performing software teams actually work. Forge encodes it as agent skills.

---

## The Seven Agents

| Agent | Owns |
|---|---|
| **po-agent** | Inception, story writing, backlog management, story acceptance |
| **ux-agent** | Empathy mapping, UX specs, frontend acceptance criteria |
| **architect-agent** | Architecture Decision Records, service boundaries, tech debt |
| **developer-agent** | ATDD loops, TDD inner loops, contract tests, feature flag code |
| **qa-agent** | Acceptance test authoring, desk checks, regression suite |
| **devops-agent** | CI/CD, environments, Unleash feature flags, deployments |
| **secops-agent** | Threat modeling, security ACs, SAST/DAST pipeline gates |

Each agent has a defined role, a default skill set, and a strict boundary. The developer agent doesn't make architecture decisions. The architect agent doesn't write production code. Roles are enforced, not suggested.

---

## The Delivery Lifecycle

### 1. Inception
The po-agent and ux-agent facilitate a structured discovery process:
- **Lean Canvas** — problem, solution, unique value proposition
- **Empathy Mapping** — understand the customer before writing a single requirement
- **Trade-off Sliders** — team-wide prioritization: quality vs. cost vs. UX vs. security (no ties allowed)
- **Event Storming** — interactive back-and-forth conversation mapping domain events, commands, policies, and UI elements. UI stickies become user stories. Policies and commands become acceptance criteria.
- **Iteration Mapping** — story dependencies → parallel tracks → Linear cards, automatically

### 2. Story Refinement
Every story passes a four-gate review before it's playable:
1. **PO drafts** — persona, customer value, rough acceptance criteria
2. **UX gate** — is this valuable? traces to empathy map pain point?
3. **Developer gate** — is this technically feasible? cost signal? estimable?
4. **QA gate** — is every AC testable through the UI alone, as an outside customer would test it?

Stories that fail any gate go back to the PO. Stories that pass are `ready-for-dev` — and when a developer agent picks one up, it makes a 100% commitment: exactly this, nothing more, nothing less.

All stories follow the **INVEST principle** and Mike Cohn's *User Stories Applied* — no technical detail in stories. Backend shape, API design, database schema all live in ADRs, not stories.

### 3. Iteration Zero
Before story 1 starts:
- architect-agent writes ADRs for iteration 1 stories
- devops-agent provisions CI/CD pipeline, test environment, and Unleash feature flag server
- qa-agent authors the acceptance test scaffold — first dummy Acceptance Test must be green on CI
- secops-agent wires SAST/DAST and secret scanning into the pipeline

Iteration 1 cannot start until the acceptance test scaffold is green on CI and a test environment is live.

### 4. Iteration N — The ATDD (Acceptance Test-Driven Development) Loop

ATDD is a collaborative practice where acceptance criteria are expressed as executable tests *before* any implementation begins. The outer Acceptance Test is the sole definition of done — everything else serves it.

For each story, the developer agent runs a strict process:

```
Outer Acceptance Test → RED

  For each sub-slice in the AC:
    FE inner loop: component test RED → GREEN → REFACTOR
    BE inner loop: CDC contract test RED → GREEN → REFACTOR
    Sub-slice complete ✓  (never batch FE loops then BE loops)

Outer Acceptance Test → GREEN
Desk check with QA (local first, then deployed environment)
```

One sub-slice at a time. One AC at a time. No implementation code before the outer Acceptance Test is RED and visible. No moving to the next sub-slice until the current one is fully green.

### 5. The Kanban Stages

```
in-analysis          → story refinement (all four gates)
ready-for-dev        → developer picks up = 100% commitment
in-dev               → ATDD loop + desk check per AC
ready-for-qa         → story deployed to test environment
in-qa                → QA full regression suite
ready-for-acceptance → PO picks up
in-acceptance        → PO smoke tests all ACs
ready-to-deploy      → human approves flag flip
(done)               → feature flag on, Linear card closed
```

Bug cards found in `in-qa` or `in-acceptance` go directly to `ready-for-dev` — no refinement needed, they're regressions against already-accepted ACs.

### 6. Trunk-Based Continuous Deployment
No feature branches. Every push goes to production if CI is green — but unfinished stories are feature-flagged off via [Unleash](https://www.getunleash.io/) (self-hosted, open source). When a story is accepted, the PO approves the flag flip and the feature is live.

---

## The Delivery State Machine

Agents coordinate through a shared `.forge/` directory — a file-based event bus:

```
.forge/
├── state/
│   ├── current-story.yaml      # active story, AC status, current loop
│   └── iteration-state.yaml    # what's in-progress, blocked, done
├── events/
│   ├── ac-desk-check-ready.json
│   ├── desk-check-approved.json
│   ├── story-deployed.json
│   ├── story-accepted.json
│   └── flag-flip-approved.json
└── artifacts/
    ├── project.constraints.yaml  # trade-off slider output — all agents read this
    ├── iteration-map.md
    └── stories/
```

Every agent's session starts by reading `.forge/state/` — not conversation handoff notes, not plan files. The delivery state is the single source of truth.

---

## Skill Precedence

Forge uses an explicit three-level skill hierarchy to prevent the most common agent failure mode: rationalization over process.

```
L1 RIGID    → running-atdd-sessions, running-tdd-loops
              (these override everything; no exceptions)
L2 GUIDED   → writing-stories, facilitating-inception, deciding-architecture
              (structured process with human gates)
L3 MECH     → finishing-stories, managing-feature-flags
              (mechanical execution after L1/L2 complete)
```

An agent cannot rationalize "I'll just wire the handler first" — `running-atdd-sessions` is L1 and wins over plan files, conversation summaries, and implementation suggestions without exception.

---

## Skills Library

**Meta**
- `using-forge` — precedence rules, agent roles, session start ritual
- `resuming-sessions` — re-run outer Acceptance Test before reading anything else

**Discovery**
- `facilitating-inception` — lean canvas, empathy map, trade-off sliders, event storming, iteration map
- `facilitating-event-storming` — interactive domain event discovery
- `writing-stories` — INVEST-compliant story writing with four-gate review
- `building-iteration-map` — dependency graph → Linear cards via MCP

**Architecture**
- `deciding-architecture` — ADR authoring, service boundary definition

**Iteration Zero**
- `bootstrapping-project` — CI/CD, repos, environments, Unleash setup
- `validating-test-harness` — gate skill: blocks iteration 1 until scaffold is green

**Development (L1 Rigid)**
- `running-atdd-sessions` — outer Acceptance Test RED → sub-slice loops → GREEN
- `running-tdd-loops` — FE component loop and BE CDC contract loop
- `writing-contract-tests` — CDC contract as backend vertical acceptance gate
- `managing-feature-flags` — Unleash REST API integration

**Quality**
- `running-desk-checks` — per-AC verification, generates desk-check artifact, pauses for human
- `writing-acceptance-tests` — Playwright/Cypress, UI-interactions only, no backdoors
- `running-regression-suite` — full suite on test environment

**Acceptance & Delivery**
- `approving-stories` — PO smoke test against ACs
- `finishing-stories` — flag flip + Linear update + post-deploy security check
- `threat-modeling` — security ACs injected per story from project.constraints.yaml
- `securing-pipeline` — SAST/DAST/secret scanning gates

---

## Installation

### Cursor
```text
/add-plugin forge
```

### Claude Code
```bash
/plugin install forge
```

### Manual
Clone this repo and point your agent's skills directory at `skills/`:
```bash
git clone https://github.com/yaman/forge ~/.agents/forge
```
Then add to your agent's system prompt or CLAUDE.md:
```
Skills: ~/.agents/forge/skills
```

---

## Philosophy

- **Customer value first** — every story traces to an empathy map pain point; no story is written without it
- **INVEST or bust** — stories with technical detail, untestable ACs, or no clear customer value never reach the backlog
- **Test-first is non-negotiable** — the first file edit in any session is always a test file; implementation code is forbidden until the outer Acceptance Test is RED
- **Vertical slices** — every story is deployable end-to-end; no frontend-only or backend-only stories
- **Trunk over branches** — feature flags make branches unnecessary; continuous deployment makes them dangerous
- **Agents have roles** — a developer agent that makes architecture decisions is a liability; role separation is enforced by skill design
- **State over memory** — agents read `.forge/state/`, not conversation history; delivery state survives context windows

---

## Contributing

Forge skills follow [Anthropic's agent skill best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):
- Description field is the primary selection mechanism — write it first
- SKILL.md stays under 500 lines — use linked reference files for detail
- Write evals before writing skill body content
- Skills are state machines with explicit gates, not knowledge documents

See `skills/writing-skills/SKILL.md` for the full guide.

1. Fork the repository
2. Write your eval first
3. Draft the description field
4. Write the skill body
5. Submit a PR with eval results

---

## License

MIT — see LICENSE file.

---

*Forge is inspired by XP and Lean delivery practices, Mike Cohn's* User Stories Applied, *and the hard lessons learned from watching AI agents skip the outer RED.*
