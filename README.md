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
- **Event Storming** — interactive back-and-forth conversation mapping domain events, commands, policies, and UI elements. UI stickies become user stories. Policies and commands become acceptance criteria. The final phase produces `CONTEXT.md` — the project's ubiquitous language.
- **Iteration Mapping** — dependency graph → topological sort → iteration layers → Linear Projects + Cycles, automatically

### 2. Story Refinement
Every story passes a four-gate review before it's playable:
1. **PO drafts** — persona, customer value, rough acceptance criteria
2. **UX gate** — is this valuable? traces to empathy map pain point?
3. **Developer gate** — is this technically feasible? cost signal? estimable?
4. **QA gate** — is every AC testable through the UI alone, as an outside customer would test it?

Stories that fail any gate go back to the PO. Stories that pass land in their iteration's Linear Project as `ready-for-dev`.

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

Linear is the delivery state machine. There are two boards:

**Board 1 — Iteration Map (Linear Roadmap/Projects)**
One Project per iteration. Stories are assigned to iterations based on a topological sort of their dependency graph — stories with no dependencies go into Iteration 1, stories depending on Iteration 1 go into Iteration 2, and so on. This board is the backlog. Stories with no iteration assignment are unscoped.

**Board 2 — Delivery Board (Linear Cycle)**
The active iteration's stories move through the delivery state machine:

```
in-analysis          → story refinement (all four gates)
ready-for-dev        → any developer agent can pull (first available wins)
in-dev               → ATDD loop + desk check per AC
ready-for-qa         → story deployed to test environment; QA agent pulls
in-qa                → QA full regression suite
ready-for-acceptance → PO agent pulls
in-acceptance        → PO smoke tests all ACs
ready-to-deploy      → HUMAN approves flag flip
(done)               → feature flag on, Linear card closed
```

Bug cards found in `in-qa` or `in-acceptance` go directly to `ready-for-dev` — no refinement needed.

**Stories are pulled, not assigned.** When a developer agent starts a session with no active story, it queries Linear for the oldest story in `ready-for-dev` and atomically moves it to `in-dev` with self-assignment in a single API call. If two agents race, only one wins — the other pulls the next available story. No orchestrator needed.

**Iteration completion.** After completing a story, every agent checks: *"are all stories in this iteration done?"* If yes, the po-agent posts a completion notice on the Linear milestone and idles. A human PO reviews, then triggers the next iteration by activating the next Cycle. Iterations are variable duration — they end when done, not on a fixed date.

### 6. Iteration Scoping

Forge replaces velocity-based sprint planning with **dependency-driven iteration scoping**:

| Human team concept | Forge equivalent |
|---|---|
| Story points | AC count (1 AC ≈ 1 ATDD loop) |
| Team velocity | Max concurrent agents (human sets this) |
| Fixed-length sprint | Variable duration — iteration ends when all stories reach `done` |
| Planning poker | Architect agent flags stories with >5 ACs as split candidates |
| Sprint planning | Topological sort of dependency graph → iteration layers |

Parallel execution within an iteration is determined by story independence — stories in the same layer with no inter-story dependencies run simultaneously with separate developer agents.

### 7. Trunk-Based Continuous Deployment
No feature branches. Every push goes to production if CI is green — but unfinished stories are feature-flagged off via [Unleash](https://www.getunleash.io/) (self-hosted, open source). When a story is accepted, the human PO approves the flag flip and the feature is live.

---

## Ubiquitous Language

> *"With a ubiquitous language, conversations among developers and expressions of the code are all derived from the same domain model."*
> — Eric Evans, Domain-Driven Design

Agents dropped into a project with no shared vocabulary use 20 words where 1 will do. Forge solves this by generating `CONTEXT.md` as the final phase of every event storming session.

`CONTEXT.md` defines:
- **Domain terms** — canonical names for every entity, event, command, and policy discovered during event storming, with explicit "avoid" aliases
- **Bounded context boundaries** — which terms belong to which service/domain
- **Agent communication protocol** — the shared vocabulary of the delivery process itself (e.g. "outer Acceptance Test" not "E2E test", "desk check" not "demo", "sub-slice" not "partial implementation")
- **Flagged ambiguities** — terms that look like synonyms but aren't

`CONTEXT.md` lives in the repo root and is a **mandatory read for every agent at session start**. Any agent that encounters a term not in `CONTEXT.md` must stop and propose an addition before using it. The po-agent owns it; all agents can propose updates.

---

## Agent Session Start Protocol

Every agent, every session, in this order:

```
1. Query Linear → do I have an active story in-progress?
   If yes  → resume it (re-run outer Acceptance Test first)
   If no   → pull oldest story from ready-for-dev (atomic claim)
2. Read CONTEXT.md → speak the project's language
3. Read project.constraints.yaml → know the priorities
4. Begin — the Linear stage determines what happens next
```

No handoff notes. No plan files. No conversation summaries. State lives in Linear and the repo — not in context windows.

---

## Project Artifacts

Two files live in the repo root and are read by all agents:

```
CONTEXT.md                  # ubiquitous language — generated from event storming
project.constraints.yaml    # trade-off slider output — team priorities
```

Story content lives in Linear. A snapshot is committed to `stories/` when a story moves to `ready-for-dev` — at that point the story is locked and the snapshot never drifts.

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
- `using-forge` — precedence rules, agent roles, session start protocol
- `resuming-sessions` — query Linear + read CONTEXT.md before anything else

**Discovery**
- `facilitating-inception` — lean canvas, empathy map, trade-off sliders, event storming, iteration map
- `facilitating-event-storming` — interactive domain event discovery; final phase produces `CONTEXT.md`
- `establishing-ubiquitous-language` — generates and maintains `CONTEXT.md` from event storming output
- `writing-stories` — INVEST-compliant story writing with four-gate review
- `building-iteration-map` — topological sort of dependencies → Linear Projects + Cycles via MCP

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
- **Shared language** — agents and humans speak from the same domain model; `CONTEXT.md` is generated before the first story is written
- **INVEST or bust** — stories with technical detail, untestable ACs, or no clear customer value never reach the backlog
- **Test-first is non-negotiable** — the first file edit in any session is always a test file; implementation code is forbidden until the outer Acceptance Test is RED
- **Vertical slices** — every story is deployable end-to-end; no frontend-only or backend-only stories
- **Pull, don't push** — agents pull work when ready; no assignment, no queue management, no orchestrator
- **Trunk over branches** — feature flags make branches unnecessary; continuous deployment makes them dangerous
- **Agents have roles** — a developer agent that makes architecture decisions is a liability; role separation is enforced by skill design
- **State over memory** — agents query Linear and read repo artifacts; delivery state survives context windows

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

*Forge is inspired by XP and Lean delivery practices, Eric Evans'* Domain-Driven Design, *Mike Cohn's* User Stories Applied, *and the hard lessons learned from watching AI agents skip the outer RED.*
