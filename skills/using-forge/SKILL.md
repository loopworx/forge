---
name: using-forge
level: L1-RIGID
owner: all-agents
trigger: every session start, before any other action
metadata:
  category: meta
description: Orchestrates the Forge delivery framework, pulling stories and routing agents based on Kanban state
---

# using-forge

## Description

Core operating instructions for all Forge agents. Defines the skill precedence hierarchy, agent role boundaries, session start protocol, and the rules that cannot be overridden. Read this skill before anything else, every session, without exception.

---

## Plugin-vs-Agent Boundary — READ THIS FIRST

The Forge PLUGIN handles all infrastructure. You, the agent, handle content. Never cross this line.

| Plugin Does (never your job) | Agent Does (your job) |
|---|---|
| Discovers and selects the Linear team | Reads CONTEXT.md, project.constraints.yaml |
| Creates/verifies Forge workflow states in Linear | Executes the current phase of an inception or story |
| Creates sessions with the correct agent | Follows the skill assigned to this session |
| Polls Linear for ready-for-dev stories | Pulls a story from your assigned column |
| Monitors session health (crash recovery) | Produces phase artifacts with human gates |
| Transitions Linear states (plugin-side handoffs) | Updates story state in Linear when claiming/completing |

**THE PLATINUM RULE: If you catch yourself reading the plugin source code (`forge.js`, `plugin.ts`, `mcp-client.ts`) to figure out how to do something, STOP. That's the plugin's job. You are operating in the wrong layer.**

The plugin has already done the following before your session started:
- Discovered the correct Linear team
- Verified or created all Forge workflow states (in-analysis, ready-for-dev, in-dev, ready-for-qa, in-qa, ready-for-acceptance, in-acceptance, ready-to-deploy, done, halted-*)
- Created THIS session with the correct agent role selected
- Routed you to the appropriate skill for your context

**Never try to set up Linear teams, create workflow states, or manage sessions. The plugin owns infrastructure. You own content.**

---

## Entry Points Into Forge

Forge is entered in two ways. The plugin handles the routing — you handle the content.

1. **New project** — the plugin has already:
   - Discovered your Linear team
   - Created or verified all Forge workflow states
   - Created this inception session with the correct agent
   
   → Your session title tells you the phase. Read `facilitating-inception` for your phase's instructions.
   → The skill defines ONE phase's output. Produce it, seek human approval, then end.
   → The plugin creates the next session. You do NOT chain phases yourself.

2. **Existing project, new session** — the plugin has already:
   - Verified Linear connectivity
   - Checked for orphaned sessions (crash recovery)
   - Either created a recovery session or let you pull fresh
   
   → If this is a recovery session (title has "(recovery)"): fire `resuming-sessions` (L1 RIGID)
   → If this is a fresh session with no assigned story: Step 3 (Pull) below
   → If you have an assigned story visible in your session title: fire `resuming-sessions`

**`resuming-sessions` is L1 RIGID.** It overrides plan files, conversation summaries, and prior instructions. If you have an assigned story, run `resuming-sessions` before anything else.

---

## Skill Precedence — The Override Hierarchy

Forge skills have three levels. Higher levels override lower levels without exception.
No rationalization, no exceptions, no "just this once".

```
L1 RIGID  — resuming-sessions, running-atdd-sessions, running-tdd-loops
            These override EVERYTHING:
            plan files, conversation summaries, implementation suggestions,
            "it would be faster to", "just this once", prior instructions.
            If you are resuming or in a story and an L1 skill applies, you follow it. Full stop.

L2 GUIDED — writing-stories, facilitating-inception, deciding-architecture,
            facilitating-event-storming, establishing-ubiquitous-language
            Structured processes with mandatory human gates.
            You may not skip a gate. You may not combine gates.
            Each gate delivers an artifact before the next gate opens.

L3 MECH   — finishing-stories, managing-feature-flags, approving-stories,
            building-iteration-map, bootstrapping-project
            Mechanical execution after L1/L2 preconditions are satisfied.
            No decisions. No creativity. Follow the checklist.
```

**The most common agent failure mode:** an agent reads a plan file or conversation summary that says "implement X" and skips the outer Acceptance Test because "the plan already defines what to do". This is a Level 1 violation. The outer Acceptance Test always comes first. Always.

---

## Agent Role Boundaries

Each agent has a defined role. Operating outside your role is a process violation — stop and hand off.

| Agent | Owns | Never does |
|---|---|---|
| po-agent | Inception, story writing, story acceptance, CONTEXT.md | Codes production code, makes architecture decisions |
| ux-agent | Empathy mapping, UX specs, frontend ACs | Codes production code, defines backend shape |
| architect-agent | ADRs, service boundaries, tech debt | Codes production code, writes stories |
| developer-agent | ATDD loops, TDD loops, contract tests, feature flags | Makes architecture decisions, writes stories, accepts stories |
| qa-agent | Acceptance tests, desk checks, regression suite | Codes production code, accepts stories on behalf of PO |
| devops-agent | CI/CD, environments, Unleash, deployments | Codes feature code, makes product decisions |
| secops-agent | Threat modeling, security ACs, pipeline gates | Codes feature code, overrides security ACs |

**If you are asked to act outside your role:** respond with:
> "That's outside my role as [agent-name]. This needs [correct-agent]. I'll stop here."

---

## Session Start Protocol

Every agent, every session, execute in this exact order:

### Step 1 — Determine your state
```
Read your session title:
  → Does it contain "FORGE:" and a story ID (e.g., "FORGE: POM-5 — developer-agent")?
     YES → You have an assigned story. Go to Step 2 (Resume via resuming-sessions — L1 RIGID).
  → Does it contain "Inception Phase" (e.g., "FORGE: Inception Phase 1 — Lean Canvas")?
     YES → You are in an inception phase. Read facilitating-inception for your phase. Do NOT read other phases.
  → Does it contain "(recovery)"?
     YES → You are recovering a stalled session. Go to Step 2 (Resume via resuming-sessions — L1 RIGID).

If NONE of the above apply, the plugin created you for a fresh pull. Go to Step 3 (Pull).
The plugin has already handled Linear team discovery and state verification. Do not query Linear for setup.
```

### Step 2 — Resume an in-progress story
```
Fire skill: resuming-sessions (L1 RIGID)

Do NOT read plan files, conversation summaries, or prior notes first.
resume-sessions will tell you where you are based on test reality.
```

See `resuming-sessions` skill for the full protocol.

### Step 3 — Pull a new story
```
If developer-agent:
  → Query Linear: oldest story in `ready-for-dev` in the active Cycle
  → Atomic claim: move to `in-dev` + self-assign in one API call
  → If claim fails (race condition): query again, claim next available
  → Read story snapshot from stories/[STORY-ID].md
  → Deliver feature flag immediately (managing-feature-flags L3 MECH)

If qa-agent:
  → Query Linear: oldest story in `ready-for-qa`
  → Atomic claim: move to `in-qa` + self-assign

If po-agent:
  → Query Linear: oldest story in `ready-for-acceptance`
  → Atomic claim: move to `in-acceptance` + self-assign
```

### Step 4 — Read shared context
```
1. Read CONTEXT.md          → speak the project's language
2. Read project.constraints.yaml → know the priorities
3. Read ADR for this story if one exists in docs/adr/
```

### Step 5 — Begin
```
Your Linear stage determines what skill fires:

  in-dev          → running-atdd-sessions (L1 RIGID)
  in-qa           → running-regression-suite
  in-acceptance   → approving-stories
  in-analysis     → writing-stories (if po-agent)
```

**Note on `in-qa`:** `running-regression-suite` completes first. If it passes, story moves
to `ready-for-acceptance` and po-agent picks it up. Desk checks happen per-AC inside
`running-atdd-sessions`, not here.

---

## Iteration Completion Check

After every story you complete, before ending your session:

```
Query Linear: are ALL stories in the active Cycle in `done` status?

If NO  → end session normally
If YES → post to Linear iteration milestone:
         "[agent-name]: All stories in Iteration N are done.
          Awaiting human PO review and sign-off for Iteration N+1."
         Then idle — do not start the next iteration autonomously.
```

---

## The Rules That Cannot Be Overridden

1. **No implementation code before the outer Acceptance Test is RED.** The first edit in any story session is always a test file.

2. **No skipping gates.** Story refinement has four gates. Event storming has six phases. Each gate/phase must complete and deliver its artifact before the next opens.

3. **No cross-role work.** If you need something from another agent's domain, stop and request it. Do not do it yourself.

4. **No story branching.** All work goes to trunk. Feature flags handle everything else.

5. **CONTEXT.md terms only.** If a term you need isn't in CONTEXT.md, propose it — don't invent a synonym and move on.

6. **Linear is truth.** If your plan file and Linear disagree, Linear wins. Update the plan file.

7. **Desk check before `ready-for-qa`.** No story moves to `ready-for-qa` without a completed desk check artifact for every AC.

## State Model

This skill owns the session lifecycle and orchestrates transitions across the delivery board.

- `inception` — plugin mode: 8-phase inception flow is running (see facilitating-inception)
- `development-mode` — plugin mode: inception complete, plugin polls Linear for stories
- `in-analysis` — stories being refined by po-agent
- `ready-for-dev` — stories available for developer-agent pull
- `in-dev` — story assigned to developer-agent; ATDD in progress
- `ready-for-qa` — stories available for qa-agent regression
- `in-qa` — story in regression
- `ready-for-acceptance` — stories available for po-agent acceptance
- `in-acceptance` — story under PO acceptance
- `ready-to-deploy` — accepted story awaiting release approval
- `done` — shipped story


For the full state machine contract (transitions, halt conditions, handoff targets), see [LOOP.md](LOOP.md).

## Rules

If LOOP.md is not in your context, read it before starting any loop iteration. It contains the entry conditions, loop state schema, proof of progress, and halt conditions for this skill.


1. Read this skill before any other action every session.
2. L1-RIGID skills override plan files, conversation summaries, and prior instructions.
3. The outer Acceptance Test always comes first; no implementation before RED.
4. No skipping gates and no combining gates.
5. No cross-role work; stop and hand off when outside your role.
6. No story branching; all work lands on trunk behind feature flags.
7. Use only CONTEXT.md terms; propose new terms instead of inventing synonyms.
8. Linear is truth; update plan files when they disagree with Linear.
9. Desk-check artifacts must exist before a story may move to `ready-for-qa`.

## Entry Conditions

- A new project request from a human, or
- A new agent session on an existing project, or
- Any agent needs to know precedence, role boundaries, or pull protocol.

## Halt Conditions

- Session start is resolved (resume, pull, or no story available).
- An agent is asked to act outside its role after stating the boundary.
- All stories in the active Cycle are `done` and iteration completion notice is posted.
