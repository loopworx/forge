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
| **No LLM in the harness** | Behavioral agent tests require an LLM and are kept outside this harness. The simulator tests *skill graph execution* deterministically. |
| **Rust for compiler-like work** | Parsing markdown into typed ASTs, building a handoff graph (CFG), detecting dead-end states, and cross-referencing symbols is compiler frontend work. Rust's type system and `petgraph` are the right tools. |
| **Fixture as contract** | `fixtures/loop-contract.yaml` is the spec. The repo is the implementation. The test harness measures implementation against spec. |
| **Auto-discover + fixture authority** | The harness auto-discovers all skills from `skills/*/*/`. It derives `has_loop` from heuristics (has state transitions, has HANDOFFS.md, L1/L2 level). The fixture is the authority for REQUIRED loops. Skills matching heuristics but not in fixture get warnings. |
| **Bidirectional validation** | States must be consistent in both directions: SKILL.md → HANDOFFS.md AND HANDOFFS.md → SKILL.md. No orphaned states. |

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
│  LAYER 2: Simulated Execution Tests (fast, deterministic)       │
│  ─────────────────────────────────────────────────────────────│
│  Walk the skill handoff graph and project-constraints budgets   │
│  Verify: every loop skill reaches a terminal skill, budgets     │
│          are defined and positive, no infinite skill cycles     │
│  Target: <100ms per test, runs in CI                            │
└─────────────────────────────────────────────────────────────────┘
```

**Both layers are implemented.** Layer 2 is deterministic simulation of the skill graph, not a behavioral agent test.

---

## 3.5 Dependencies

```toml
[package]
name = "forge-contract-tests"
version = "0.1.0"
edition = "2021"

[dependencies]
pulldown-cmark = "0.13"     # Markdown parser
serde = { version = "1.0", features = ["derive"] }
serde_yml = "0.1"           # Fixture YAML parsing (serde_yaml is deprecated)
petgraph = "0.6"            # Handoff graph (CFG) analysis
regex = "1.10"              # State name extraction
walkdir = "2.5"             # Recursive directory traversal
thiserror = "2.0"           # Error type derive
```

---

## 4. File Layout

```
tools/contract-tests/
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
│   │   ├── loop_state.rs                # *.loop.md → LoopState { current_loop, last_proof, stall_counter }
│   │   ├── readme.rs                    # README.md → skill name extractor (tables, lists)
│   │   └── constraints.rs               # project.constraints.yaml → Constraints { loop_commands, budgets }
│   ├── simulation/
│   │   └── mod.rs                       # Deterministic skill-graph simulator
│   └── validators/
│       ├── mod.rs                       # Validator orchestration
│       ├── loop_completeness.rs         # Every loop-worthy skill has LOOP.md
│       ├── loop_sections.rs             # LOOP.md has all 7 required sections
│       ├── loop_section_order.rs        # LOOP.md sections appear in canonical order
│       ├── state_machine.rs             # States in SKILL.md exist in HANDOFFS.md
│       ├── bidirectional_state.rs       # States in HANDOFFS.md exist in some SKILL.md
│       ├── handoff_graph.rs             # No dead-end states, all reachable from entry, terminal states are terminal
│       ├── cross_references.rs          # README skills → directory existence, HANDOFFS.md skill refs → existence
│       ├── skill_completeness.rs        # Every skill has required SKILL.md sections
│       ├── simulation.rs                # Simulated execution: budgets, terminal reachability, cycles
│       ├── loop_state_files.rs          # *.loop.md operational state files exist and are well-formed
│       ├── constraints_loop_block.rs    # project.constraints.yaml has loop: block
│       ├── fixture_drift.rs             # Repo skills match fixture; fixture skills exist in repo
│       ├── handoff_completeness.rs      # Every loop skill has HANDOFFS.md
│       └── fixture_category.rs          # Fixture category matches actual directory
├── fixtures/
│   └── loop-contract.yaml               # Canonical loop stack (the spec)
├── tests/
│   └── integration.rs                   # End-to-end: run all validators on repo
└── README.md                            # How to run, how to read failure reports, how to fix failures
```

---

## 5. Core Types

### 5.0 Supporting Enums

```rust
pub enum SkillCategory {
    Meta,
    Discovery,
    Architecture,
    Development,
    Quality,
    IterationZero,
    AcceptanceDelivery,
}

pub enum SkillLevel {
    L1Rigid,    // L1-RIGID — cannot be overridden (fixture uses L1-RIGID)
    L2Guided,   // L2-GUIDED — structured process with human gates (fixture uses L2-GUIDED)
    L3Mech,     // L3-MECH — mechanical execution (fixture uses L3-MECH)
}

pub enum AgentRole {
    PoAgent,
    UxAgent,
    ArchitectAgent,
    DeveloperAgent,
    QaAgent,
    DevopsAgent,
    SecopsAgent,
    AllAgents,  // Meta skills that apply to all
}

pub enum Severity {
    Error,      // Blocks implementation; must fix
    Warning,    // Should fix but non-blocking
    Info,       // FYI only
}

pub enum MismatchKind {
    InFixtureNotRepo,    // Skill in fixture but missing from repo
    InRepoNotFixture,    // Skill in repo but missing from fixture
    CategoryMismatch,    // Fixture category differs from actual directory
}

pub struct State {
    pub name: String,           // e.g., "ready-for-dev"
    pub defined_in: Vec<String>, // Skill names that define this state
    pub is_terminal: bool,
    pub is_entry: bool,
}
```

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
    pub from: String,                     // state name (look up canonical properties in HandoffGraph.nodes)
    pub to: String,                       // state name (look up canonical properties in HandoffGraph.nodes)
    pub trigger: String,                 // skill name that triggers this transition
    pub condition: Option<String>,       // Gate condition (e.g., "all ACs pass")
}
```

### 5.3 LoopContract

```rust
pub struct LoopContract {
    pub skill: String,                     // Which skill this LOOP.md belongs to
    pub sections: Vec<LoopSection>,      // Parsed sections in order
    pub section_order_valid: bool,         // Sections appear in canonical order
    pub sub_loops: Vec<String>,           // Sub-loop skill names (from fixture)
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

### 5.5 LoopState (Operational State File)

```rust
pub struct LoopStateFile {
    pub path: PathBuf,                     // e.g., stories/STORY-01.loop.md
    pub kind: LoopStateKind,               // inception, iteration_board, story
    pub fields: HashMap<String, String>,  // Parsed YAML frontmatter fields
    pub valid: bool,                       // Has all required fields for its kind
}

pub enum LoopStateKind {
    Inception,           // docs/inception.loop.md
    IterationBoard,      // docs/iteration-board.loop.md
    Story,               // stories/[STORY-ID].loop.md
}
```

### 5.6 AutoDiscoveryResult

```rust
pub struct AutoDiscoveryResult {
    pub skills: Vec<DiscoveredSkill>,    // All skills found in skills/*/*/
    pub loop_worthy: Vec<String>,        // Skills matching loop heuristics
    pub not_loop_worthy: Vec<String>,     // Skills not matching heuristics
    pub fixture_mismatch: Vec<FixtureMismatch>,
}

pub struct DiscoveredSkill {
    pub name: String,
    pub category: String,
    pub path: PathBuf,
    pub has_state_model: bool,
    pub has_handoffs: bool,
    pub level: Option<String>,           // From YAML frontmatter
    pub heuristic_loop_worthy: bool,      // has_state_model && has_handoffs
}

pub struct FixtureMismatch {
    pub skill: String,
    pub kind: MismatchKind,              // InFixtureNotRepo, InRepoNotFixture, CategoryMismatch
    pub expected: String,
    pub actual: String,
}
```

---

## 6. Validators (Layer 1)

### 6.1 `loop_completeness` — LOOP-001 to LOOP-099

**Question:** Does every skill that the fixture REQUIRES to have a `LOOP.md` actually have one?

**Definition:** A skill is "loop-required" if `fixtures/loop-contract.yaml` lists it with `has_loop: true`. This is the **authoritative** list — the fixture is the contract, not heuristics. Skills marked `has_loop: false` (e.g. `managing-feature-flags`) are lifecycle protocols called inside other loops and do not require a `LOOP.md`.

**Algorithm:**
1. Read `fixtures/loop-contract.yaml` → get list of skills where `has_loop: true`
2. For each skill, check if `skills/{category}/{skill-name}/LOOP.md` exists
3. Report missing LOOP.md files with skill path and owner

State names are validated against the `canonical_states` list in `fixtures/loop-contract.yaml`. README Kanban states and perfect-loop-plan desk-check states (`ready-for-deskcheck`, `in-deskcheck`) are treated as canonical even if not every skill repeats them.

**Relationship to auto-discovery:** `fixture_drift` (Section 6.12) handles the auto-discovery heuristic and warns when repo skills match heuristics but are not in the fixture. `loop_completeness` is the **hard requirement** — it only checks skills the fixture explicitly mandates.

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
2. Compare against `fixtures/loop-contract.yaml` → `required_loop_sections`
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
1. Load `canonical_states` from `fixtures/loop-contract.yaml` as the authoritative state catalog.
2. Parse each SKILL.md → find the section containing state definitions (see Appendix B for parsing grammar)
3. Extract state names using the defined heuristic (bullet lists with backtick-quoted state names, or explicit `State: <name>` declarations)
4. Validate extracted tokens against the canonical state catalog.
5. Parse corresponding HANDOFFS.md → build HandoffGraph (see Appendix C)
6. For each state in SKILL.md, check if it exists as a node in HandoffGraph
7. Report states that exist in SKILL.md but not in HANDOFFS.md

**Parsing heuristic (see Appendix B for full grammar):**
- Search for section headings matching: `/^(##?\s+(The Loop|State Model|States|Loop States))/i`
- Within the section, extract state names from:
  - Bullet list items with backtick quotes: `- \`ready-for-dev\``
  - Code block labels: `state: ready-for-dev`
  - ASCII art labels: text that appears after `│` or `┌` in box diagrams

**Example failure (today):**
```
STATE-003: State referenced in SKILL.md but absent from handoff graph
  → skills/development/running-atdd-sessions/SKILL.md
  → section: "The Loop"
  → state: "ready-for-qa"
  → present in loop diagram but not in HANDOFFS.md
  → fix: add "ready-for-qa" node and transitions in HANDOFFS.md
```

### 6.4 `bidirectional_state` — BSTATE-001 to BSTATE-099

**Question:** Does every state in the handoff graph have a defining skill?

**Algorithm:**
1. Build HandoffGraph from all HANDOFFS.md files
2. For each state node, check if it appears in at least one skill's state definition section
3. Report states that exist in the graph but are not defined by any skill

**Example failure:**
```
BSTATE-001: State in handoff graph but undefined in any skill
  → skills/meta/using-forge/HANDOFFS.md
  → state: "in-qa"
  → appears as transition target but no SKILL.md defines what "in-qa" means
  → fix: add "in-qa" to the state model of the skill that owns this state
```

### 6.5 `handoff_graph` — GRAPH-001 to GRAPH-099

**Question:** Is the handoff graph complete and navigable?

**Checks:**
- **No dead-end states** (except terminal): Every state must have ≥1 outbound edge unless it's in `terminal_states`
- **All states reachable from entry points**: Run BFS from ALL `entry_points` in the fixture, verify all non-terminal states are reachable from at least one entry point
- **Terminal states are terminal**: States in `terminal_states` must have 0 outbound edges

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

### 6.6 `cross_references` — REF-001 to REF-099

**Question:** Do all cross-references in skill files point to existing skills?

**Checks:**
- Every skill name referenced in a HANDOFFS.md arrow edge must exist as a directory under `skills/`
- Every skill name referenced in a SKILL.md "calls `skill-name`" must exist
- Every skill mentioned in README.md must exist in the repo
- Every path reference (e.g., `skills/quality/finishing-stories/`) must resolve to an existing directory

**Example failures (today):**
```
REF-001: README references non-existent skill
  → README.md
  → mentions: "writing-contract-tests"
  → not found in: skills/development/
  → fix: create skill or remove from README

REF-002: README references non-existent skill
  → README.md
  → mentions: "skills/writing-skills/"
  → not found anywhere in skills/
  → fix: create skill or remove from README
```

### 6.7 `skill_completeness` — SKILL-001 to SKILL-099

**Question:** Does every skill have the required SKILL.md sections?

**Checks:**
- Every skill directory has `SKILL.md`
- `SKILL.md` has required sections: `description`, `The Loop` (or `State Model`), `rules`
- L1-RIGID skills have additional required sections: `entry_conditions`, `halt_conditions`

**Example failure:**
```
SKILL-003: Missing required section
  → skills/meta/resuming-sessions/SKILL.md
  → missing: "Rules" section
  → fix: add "## Rules" section to SKILL.md
```

### 6.8 `loop_section_order` — ORDER-001 to ORDER-099

**Question:** Do LOOP.md sections appear in the canonical order?

**Algorithm:**
1. Parse each existing LOOP.md into ordered section list
2. Compare against `fixtures/loop-contract.yaml` → `required_loop_sections` order
3. Report sections that are present but out of order

**Canonical order:** Entry Conditions → Loop State Schema → Single Iteration Step → Proof of Progress → State Transition Rule → Halt Conditions → Handoff Target

**Example failure:**
```
ORDER-001: LOOP.md sections out of order
  → skills/development/running-atdd-sessions/LOOP.md
  → "Halt Conditions" appears before "State Transition Rule"
  → expected order: ... State Transition Rule → Halt Conditions → Handoff Target
  → fix: reorder sections to match canonical order
```

### 6.9 `simulation` — SIM-001 to SIM-099

**Question:** Can the delivery loop actually execute deterministically without getting stuck?

**Algorithm:**
1. Read `project.constraints.yaml` → verify the `loop:` block exists and contains:
   - Required commands: `outer_at_command`, `component_test_command`, `cdc_test_command`, `regression_command`, `smoke_command`
   - Required budgets: `max_iterations_per_subslice`, `max_no_progress_retries`, `max_story_loop_minutes`, `max_story_loop_cost_usd`
2. Build the skill-to-skill handoff graph from `HANDOFFS.md` transitions.
3. For each loop skill, walk the graph and verify it can reach a skill with no outbound skill handoffs (a terminal skill, e.g. `finishing-stories` or `loop-guardian` halted).
4. Report infinite cycles and unreachable loop skills.

**Note:** This is an error-level diagnostic. It is deterministic structural simulation, not a behavioral agent test.

**Example:**
```
SIM-001: Entry point `in-analysis` cannot reach any terminal or halted state
  → skills/meta/using-forge/HANDOFFS.md
  → fix: add outbound transitions from this entry to a terminal/halted state

SIM-002: Loop skill `running-atdd-sessions` cannot reach a terminal skill
  → project.constraints.yaml
  → fix: add outbound handoffs that eventually lead to a terminal skill
```

### 6.10 `loop_state_files` — LSTATE-001 to LSTATE-099

**Question:** Do the operational loop-state files exist and have required fields?

**Checks:**
- `docs/inception.loop.md` exists and has fields: `current_phase`, `completed_artifacts`, `pending_approvals`
- `docs/iteration-board.loop.md` exists and has fields: `active_iteration`, `iteration_0_status`, `awaiting_human_gate`
- `stories/*.loop.md` template exists with fields: `current_loop`, `current_ac`, `last_proof_command`, `stall_counter`, `resume_cursor`

**Example failure (today):**
```
LSTATE-001: Missing loop-state file
  → docs/inception.loop.md
  → required by perfect loop plan Section 3
  → fix: create file with operational state for inception phases

LSTATE-002: Missing loop-state file
  → docs/iteration-board.loop.md
  → required by perfect loop plan Section 3
  → fix: create file with iteration governance state
```

### 6.11 `constraints_loop_block` — CONS-001 to CONS-099

**Question:** Does `project.constraints.yaml` have the `loop:` block?

**Algorithm:**
1. Parse `project.constraints.yaml`
2. Check for `loop:` top-level key
3. Verify required fields: `outer_at_command`, `component_test_command`, `cdc_test_command`, `regression_command`, `smoke_command`
4. Verify budget fields: `max_iterations_per_subslice`, `max_no_progress_retries`, `max_story_loop_minutes`

**Example failure (today):**
```
CONS-001: Missing loop block in project.constraints.yaml
  → project.constraints.yaml
  → missing: `loop:` top-level key
  → fix: add loop commands and budget constraints per perfect loop plan Section 4
```

### 6.12 `fixture_drift` — DRIFT-001 to DRIFT-099

**Question:** Does the fixture match the repo reality?

**Algorithm:**
1. List all skills from `skills/*/*/` → auto-discovered set
2. Compare against `fixtures/loop-contract.yaml` → `loops:` list
3. Report:
   - Skills in fixture but missing from repo (e.g., `loop-guardian`)
   - Skills in repo but missing from fixture (heuristic: has state_model + HANDOFFS.md + L1/L2)

**Hybrid approach:** The harness auto-discovers loop-worthy skills from the repo, then uses the fixture as the authority for which ones MUST have LOOP.md.

**Example:**
```
DRIFT-001: Fixture skill missing from repo
  → loop-guardian
  → fixture says has_loop: true
  → directory not found: skills/meta/loop-guardian/
  → fix: create skill directory or remove from fixture

DRIFT-002: Repo skill missing from fixture
  → skill: writing-contract-tests (if it existed)
  → heuristic: has state_model transitions + HANDOFFS.md
  → not in fixture loops list
  → fix: add to fixture or confirm it's not a loop-worthy skill
```

### 6.13 `fixture_category` — CAT-001 to CAT-099

**Question:** Does the fixture's category match the actual directory?

**Algorithm:**
For each skill in fixture, check if `skills/{fixture.category}/{skill.name}/` exists. Report mismatches.

**Example (fixed in this spec revision):**
```
CAT-001: Fixture category mismatch
  → skill: securing-pipeline
  → fixture says: category: iteration-zero
  → actual path: skills/acceptance-delivery/securing-pipeline/
  → fix: update fixture category to acceptance-delivery
```

---

## 7. Diagnostic Code Registry

Each validator has a unique prefix and numeric range. This table is the single source of truth for diagnostic codes.

| Validator | Prefix | Range | Description |
|---|---|---|---|
| `loop_completeness` | LOOP | 001–099 | Missing LOOP.md for fixture-required skills |
| `loop_sections` | LOOP | 100–199 | Missing or extra sections in existing LOOP.md |
| `loop_section_order` | ORDER | 001–099 | Sections out of canonical order in LOOP.md |
| `state_machine` | STATE | 001–099 | States in SKILL.md not found in HANDOFFS.md |
| `bidirectional_state` | BSTATE | 001–099 | States in HANDOFFS.md not defined in any SKILL.md |
| `handoff_graph` | GRAPH | 001–099 | Dead-end states, unreachable states, terminal violations |
| `cross_references` | REF | 001–099 | Broken skill references in HANDOFFS.md, README |
| `skill_completeness` | SKILL | 001–099 | Missing required sections in SKILL.md |
| `simulation` | SIM | 001–099 | Loop cannot execute deterministically (budgets, cycles, reachability) |
| `loop_state_files` | LSTATE | 001–099 | Missing operational loop-state files (*.loop.md) |
| `handoff_completeness` | HANDOFF | 001–099 | Loop skill missing HANDOFFS.md |
| `constraints_loop_block` | CONS | 001–099 | Missing `loop:` block in project.constraints.yaml |
| `fixture_drift` | DRIFT | 001–099 | Fixture/repo mismatch (missing skills, extra skills) |
| `fixture_category` | CAT | 001–099 | Fixture category does not match actual directory |

**Adding a new validator:** Pick the next available prefix (3–4 uppercase letters, not in use). Use range 001–099. Document here.

---

## 8. The Fixture File

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
    level: L1-RIGID
    owner: [all-agents]
    has_loop: true
    description: Conductor loop — session start, precedence, iteration governance

  - skill: resuming-sessions
    category: meta
    level: L1-RIGID
    owner: [all-agents]
    has_loop: true
    description: Session resume loop — crash recovery, proof-driven resume

  - skill: loop-guardian
    category: meta
    level: L1-RIGID
    owner: [all-agents]
    has_loop: true
    description: Pre-flight loop guardian — stall detection, budget brakes, human gates

  - skill: facilitating-inception
    category: discovery
    level: L2-GUIDED
    owner: [po-agent, ux-agent]
    has_loop: true
    description: Inception loop — Lean Canvas, Empathy Map, Trade-off Sliders

  - skill: facilitating-event-storming
    category: discovery
    level: L2-GUIDED
    owner: [po-agent, ux-agent]
    has_loop: true
    description: Event storming loop — domain event discovery, CONTEXT.md generation

  - skill: establishing-ubiquitous-language
    category: discovery
    level: L2-GUIDED
    owner: [po-agent]
    has_loop: true
    description: Ubiquitous language loop — CONTEXT.md maintenance

  - skill: writing-stories
    category: discovery
    level: L2-GUIDED
    owner: [po-agent]
    has_loop: true
    description: Story writing loop — four-gate review, INVEST validation

  - skill: building-iteration-map
    category: discovery
    level: L3-MECH
    owner: [po-agent]
    has_loop: true
    description: Iteration mapping loop — topological sort, dependency resolution

  - skill: deciding-architecture
    category: architecture
    level: L2-GUIDED
    owner: [architect-agent]
    has_loop: true
    description: Architecture loop — ADR lifecycle, scope pause/resume

  - skill: bootstrapping-project
    category: iteration-zero
    level: L3-MECH
    owner: [devops-agent]
    has_loop: true
    description: Iteration 0 bootstrap loop — CI/CD, environments, feature flags

  - skill: validating-test-harness
    category: iteration-zero
    level: L2-GUIDED
    owner: [qa-agent, devops-agent]
    has_loop: true
    description: Test harness validation loop — gate before Iteration 1

  - skill: securing-pipeline
    category: acceptance-delivery
    level: L2-GUIDED
    owner: [secops-agent, devops-agent]
    has_loop: true
    description: Pipeline security loop — SAST/DAST gates, continuous compliance

  - skill: running-atdd-sessions
    category: development
    level: L1-RIGID
    owner: [developer-agent]
    has_loop: true
    sub_loops:
      - running-tdd-loops
      - running-desk-checks
    description: ATDD delivery loop — outer AT RED → sub-slices → GREEN

  - skill: running-tdd-loops
    category: development
    level: L1-RIGID
    owner: [developer-agent]
    has_loop: true
    description: TDD inner loop — FE component RED→GREEN→REFACTOR, BE CDC RED→GREEN→REFACTOR

  - skill: writing-acceptance-tests
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: Acceptance test writing loop — outer AT creation per AC

  - skill: running-desk-checks
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: Desk check loop — per-AC UI verification

  - skill: running-regression-suite
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: Regression loop — full suite on test environment

  - skill: approving-stories
    category: acceptance-delivery
    level: L3-MECH
    owner: [po-agent]
    has_loop: true
    description: PO acceptance loop — UI smoke test per story

  - skill: finishing-stories
    category: acceptance-delivery
    level: L3-MECH
    owner: [po-agent, devops-agent]
    has_loop: true
    description: Release loop — flag flip, smoke test, Linear update

  - skill: managing-feature-flags
    category: acceptance-delivery
    level: L3-MECH
    owner: [devops-agent]
    has_loop: true
    description: Feature flag lifecycle loop — create → off → on → retired

  - skill: threat-modeling
    category: acceptance-delivery
    level: L2-GUIDED
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
      aliases: ["The Loop", "Loop States", "Loop State", "States"]
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
  # Note: awaiting-human-gate-6 and awaiting-human-gate-7 are conceptual states
  # from the perfect loop plan. They are not yet encoded in HANDOFFS.md.
  # When added, they must have 0 outbound edges.

entry_points:
  - in-analysis          # Actual graph state — stories start here

entry_triggers:
  - new-project          # Human event, not a graph node — triggers inception loop
  - resume-session       # Human event, not a graph node — triggers resuming-sessions
```

---

## 9. Expected Output (Running Today)

```bash
$ cd tools/contract-tests && cargo test

running 12 test suites

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
    → skills/development/running-atdd-sessions/SKILL.md
    → section: "The Loop"
    → state: "ready-for-qa"
    → fix: add to HANDOFFS.md with transitions

test tests::bidirectional_state ... FAILED
  BSTATE-001: State in handoff graph but undefined in any skill
    → skills/meta/using-forge/HANDOFFS.md
    → state: "in-qa"
    → fix: add "in-qa" to the state model of the skill that owns this state

test tests::handoff_graph ... FAILED
  GRAPH-002: Dead-end state
    → skills/meta/using-forge/HANDOFFS.md
    → state: "in-qa" has 0 outbound edges
    → expected: transition to "ready-for-acceptance" or "ready-for-dev"

test tests::cross_references ... FAILED
  REF-001: README references non-existent skill
    → README.md
    → mentions: "writing-contract-tests"
    → not found in: skills/development/
  
  REF-002: README references non-existent skill
    → README.md
    → mentions: "skills/writing-skills/"
    → not found anywhere in skills/

test tests::skill_completeness ... FAILED
  SKILL-003: Missing HANDOFFS.md
    → skills/meta/resuming-sessions/
    → fix: create HANDOFFS.md with inbound/outbound edges

test tests::loop_section_order ... ok (0 failures)

test tests::simulation ... ok (0 failures)

test tests::loop_state_files ... FAILED
  LSTATE-001: Missing loop-state file
    → docs/inception.loop.md
    → fix: create per perfect loop plan Section 3

  LSTATE-002: Missing loop-state file
    → docs/iteration-board.loop.md
    → fix: create per perfect loop plan Section 3

test tests::constraints_loop_block ... FAILED
  CONS-001: Missing loop block in project.constraints.yaml
    → missing: `loop:` top-level key
    → fix: add loop commands and budgets per perfect loop plan

test tests::fixture_drift ... FAILED
  DRIFT-001: Fixture skill missing from repo
    → loop-guardian
    → directory not found: skills/meta/loop-guardian/
    → fix: create skill directory or remove from fixture

test tests::loop_sections ... ok (0 failures)

test tests::fixture_category ... ok (0 failures)

failures: 7, success: 5
total diagnostics: 31 failures, 14 warnings
```

> The exact failure count depends on the current repo state. The first run is
> expected to report many `LOOP-001`/`DRIFT-001`-class diagnostics, confirming
> the harness detects the unimplemented perfect-loop plan.

---

## 10. Success Criteria

The harness is complete when:

1. ✅ `cargo test` runs without compilation errors
2. ✅ `cargo test` produces a diagnostic report with file/line context
3. ✅ Running on the current repo produces ≥20 failures (proves the harness is detecting real gaps)
4. ✅ Every failure has a specific fix instruction
5. ✅ The failure report is ordered by priority (L1-RIGID skills first, then L2-GUIDED, then L3-MECH)
6. ✅ Auto-discovery works: new skills in `skills/*/*/` are detected; loop-worthiness derived from heuristics; fixture skills MUST have LOOP.md
7. ✅ Fixture drift is caught: skills in fixture but not repo → error; repo skills matching heuristics but not in fixture → warning
8. ✅ Bidirectional state consistency: every state in HANDOFFS.md is defined in some SKILL.md

---

## 11. Error Handling

### Malformed Markdown

If a parser encounters malformed markdown (unclosed code blocks, invalid YAML frontmatter, etc.):
- Emit a **warning-level** diagnostic with code `PARSER-001`
- Include the file path and approximate line number
- Continue parsing the remainder of the file (best-effort recovery)
- Do not panic or abort the entire test suite

### Missing Files

If a file referenced by the fixture does not exist:
- Emit an **error-level** diagnostic
- This is expected for LOOP.md files (they are the gaps the harness is designed to find)
- For SKILL.md or HANDOFFS.md: this indicates a fixture error, not a repo error

### Partial Parse Results

If a file parses partially (some sections found, others not):
- Report what was found
- Report what was missing
- Do not assume missing sections mean the file is completely invalid

---

## 12. Suppression / Waiver Mechanism

Some failures may be temporarily acceptable (e.g., a skill is being actively developed and its LOOP.md is not yet written). The harness supports suppression via a `waivers.yaml` file:

```yaml
# waivers.yaml — suppress specific diagnostics
waivers:
  - code: LOOP-001
    skill: loop-guardian
    reason: "Skill is planned for Phase 4; directory will be created then"
    expires: 2026-07-01
  - code: LSTATE-001
    file: docs/inception.loop.md
    reason: "Planned for Phase 2; operational state files not yet created"
    expires: 2026-07-15
```

**Rules:**
- Every waiver must have a `reason` and an `expires` date
- Expired waivers are treated as regular failures
- Waivers are reviewed quarterly and should not be permanent
- Waivers do not reduce the diagnostic count in output; they are annotated with `[waived]`

---

## 13. Adding a New Validator

1. Pick an unused prefix from the registry (Section 7)
2. Create `src/validators/{name}.rs`
3. Implement the `Validator` trait:
   ```rust
   pub trait Validator {
       fn name(&self) -> &str;
       fn validate(&self, repo: &Repo) -> Vec<Diagnostic>;
   }
   ```
4. Register in `src/validators/mod.rs`
5. Add tests in `tests/integration.rs`
6. Update Section 7 (Diagnostic Code Registry)

---

## 14. Deferrals (Layer 2)

These are out of scope for the initial implementation but documented for future work:

| Feature | Description | When |
|---|---|---|
| Property-based testing | Generate random handoff graphs and verify invariants hold | After initial release |
| CI integration | Run `cargo test` in GitHub Actions on every PR | After test suite stabilizes |
| Coverage report | Which skills/states/transitions are covered by the deterministic simulator | After test suite stabilizes |

---

## 15. Appendix: Relationship to Behavioral Evals

Behavioral evals test whether an agent follows a skill correctly when given a prompt. They require an LLM participant and are intentionally kept outside this harness so that `cargo test` stays fast and deterministic.

The contract test harness now includes **Layer 2 simulated execution**, which deterministically walks the skill handoff graph and validates that the loop mechanics are executable. It does not replace behavioral evals, but it removes the need for placeholder behavioral eval directories that are not automatically executable.

- **Simulator** catches: "`running-atdd-sessions` has no path to a terminal skill" (structural deadlock)
- **Behavioral evals** catch: "The agent wrote implementation before seeing RED" (agent behavior)

Behavioral evals are not required by this harness.

---

## Appendix B — SKILL.md Parsing Grammar

### B.1 Section Detection

The parser must find the section containing state definitions. Search for headings matching (case-insensitive):

```regex
/^(#{1,3}\s+(The Loop|State Model|States|Loop States|Loop State))/i
```

If no matching heading is found, scan the **entire file** for state references (see B.2 Method 1). This is because states often appear inline in prose sections without a dedicated state model heading.

### B.2 State Extraction Heuristics

States are extracted from **all** SKILL.md content, not just the state model section. Methods are tried in order; results are merged and deduplicated.

**Method 1: Inline backtick references in prose (PRIMARY)**

This is the most common format in actual files. Scan the entire document for backtick-quoted tokens matching state naming conventions:

```markdown
Move story to `ready-for-qa` in Linear.
The story is now `in-dev`.
When `in-analysis` passes all gates...
```

**Extraction regex:**
```regex
/`([a-z][a-z0-9_-]*)`/g
```

Filter candidates against state name patterns (see B.3). Tokens like `npm`, `test`, `Linear` are filtered out by the pattern matcher.

**Method 2: Code blocks containing state mappings**

Code blocks (triple backticks) may contain state transitions in ASCII art, YAML, or plain text:

```
in-analysis → ready-for-dev → in-dev → ready-for-qa → in-qa → done
```

Extract all kebab-case tokens from these blocks.

**Method 3: Explicit state declarations (FALLBACK)**

Within the state model section (if found), look for:
```
- `state-name`          (bullet list with backtick-quoted state name)
State: state-name       (explicit "State:" prefix)
```

**Method 4: YAML frontmatter in code blocks (FALLBACK)**
```yaml
state_model:
  states:
    - ready-for-dev
    - in-dev
```

**Method 5: Table rows (FALLBACK)**
```
| State | Description |
|---|---|
| ready-for-dev | Developer can pull |
```

### B.3 State Name Validation

Extracted tokens are validated as state names if they match **at least one** of these criteria:

1. **Known state prefix:** Matches `^(ready-for|ready-to|in|done|awaiting)-[a-z0-9]+(-[a-z0-9]+)*$`
2. **Known terminal state:** Exactly `done`
3. **Known entry point:** Appears in fixture `entry_points` list
4. **Known terminal state:** Appears in fixture `terminal_states` list

**Anti-patterns (filtered out):**
- Single word without hyphen that is not `done` (e.g., `Linear`, `npm`, `test`)
- Contains uppercase letters
- Contains spaces
- Matches common non-state terms: `README`, `SKILL`, `HANDOFFS`, `CONTEXT`

### B.4 Section Extraction

For SKILL.md required section validation, extract top-level headings (`## Heading`) and match against `required_skill_sections` from the fixture. The fixture defines aliases for section name variants (e.g., "The Loop" matches the required section "State Model").

---

## Appendix C — HANDOFFS.md Parsing Grammar

HANDOFFS.md files use **two formats** that may appear in the same file:
1. **Prose format** (PRIMARY — used by 17 of 18 files): `##` headings with bold labels and explicit transitions
2. **ASCII tree format** (SECONDARY — used by `using-forge/HANDOFFS.md` only): Code blocks with `└→` arrows

The parser must detect which format(s) are present and extract from all of them.

### C.1 Prose Format (Primary)

Most HANDOFFS.md files use prose sections with explicit transition declarations.

**Pattern 1: Bold-labeled transitions**
```markdown
**On desk check APPROVED:**
Return to `running-atdd-sessions`. Preserve developer assignment.

**On desk check FAILED:**
Return to `running-atdd-sessions`. Story moves back to first pending AC.
```

**Extraction rules:**
1. Scan for lines containing backtick-quoted skill names after transition words: `return to`, `move to`, `hand off to`, `trigger`, `call`, `routes to`
2. Extract: `return to \`target-skill\`` → edge from current skill to target-skill
3. Also extract state names from the same line: `story moves back to first pending AC` → state references

**Pattern 2: Explicit state transitions**
```markdown
**Outbound**
- `ready-for-qa` → `running-regression-suite`
```

**Extraction:** Bullet list items with backtick states joined by arrows.

**Pattern 3: Gate tables**
```markdown
| Gate | Condition | Next |
|---|---|---|
| Gate 2 | UX approves | Gate 3 |
```

**Extraction:** Table rows where the "Next" column contains a gate number or skill name.

### C.2 ASCII Tree Format (Secondary)

`using-forge/HANDOFFS.md` uses ASCII trees inside triple-backtick code blocks.

**Tree syntax:**
```
skill-name
  └→ condition text → target-skill (agent-role) [state → next-state]
  └→ condition text → target-skill (agent-role)
```

**Parsing rules:**
1. Identify code blocks (triple backticks) containing tree lines
2. The line immediately before a `└→` block, if it contains a kebab-case skill name without markers, is the `from_skill`
3. Lines starting with whitespace + `└→` or `├→` are transition lines
4. Extract:
   - **Condition text**: text between `└→` and `→` (the arrow before target)
   - **Target skill**: text after `→` and before `(` or end of line
   - **Agent role**: text inside `()`
   - **State transition** (optional): text inside `[]` in the format `state → next-state`

**Example extraction:**
```
approving-stories
  └→ PASS → finishing-stories (po-agent + devops-agent) [story → ready-to-deploy]
```
Extracts:
- from_skill: "approving-stories"
- condition: "PASS"
- to_skill: "finishing-stories"
- agent: "po-agent + devops-agent"
- state_transition: "story → ready-to-deploy"

**Edge cases in tree format:**
- **"STOP" transitions:** `→ STOP; post to Linear; await human` — no target skill. Record as terminal transition.
- **Complex target lines:** `→ writing-stories back to in-analysis` — extract first kebab-case token as target skill (`writing-stories`); the rest (`back to in-analysis`) is state context.
- **Variable indentation:** Trees may use 2, 4, or 7 spaces. Indentation depth is ignored; only the `└→`/`├→` marker matters.
- **Agent labels as pseudo-skills:** Lines like `developer-agent:` and `qa-agent:` are not skills. They must be skipped (detected by `-agent` suffix).

### C.3 Mixed Format Files

`using-forge/HANDOFFS.md` contains BOTH prose sections AND ASCII tree code blocks. The parser must:
1. Extract from prose sections (Pattern 1–3)
2. Extract from code blocks (Pattern C.2)
3. Merge results, deduplicating edges

### C.4 State Node Extraction

States are added to the HandoffGraph as nodes from multiple sources:
- States referenced in `[]` brackets in tree format
- States mentioned in prose transition lines (e.g., "story moves to `ready-for-qa`")
- State names that appear as standalone backtick tokens in prose

If a state appears as a target but not as a source, it is still a valid node (it may be an entry point or terminal state).

### C.5 Edge Normalization

Extracted edges are normalized:
- Skill names are normalized to kebab-case
- State names are normalized to kebab-case
- Duplicates are deduplicated
- Self-loops (skill → same skill) are flagged as warnings
- Edges with no target skill (e.g., `→ STOP`) are recorded as terminal edges

---

*Spec approved for implementation. Next step: invoke `writing-plans` to create the implementation plan.*
