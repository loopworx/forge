# Forge Loop Contract Test Harness — Design Spec

**Date:** 2026-06-21  
**Status:** Approved for Implementation  
**Author:** Forge team (design by Claude Code)  

---

## 1. Purpose

Forge is a lean software delivery framework for AI agents. It defines 21 skills across 7 categories, a Linear-backed state machine, and a "perfect loop" architecture. The perfect loop plan exists as a document but is **entirely unimplemented** in the repository.

This test harness is a **diagnostic TDD tool** that:
1. Runs against the current repo state
2. Produces a concrete failure report (the implementation TODO list)
3. Passes only when the perfect loop plan is fully implemented
4. Verifies that loop contracts (`LOOP.md`), state machines, handoff graphs, and cross-references are internally consistent

The harness answers: *"Is this skill library a coherent loop operating system, or a collection of loosely-related process documents?"*

---

## 2. Design Principles

| Principle | Rationale |
|---|---|
| **Failure report = TODO list** | Every failing test names a specific file/line to fix. You work through them systematically. |
| **Static analysis first** | 80% of gaps are structural (missing files, missing sections, broken references). Static tests catch these instantly without running agents. |
| **No LLM in the harness** | Evals already test agent behavior. This harness tests *skill definitions* — it must be deterministic, fast, and reproducible. |
| **Rust for compiler-like work** | Parsing markdown into typed ASTs, building a handoff graph (CFG), detecting dead-end states, and cross-referencing symbols is compiler frontend work. Rust's type system and `petgraph` are the right tools. |
| **Fixture as contract** | `fixtures/loop-contract.yaml` is the spec. The repo is the implementation. The test harness measures implementation against spec. |

---

## 3. Architecture: Two-Layer Test Suite

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Static Contract Tests (fast, deterministic, no LLM) │
│  ─────────────────────────────────────────────────────────────│
│  Parse SKILL.md / HANDOFFS.md / LOOP.md as structured data   │
│  Verify: completeness, consistency, cross-references           │
│  Target: <100ms per test, runs in CI                          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Simulated Execution Tests (medium cost, mock env)   │
│  ─────────────────────────────────────────────────────────────│
│  Run skill logic against mocked Linear API + filesystem         │
│  Verify: state transitions, handoff paths, resume behavior        │
│  Target: <5s per test, runs on PR                               │
└─────────────────────────────────────────────────────────────────┘
```

**Layer 1 is the focus of this design.** Layer 2 is deferred to a future iteration.

---

## 4. File Layout

```
evals/contract-tests/
├── Cargo.toml                           # Rust workspace config
├── src/
│   ├── main.rs                          # CLI entry: cargo run → all tests
│   ├── lib.rs                           # Library exports for unit tests
│   ├── types.rs                         # Shared structs: Skill, State, Transition, Loop, etc.
│   ├── diagnostic.rs                    # Failure report formatting with file/line context
│   ├── parser/
│   │   ├── mod.rs                       # Parser module entry
│   │   ├── skill.rs                     # SKILL.md → Skill { name, level, owner, sections, states }
│   │   ├── handoff.rs                   # HANDOFFS.md → HandoffGraph { nodes, edges, entry_points }
│   │   ├── loop.rs                      # LOOP.md → Loop { entry, state_schema, step, proof, transition, halt, handoff }
│   │   ├── readme.rs                    # README.md → skill name extractor (tables, lists)
│   │   └── constraints.rs               # project.constraints.yaml → Constraints { loop_commands, budgets }
│   └── validators/
│       ├── mod.rs                       # Validator orchestration
│       ├── loop_completeness.rs         # Every loop-worthy skill has LOOP.md
│       ├── loop_sections.rs             # LOOP.md has all 7 required sections
│       ├── state_machine.rs             # States in SKILL.md exist in HANDOFFS.md
│       ├── handoff_graph.rs             # No dead-end states, all reachable from entry
│       ├── cross_references.rs          # README skills → directory existence, HANDOFFS.md skill refs → existence
│       └── skill_completeness.rs        # Every skill has required SKILL.md sections
├── fixtures/
│   └── loop-contract.yaml               # Canonical loop stack (the spec)
├── tests/
│   └── integration.rs                   # End-to-end: run all validators on repo
└── README.md                            # How to run, how to read failure reports, how to fix failures
```

---

## 5. Core Types

### 5.1 Skill

```rust
pub struct Skill {
    pub name: String,                      // e.g. "using-forge"
    pub category: SkillCategory,           // meta, discovery, development, quality, etc.
    pub path: PathBuf,                     // skills/meta/using-forge/
    pub level: SkillLevel,                 // L1_RIGID, L2_GUIDED, L3_MECH
    pub owner: Vec<AgentRole>,             // po-agent, developer-agent, etc.
    pub sections: Vec<String>,             // Sections found in SKILL.md
    pub states: Vec<State>,                // States defined in state_model section
    pub has_handoffs: bool,                // HANDOFFS.md exists?
    pub has_loop: bool,                    // LOOP.md exists?
}
```

### 5.2 HandoffGraph

```rust
pub struct HandoffGraph {
    pub nodes: Vec<State>,                 // All states referenced
    pub edges: Vec<Transition>,            // (from_state, to_state, via_skill)
    pub entry_points: Vec<State>,          // States with no inbound edges (in-analysis, etc.)
}

pub struct Transition {
    pub from: State,
    pub to: State,
    pub trigger: String,                 // skill name that triggers this transition
    pub condition: Option<String>,       // Gate condition (e.g., "all ACs pass")
}
```

### 5.3 LoopContract

```rust
pub struct LoopContract {
    pub skill: String,                     // Which skill this LOOP.md belongs to
    pub sections: Vec<LoopSection>,      // Parsed sections
}

pub enum LoopSection {
    EntryConditions(String),
    LoopStateSchema(String),
    SingleIterationStep(String),
    ProofOfProgress(String),
    StateTransitionRule(String),
    HaltConditions(String),
    HandoffTarget(String),
    Unknown(String),                       // Catch extra/misspelled sections
}
```

### 5.4 Diagnostic (Failure Report)

```rust
pub struct Diagnostic {
    pub severity: Severity,                // Error, Warning
    pub code: String,                      // "LOOP-001", "GRAPH-003", etc.
    pub message: String,                   // Human-readable description
    pub location: FileLocation,            // file:line:column
    pub help: String,                    // "Add LOOP.md to skills/discovery/writing-stories/"
}

pub struct FileLocation {
    pub path: PathBuf,
    pub line: Option<usize>,
    pub column: Option<usize>,
}
```

---

## 6. Validators (Layer 1)

### 6.1 `loop_completeness` — LOOP-001 to LOOP-099

**Question:** Does every loop-worthy skill have a `LOOP.md`?

**Algorithm:**
1. Read `fixtures/loop-contract.yaml` → get list of skills where `has_loop: true`
2. For each skill, check if `skills/{category}/{skill-name}/LOOP.md` exists
3. Report missing LOOP.md files with skill path and owner

**Example failures (today):**
```
LOOP-001: Missing LOOP.md
  → skills/discovery/facilitating-inception/LOOP.md
  → required because facilitating-inception is a discovery loop
  → fix: create LOOP.md with 7 required sections

LOOP-002: Missing LOOP.md
  → skills/discovery/writing-stories/LOOP.md
  → required because writing-stories is a 4-gate review loop
  → fix: create LOOP.md with 7 required sections
```

### 6.2 `loop_sections` — LOOP-100 to LOOP-199

**Question:** Does every LOOP.md have exactly the 7 required sections?

**Algorithm:**
1. Parse each existing LOOP.md into sections (via markdown heading hierarchy)
2. Compare against `fixtures/loop-contract.yaml` → `required_sections`
3. Report missing sections and unexpected/extra sections

**Example failure:**
```
LOOP-101: Missing required section in LOOP.md
  → skills/development/running-atdd-sessions/LOOP.md
  → missing: "Halt Conditions"
  → found: Entry Conditions, Loop State Schema, Single Iteration Step, Proof of Progress, State Transition Rule, Handoff Target
  → fix: add "## Halt Conditions" section
```

### 6.3 `state_machine` — STATE-001 to STATE-099

**Question:** Are all states mentioned in SKILL.md also present in the handoff graph?

**Algorithm:**
1. Parse each SKILL.md → extract `state_model` section → extract state names
2. Parse corresponding HANDOFFS.md → build HandoffGraph
3. For each state in SKILL.md, check if it exists as a node in HandoffGraph
4. Report states that exist in SKILL.md but not in HANDOFFS.md

**Example failure (today):**
```
STATE-003: State referenced in SKILL.md but absent from handoff graph
  → skills/development/running-atdd-sessions/SKILL.md:142
  → state: "ready-for-deskcheck"
  → present in state_model but not in HANDOFFS.md
  → fix: add "ready-for-deskcheck" node and transitions in HANDOFFS.md
```

### 6.4 `handoff_graph` — GRAPH-001 to GRAPH-099

**Question:** Is the handoff graph complete and navigable?

**Checks:**
- **No dead-end states** (except `done`): Every state must have ≥1 outbound edge unless it's a terminal state
- **All states reachable from entry points**: Run DFS from `in-analysis`, verify all non-terminal states are reachable
- **No orphaned skills**: Every skill referenced in a transition must exist in the repo

**Example failures (today):**
```
GRAPH-002: Dead-end state
  → skills/meta/using-forge/HANDOFFS.md
  → state: "in-qa" has 0 outbound edges
  → expected: transition to "ready-for-acceptance" or "ready-for-dev"
  → fix: add outbound edge from "in-qa"

GRAPH-005: Unreachable state
  → skills/meta/using-forge/HANDOFFS.md
  → state: "in-deskcheck" is not reachable from any entry point
  → fix: add transition from "in-dev" → "in-deskcheck"
```

### 6.5 `cross_references` — REF-001 to REF-099

**Question:** Do all cross-references in skill files point to existing skills?

**Checks:**
- Every skill name referenced in a HANDOFFS.md `→` edge must exist as a directory
- Every skill name referenced in a SKILL.md "calls `skill-name`" must exist
- Every skill mentioned in README.md must exist in the repo

**Example failures (today):**
```
REF-001: Broken skill reference in HANDOFFS.md
  → skills/meta/using-forge/HANDOFFS.md:53
  → references: "skills/quality/finishing-stories/"
  → actual path: "skills/acceptance-delivery/finishing-stories/"
  → fix: update reference to correct path

REF-007: README references non-existent skill
  → README.md:258
  → mentions: "writing-contract-tests"
  → not found in: skills/development/
  → fix: create skill or remove from README
```

### 6.6 `skill_completeness` — SKILL-001 to SKILL-099

**Question:** Does every skill have the required SKILL.md sections?

**Checks:**
- Every skill directory has `SKILL.md`
- `SKILL.md` has required sections: `description`, `state_model`, `rules`
- L1-RIGID skills have additional required sections: `entry_conditions`, `halt_conditions`

**Example failure:**
```
SKILL-003: Missing required section
  → skills/meta/resuming-sessions/SKILL.md
  → missing: "Handoffs" section
  → fix: add handoff description (or create HANDOFFS.md)
```

---

## 7. The Fixture File

`fixtures/loop-contract.yaml` is the **spec** against which the repo is measured.

```yaml
# Forge Loop Contract
# This file defines which skills MUST have LOOP.md and what a valid LOOP.md contains.
# The test harness verifies the repo against this contract.

metadata:
  version: 1.0.0
  last_updated: 2026-06-21
  description: Canonical loop stack and contract definitions for Forge

# Which skills MUST have a LOOP.md (these are the "loop-worthy" skills)
loops:
  - skill: using-forge
    category: meta
    level: L1_RIGID
    owner: [all-agents]
    has_loop: true
    description: Conductor loop — session start, precedence, iteration governance

  - skill: resuming-sessions
    category: meta
    level: L1_RIGID
    owner: [all-agents]
    has_loop: true
    description: Session resume loop — crash recovery, proof-driven resume

  - skill: loop-guardian
    category: meta
    level: L1_RIGID
    owner: [all-agents]
    has_loop: true
    description: Pre-flight loop guardian — stall detection, budget brakes, human gates

  - skill: facilitating-inception
    category: discovery
    level: L2_GUIDED
    owner: [po-agent, ux-agent]
    has_loop: true
    description: Inception loop — Lean Canvas, Empathy Map, Trade-off Sliders

  - skill: facilitating-event-storming
    category: discovery
    level: L2_GUIDED
    owner: [po-agent, ux-agent]
    has_loop: true
    description: Event storming loop — domain event discovery, CONTEXT.md generation

  - skill: establishing-ubiquitous-language
    category: discovery
    level: L2_GUIDED
    owner: [po-agent]
    has_loop: true
    description: Ubiquitous language loop — CONTEXT.md maintenance

  - skill: writing-stories
    category: discovery
    level: L2_GUIDED
    owner: [po-agent]
    has_loop: true
    description: Story writing loop — four-gate review, INVEST validation

  - skill: building-iteration-map
    category: discovery
    level: L3_MECH
    owner: [po-agent]
    has_loop: true
    description: Iteration mapping loop — topological sort, dependency resolution

  - skill: deciding-architecture
    category: architecture
    level: L2_GUIDED
    owner: [architect-agent]
    has_loop: true
    description: Architecture loop — ADR lifecycle, scope pause/resume

  - skill: bootstrapping-project
    category: iteration-zero
    level: L3_MECH
    owner: [devops-agent]
    has_loop: true
    description: Iteration 0 bootstrap loop — CI/CD, environments, feature flags

  - skill: validating-test-harness
    category: iteration-zero
    level: L2_GUIDED
    owner: [qa-agent, devops-agent]
    has_loop: true
    description: Test harness validation loop — gate before Iteration 1

  - skill: securing-pipeline
    category: iteration-zero
    level: L2_GUIDED
    owner: [secops-agent]
    has_loop: true
    description: Pipeline security loop — SAST/DAST gates, continuous compliance

  - skill: running-atdd-sessions
    category: development
    level: L1_RIGID
    owner: [developer-agent]
    has_loop: true
    sub_loops:
      - running-tdd-loops
      - running-desk-checks
    description: ATDD delivery loop — outer AT RED → sub-slices → GREEN

  - skill: running-tdd-loops
    category: development
    level: L1_RIGID
    owner: [developer-agent]
    has_loop: true
    description: TDD inner loop — FE component RED→GREEN→REFACTOR, BE CDC RED→GREEN→REFACTOR

  - skill: writing-acceptance-tests
    category: quality
    level: L2_GUIDED
    owner: [qa-agent]
    has_loop: true
    description: Acceptance test writing loop — outer AT creation per AC

  - skill: running-desk-checks
    category: quality
    level: L2_GUIDED
    owner: [qa-agent]
    has_loop: true
    description: Desk check loop — per-AC UI verification

  - skill: running-regression-suite
    category: quality
    level: L2_GUIDED
    owner: [qa-agent]
    has_loop: true
    description: Regression loop — full suite on test environment

  - skill: approving-stories
    category: acceptance-delivery
    level: L3_MECH
    owner: [po-agent]
    has_loop: true
    description: PO acceptance loop — UI smoke test per story

  - skill: finishing-stories
    category: acceptance-delivery
    level: L3_MECH
    owner: [po-agent, devops-agent]
    has_loop: true
    description: Release loop — flag flip, smoke test, Linear update

  - skill: managing-feature-flags
    category: acceptance-delivery
    level: L3_MECH
    owner: [devops-agent]
    has_loop: true
    description: Feature flag lifecycle loop — create → off → on → retired

  - skill: threat-modeling
    category: acceptance-delivery
    level: L2_GUIDED
    owner: [secops-agent]
    has_loop: true
    description: Threat modeling loop — security AC injection or story rejection

# Required sections for every LOOP.md (all 7 must be present)
required_loop_sections:
  - heading: "Entry Conditions"
    machine_name: entry_conditions
    required: true
  - heading: "Loop State Schema"
    machine_name: loop_state_schema
    required: true
  - heading: "Single Iteration Step"
    machine_name: single_iteration_step
    required: true
  - heading: "Proof of Progress"
    machine_name: proof_of_progress
    required: true
  - heading: "State Transition Rule"
    machine_name: state_transition_rule
    required: true
  - heading: "Halt Conditions"
    machine_name: halt_conditions
    required: true
  - heading: "Handoff Target"
    machine_name: handoff_target
    required: true

# Required sections for every SKILL.md
required_skill_sections:
  all_levels:
    - heading: "Description"
      machine_name: description
      required: true
    - heading: "State Model"
      machine_name: state_model
      required: true
    - heading: "Rules"
      machine_name: rules
      required: true
  l1_rigid_only:
    - heading: "Entry Conditions"
      machine_name: entry_conditions
      required: true
    - heading: "Halt Conditions"
      machine_name: halt_conditions
      required: true

# Handoff graph invariants
handoff_graph_invariants:
  - name: "No dead-end states"
    rule: "Every state must have ≥1 outbound edge unless it's in terminal_states"
  - name: "All states reachable"
    rule: "Every non-terminal state must be reachable from at least one entry point"
  - name: "Terminal states are terminal"
    rule: "States in terminal_states must have 0 outbound edges"
  
terminal_states:
  - done
  - awaiting-human-gate-6
  - awaiting-human-gate-7

entry_points:
  - in-analysis
  - new-project
  - resume-session
```

---

## 8. Expected Output (Running Today)

```bash
$ cd evals/contract-tests && cargo test

running 6 test suites

test tests::loop_completeness ... FAILED
  LOOP-001: Missing LOOP.md
    → skills/discovery/facilitating-inception/LOOP.md
    → fix: create LOOP.md with 7 required sections
  
  LOOP-002: Missing LOOP.md
    → skills/discovery/facilitating-event-storming/LOOP.md
    → fix: create LOOP.md with 7 required sections
  
  ... (17 total failures)

test tests::state_machine ... FAILED
  STATE-003: State referenced in SKILL.md but absent from handoff graph
    → skills/development/running-atdd-sessions/SKILL.md:142
    → state: "ready-for-deskcheck"
    → fix: add to HANDOFFS.md with transitions
  
  STATE-004: State referenced in SKILL.md but absent from handoff graph
    → skills/development/running-atdd-sessions/SKILL.md:142
    → state: "in-deskcheck"
    → fix: add to HANDOFFS.md with transitions

test tests::handoff_graph ... FAILED
  GRAPH-002: Dead-end state
    → skills/meta/using-forge/HANDOFFS.md
    → state: "in-qa" has 0 outbound edges
    → expected: transition to "ready-for-acceptance" or "ready-for-dev"

test tests::cross_references ... FAILED
  REF-001: Broken skill reference in HANDOFFS.md
    → skills/meta/using-forge/HANDOFFS.md:53
    → references: "skills/quality/finishing-stories/"
    → actual path: "skills/acceptance-delivery/finishing-stories/"
  
  REF-007: README references non-existent skill
    → README.md:258
    → mentions: "writing-contract-tests"
    → not found in: skills/development/

test tests::skill_completeness ... FAILED
  SKILL-003: Missing HANDOFFS.md
    → skills/meta/resuming-sessions/
    → fix: create HANDOFFS.md with inbound/outbound edges

test tests::loop_sections ... ok (0 failures)

failures: 5, success: 1
total failures: 24
```

---

## 9. Success Criteria

The harness is complete when:

1. ✅ `cargo test` runs without compilation errors
2. ✅ `cargo test` produces a diagnostic report with file/line context
3. ✅ Running on the current repo produces ≥20 failures (proves the harness is detecting real gaps)
4. ✅ Every failure has a specific fix instruction
5. ✅ The failure report is ordered by priority (L1-RIGID skills first, then L2-GUIDED, then L3-MECH)
6. ✅ New skills added to the repo are automatically picked up (derives loop-worthy skills from repo structure)
7. ✅ Fixture updates (adding new skills to loop stack) produce new failures until those skills get LOOP.md

---

## 10. Deferrals (Layer 2)

These are out of scope for the initial implementation but documented for future work:

| Feature | Description | When |
|---|---|---|
| Simulated execution tests | Mock Linear API + filesystem, run agent logic through state transitions | After Layer 1 is green |
| Property-based testing | Generate random handoff graphs and verify invariants hold | After initial release |
| CI integration | Run `cargo test` in GitHub Actions on every PR | After test suite stabilizes |
| Coverage report | Which skills/states/transitions are covered by evals vs contract tests | After evals are standardized |

---

## 11. Appendix: Relationship to Existing Evals

The existing 7 evals are **behavioral** — they test whether an agent follows a skill correctly when given a prompt.

The contract test harness is **structural** — it tests whether skill definitions are internally consistent.

They are complementary:
- **Evals** catch: "The agent skipped the outer RED" (behavioral)
- **Contract tests** catch: "The handoff graph has a dead-end state that would trap the agent" (structural)
- **Evals** run with an LLM (slow, expensive, behavioral)
- **Contract tests** run with `cargo test` (fast, cheap, deterministic)

---

*Spec approved for implementation. Next step: invoke `writing-plans` to create the implementation plan.*
