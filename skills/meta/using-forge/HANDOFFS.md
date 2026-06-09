# using-forge — Handoff Map

This is the master handoff reference. Every skill transition in the delivery process is listed here.

Phase numbers in parentheses refer to the internal phase numbering of the named skill, not a global sequence.
Read each skill's SKILL.md to see its phases defined.

```
facilitating-inception
  └→ inception Phase 4 (Event Storming)    → facilitating-event-storming (po-agent + ux-agent)
  └→ inception Phase 5 (Story Writing)     → writing-stories (po-agent)
  └→ inception Phase 6 (Iteration Mapping) → building-iteration-map (po-agent)

facilitating-event-storming
  └→ event-storming Phase 6 (Ubiquitous Language) → establishing-ubiquitous-language (po-agent)
  └→ on complete (all 6 phases done)               → writing-stories (po-agent)

establishing-ubiquitous-language
  └→ on complete → CONTEXT.md committed; unblocks all agents

writing-stories
  └→ gate pass (all 4 gates)     → building-iteration-map (po-agent)
  └→ gate fail (any gate)        → back to PO draft (same skill, Gate 1)
  └→ story has security surface  → threat-modeling (secops-agent) before ready-for-dev

building-iteration-map
  └→ on complete → bootstrapping-project (devops-agent) [Iteration 0]

bootstrapping-project
  └→ on complete → validating-test-harness (qa-agent)

validating-test-harness
  └→ PASS → Iteration 1 opens; developer-agents may pull from ready-for-dev
  └→ FAIL → blocks Iteration 1; back to devops-agent

deciding-architecture
  └→ ADR accepted → unblocks developer-agent for the affected story

running-atdd-sessions
  └→ each AC complete              → running-desk-checks (qa-agent)
  └→ desk check approved           → next AC in same skill
  └→ all ACs + desk checks done    → story moves to ready-for-qa
  └→ architecture decision needed  → pauses; deciding-architecture (architect-agent)

running-desk-checks
  └→ APPROVED → developer-agent continues to next AC
  └→ FAILED   → story stays in-dev; developer-agent fixes and re-triggers

running-regression-suite
  └→ PASS → story moves to ready-for-acceptance; approving-stories (po-agent)
  └→ FAIL → story moves to ready-for-dev; developer-agent pulls

approving-stories
  └→ PASS → story moves to ready-to-deploy; HUMAN approves
  └→ FAIL → story moves to ready-for-dev; developer-agent pulls

finishing-stories
  └→ flag flipped + smoke pass → story moves to done
  └→ smoke fail                → flag flipped OFF; story to ready-for-dev
  └→ all stories done          → iteration-completion check (using-forge protocol)
```
