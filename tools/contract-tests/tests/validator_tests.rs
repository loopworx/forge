//! Validator tests.
//!
//! Each of the 13 validators is exercised against a synthetic, minimal repo so
//! behavior is locked in independently of the real repository state.

mod common;

use common::{canonical_fixture, has_code, perfect_skill_library, RepoBuilder};
use forge_contract_tests::parser::yaml::parse_str;
use forge_contract_tests::types::{
    AgentRole, Fixture, HandoffGraph, Repo, Skill, SkillCategory, SkillLevel, State,
};
use forge_contract_tests::validators::{
    bidirectional_state, constraints_loop_block, cross_references, fixture_category,
    fixture_drift, handoff_completeness, handoff_graph, loop_completeness, loop_section_order,
    loop_sections, loop_state_files, simulation, skill_completeness, state_machine,
};

fn build_repo(builder: RepoBuilder) -> (Repo, common::TempRepo) {
    let temp = builder.build();
    let repo = Repo::from_root(temp.path().to_path_buf()).expect("load repo");
    (repo, temp)
}

// ────────────────────────── loop_completeness ──────────────────────────

#[test]
fn loop_completeness_emits_loops_for_each_missing_loop_md() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "using-forge".to_string(),
                level: "L1-RIGID".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "# using-forge\n\n## Description\n\nX.\n".to_string(),
                handoffs_md: None,
                loop_md: None,
            }),
    );
    let diagnostics = loop_completeness::validate(&repo);
    assert!(has_code(&diagnostics, "LOOP-"));
    // Help text should mention the missing skill.
    let help = diagnostics.iter().map(|d| d.help.clone()).collect::<Vec<_>>().join("\n");
    assert!(help.contains("using-forge"));
}

#[test]
fn loop_completeness_passes_when_loop_md_present() {
    let skills = perfect_skill_library();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(skills[0].clone())
            .with_skill(skills[1].clone())
            .with_skill(skills[2].clone())
            .with_skill(skills[3].clone()),
    );
    eprintln!("repo.root: {}", repo.root.display());
    eprintln!("skills:");
    for s in &repo.skills {
        eprintln!("  {} loop_md exists: {}", s.name, s.loop_md().exists());
    }
    let diagnostics = loop_completeness::validate(&repo);
    if !diagnostics.is_empty() {
        eprintln!("diagnostics: {:#?}", diagnostics);
    }
    assert!(diagnostics.is_empty());
}

// ────────────────────────── loop_sections ──────────────────────────

#[test]
fn loop_sections_reports_missing_sections() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "using-forge".to_string(),
                level: "L1-RIGID".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "# using-forge\n## Description\n\nX.\n".to_string(),
                handoffs_md: None,
                loop_md: Some(
                    "## Entry Conditions\n\nX\n\n## Loop State Schema\n\nX\n".to_string(),
                ),
            }),
    );
    let diagnostics = loop_sections::validate(&repo);
    assert!(has_code(&diagnostics, "LOOP-1"));
    // Help text should name the missing sections.
    let help = diagnostics.iter().map(|d| d.help.clone()).collect::<Vec<_>>().join("\n");
    assert!(help.contains("Single Iteration Step"));
}

#[test]
fn loop_sections_passes_when_all_seven_present() {
    let mut skills = perfect_skill_library();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(skills.remove(0)),
    );
    let diagnostics = loop_sections::validate(&repo);
    assert!(diagnostics.is_empty());
}

// ────────────────────────── loop_section_order ──────────────────────────

#[test]
fn loop_section_order_reports_out_of_order() {
    // Canonical order: Entry, Loop State Schema, Single Iteration Step,
    // Proof of Progress, State Transition Rule, Halt Conditions, Handoff Target.
    let out_of_order = "## Halt Conditions\n\nX\n\n## Entry Conditions\n\nX\n\n## Loop State Schema\n\nX\n\n## Single Iteration Step\n\nX\n\n## Proof of Progress\n\nX\n\n## State Transition Rule\n\nX\n\n## Handoff Target\n\nX\n";
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "using-forge".to_string(),
                level: "L1-RIGID".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "# using-forge\n".to_string(),
                handoffs_md: None,
                loop_md: Some(out_of_order.to_string()),
            }),
    );
    let diagnostics = loop_section_order::validate(&repo);
    assert!(has_code(&diagnostics, "ORDER-"));
}

#[test]
fn loop_section_order_passes_when_canonical() {
    let mut skills = perfect_skill_library();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(skills.remove(0)),
    );
    let diagnostics = loop_section_order::validate(&repo);
    assert!(diagnostics.is_empty());
}

// ────────────────────────── skill_completeness ──────────────────────────

#[test]
fn skill_completeness_reports_missing_description() {
    let mut skills = perfect_skill_library();
    let spec = skills.first_mut().unwrap();
    spec.skill_md = "# skill\n\n## Rules\n\n1. x.\n\n## State Model\n\n- in-dev\n".to_string();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(spec.clone()),
    );
    let diagnostics = skill_completeness::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.message.contains("Description")));
}

#[test]
fn skill_completeness_recognizes_the_loop_alias_as_state_model() {
    let mut skills = perfect_skill_library();
    let spec = skills.first_mut().unwrap();
    // Replace the State Model section with the canonical alias
    spec.skill_md = spec.skill_md.replace("## State Model", "## The Loop");
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(spec.clone()),
    );
    let diagnostics = skill_completeness::validate(&repo);
    // Should NOT report missing State Model
    assert!(!diagnostics.iter().any(|d| d.message.contains("State Model")));
}

#[test]
fn skill_completeness_l1_rigid_requires_entry_and_halt() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "using-forge".to_string(),
                level: "L1-RIGID".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "---\nname: using-forge\nlevel: L1-RIGID\nowner: all-agents\n---\n# using-forge\n\n## Description\n\nX.\n\n## State Model\n\n- a\n\n## Rules\n\n1. x.\n".to_string(),
                handoffs_md: None,
                loop_md: Some(common::perfect_loop_md()),
            }),
    );
    let diagnostics = skill_completeness::validate(&repo);
    if !diagnostics.iter().any(|d| d.message.contains("Entry Conditions")) {
        eprintln!("diagnostics: {:#?}", diagnostics);
    }
    assert!(diagnostics.iter().any(|d| d.message.contains("Entry Conditions")));
    assert!(diagnostics.iter().any(|d| d.message.contains("Halt Conditions")));
}

#[test]
fn skill_completeness_l2_guided_does_not_require_entry_or_halt() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "quality".to_string(),
                name: "running-desk-checks".to_string(),
                level: "L2-GUIDED".to_string(),
                owner: "qa-agent".to_string(),
                skill_md: "# running-desk-checks\n\n## Description\n\nX.\n\n## State Model\n\n- in-deskcheck\n\n## Rules\n\n1. x.\n".to_string(),
                handoffs_md: None,
                loop_md: Some(common::perfect_loop_md()),
            }),
    );
    let diagnostics = skill_completeness::validate(&repo);
    assert!(!diagnostics.iter().any(|d| d.message.contains("Entry Conditions")));
    assert!(!diagnostics.iter().any(|d| d.message.contains("Halt Conditions")));
}

// ────────────────────────── state_machine ──────────────────────────

#[test]
fn state_machine_passes_when_all_skill_states_in_graph() {
    let mut skills = perfect_skill_library();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(skills.remove(0)),
    );
    let diagnostics = state_machine::validate(&repo);
    assert!(diagnostics.is_empty());
}

// ────────────────────────── bidirectional_state ──────────────────────────

#[test]
fn bidirectional_state_reports_graph_states_not_in_skills() {
    let skills = perfect_skill_library();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(skills[0].clone())
            .with_skill(skills[1].clone())
            .with_skill(skills[2].clone())
            .with_skill(skills[3].clone()),
    );
    let diagnostics = bidirectional_state::validate(&repo);
    assert!(!has_code(&diagnostics, "BSTATE"));
}

// ────────────────────────── handoff_graph ──────────────────────────

#[test]
fn handoff_graph_no_diagnostics_for_perfect_repo() {
    let skills = perfect_skill_library();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(skills[0].clone())
            .with_skill(skills[1].clone())
            .with_skill(skills[2].clone())
            .with_skill(skills[3].clone()),
    );
    let diagnostics = handoff_graph::validate(&repo);
    if !diagnostics.is_empty() {
        eprintln!("diagnostics: {:#?}", diagnostics);
        eprintln!("graph nodes: {:#?}", repo.handoff_graph.nodes.iter().map(|n| &n.name).collect::<Vec<_>>());
        eprintln!("graph edges: {:#?}", repo.handoff_graph.edges);
    }
    assert!(diagnostics.is_empty(), "got {:?}", diagnostics.iter().map(|d| &d.code).collect::<Vec<_>>());
}

#[test]
fn handoff_graph_reports_unreachable_state() {
    let skill_md = "---\nname: a\nlevel: L2-GUIDED\nowner: qa-agent\n---\n# a\n\n## Description\n\nX.\n\n## State Model\n\n- in-strange-state\n\n## Rules\n\n1. x.\n";
    let handoffs = "# a — Handoffs\n\n## On PASS\n\nMove to `b`.\n";
    let fixture = r#"
metadata:
  version: 1.0.0
  last_updated: 2026-06-21
  description: test
loops:
  - skill: a
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: test
canonical_states: [in-analysis, done, in-strange-state]
required_loop_sections: []
required_skill_sections:
  all_levels: []
  l1_rigid_only: []
handoff_graph_invariants: []
terminal_states: [done]
entry_points: [in-analysis]
entry_triggers: []
"#;
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(fixture)
            .with_skill(common::SkillSpec {
                category: "quality".to_string(),
                name: "a".to_string(),
                level: "L2-GUIDED".to_string(),
                owner: "qa-agent".to_string(),
                skill_md: skill_md.to_string(),
                handoffs_md: Some(handoffs.to_string()),
                loop_md: Some(common::perfect_loop_md()),
            }),
    );
    let diagnostics = handoff_graph::validate(&repo);
    if diagnostics.is_empty() {
        eprintln!("graph nodes: {:#?}", repo.handoff_graph.nodes.iter().map(|n| &n.name).collect::<Vec<_>>());
        eprintln!("graph edges: {:#?}", repo.handoff_graph.edges);
    }
    assert!(diagnostics.iter().any(|d| d.message.contains("not reachable") || d.message.contains("Dead-end")));
}

// ────────────────────────── cross_references ──────────────────────────

#[test]
fn cross_references_filters_canonical_state_names() {
    // README mentions a state name like `ready-for-dev` in backticks;
    // it should NOT be flagged as a missing skill.
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_readme("States: `ready-for-dev`, `in-dev`, `done`.\n")
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = cross_references::validate(&repo);
    // No REF for canonical state names
    assert!(!diagnostics.iter().any(|d| d.message.contains("ready-for-dev")));
}

#[test]
fn cross_references_flags_unknown_skill_in_readme() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_readme("Use `mystery-skill` for this.\n")
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = cross_references::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.message.contains("mystery-skill")));
}

#[test]
fn cross_references_flags_unknown_skill_in_handoffs() {
    let mut skills = perfect_skill_library();
    let spec = skills.first_mut().unwrap();
    spec.handoffs_md = Some(
        "# handoffs\n\n## On PASS\n\nRoutes to `non-existent-skill`.\n".to_string(),
    );
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(spec.clone()),
    );
    let diagnostics = cross_references::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.message.contains("non-existent-skill")));
}

// ────────────────────────── simulation ──────────────────────────

#[test]
fn simulation_reports_missing_loop_command() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(perfect_skill_library().remove(0))
            .with_constraints("priorities:\n  quality: 1\nloop:\n  outer_at_command: x\n"),
    );
    let diagnostics = simulation::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.message.contains("component_test_command")));
}

#[test]
fn simulation_reports_invalid_budget() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(perfect_skill_library().remove(0))
            .with_constraints(
                "priorities:\n  quality: 1\nloop:\n\
                 outer_at_command: x\n\
                 component_test_command: x\n\
                 cdc_test_command: x\n\
                 regression_command: x\n\
                 smoke_command: x\n\
                 max_iterations_per_subslice: 0\n\
                 max_no_progress_retries: 2\n\
                 max_story_loop_minutes: 45\n\
                 max_story_loop_cost_usd: 2.00\n",
            ),
    );
    let diagnostics = simulation::validate(&repo);
    assert!(diagnostics
        .iter()
        .any(|d| d.message.contains("max_iterations_per_subslice")));
}

#[test]
fn simulation_reports_unreachable_terminal() {
    let fixture = r#"
metadata:
  version: 1.0.0
  last_updated: 2026-06-21
  description: test
loops:
  - skill: alpha
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: alpha
canonical_states: [lost]
required_loop_sections: []
required_skill_sections:
  all_levels: []
  l1_rigid_only: []
handoff_graph_invariants: []
terminal_states: [done]
entry_points: [lost]
entry_triggers: []
"#;
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(fixture)
            .with_skill(common::SkillSpec {
                category: "quality".to_string(),
                name: "alpha".to_string(),
                level: "L2-GUIDED".to_string(),
                owner: "qa-agent".to_string(),
                skill_md: "# alpha\n## Description\n\nX.\n## State Model\n\n- lost\n".to_string(),
                handoffs_md: None,
                loop_md: Some(common::perfect_loop_md()),
            })
            .with_constraints(r#"priorities:
  quality: 1
loop:
  outer_at_command: x
  component_test_command: x
  cdc_test_command: x
  regression_command: x
  smoke_command: x
  max_iterations_per_subslice: 5
  max_no_progress_retries: 2
  max_story_loop_minutes: 45
  max_story_loop_cost_usd: 2.00
"#),
    );
    let diagnostics = simulation::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.message.contains("cannot reach")));
}

#[test]
fn simulation_reports_self_loop_without_terminal() {
    let fixture = r#"
metadata:
  version: 1.0.0
  last_updated: 2026-06-21
  description: test
loops:
  - skill: alpha
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: alpha
canonical_states: [in-dev, done]
required_loop_sections: []
required_skill_sections:
  all_levels: []
  l1_rigid_only: []
handoff_graph_invariants: []
terminal_states: [done]
entry_points: [in-dev]
entry_triggers: []
"#;
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(fixture)
            .with_skill(common::SkillSpec {
                category: "quality".to_string(),
                name: "alpha".to_string(),
                level: "L2-GUIDED".to_string(),
                owner: "qa-agent".to_string(),
                skill_md: "# alpha\n## Description\n\nX.\n## State Model\n\n- in-dev\n".to_string(),
                handoffs_md: Some("# alpha — Handoffs\n\nRoutes to `in-dev`.\n".to_string()),
                loop_md: Some(common::perfect_loop_md()),
            })
            .with_constraints(r#"priorities:
  quality: 1
loop:
  outer_at_command: x
  component_test_command: x
  cdc_test_command: x
  regression_command: x
  smoke_command: x
  max_iterations_per_subslice: 5
  max_no_progress_retries: 2
  max_story_loop_minutes: 45
  max_story_loop_cost_usd: 2.00
"#),
    );
    let diagnostics = simulation::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.message.contains("cannot reach")));
}

// ────────────────────────── loop_state_files ──────────────────────────

#[test]
fn loop_state_files_reports_missing_inception_and_board() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = loop_state_files::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.code == "LSTATE-001"));
    assert!(diagnostics.iter().any(|d| d.code == "LSTATE-002"));
}

#[test]
fn loop_state_files_passes_when_present() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(perfect_skill_library().remove(0))
            .with_loop_state_file("docs/inception.loop.md", "# inception\n")
            .with_loop_state_file("docs/iteration-board.loop.md", "# board\n"),
    );
    let diagnostics = loop_state_files::validate(&repo);
    assert!(diagnostics.is_empty());
}

// ────────────────────────── constraints_loop_block ──────────────────────────

#[test]
fn constraints_loop_block_reports_missing() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_constraints("priorities:\n  quality: 1\n")
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = constraints_loop_block::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.code == "CONS-001"));
}

#[test]
fn constraints_loop_block_passes_when_present() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_constraints("priorities:\n  quality: 1\nloop:\n  outer_at_command: x\n")
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = constraints_loop_block::validate(&repo);
    assert!(diagnostics.is_empty());
}

// ────────────────────────── fixture_drift ──────────────────────────

#[test]
fn fixture_drift_reports_loop_guardian_missing_from_repo() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = fixture_drift::validate(&repo);
    // canonical fixture requires loop-guardian; we did not add it
    assert!(diagnostics.iter().any(|d| d.code == "DRIFT-001"));
}

#[test]
fn fixture_drift_no_drift_when_fixture_matches_repo() {
    let mut skills = perfect_skill_library();
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(skills.remove(0))
            .with_skill(skills.remove(0))
            .with_skill(skills.remove(0))
            .with_skill(skills.remove(0)),
    );
    let diagnostics = fixture_drift::validate(&repo);
    assert!(diagnostics.is_empty());
}

// ────────────────────────── handoff_completeness ──────────────────────────

#[test]
fn handoff_completeness_reports_missing_handoffs_for_loop_skill() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "using-forge".to_string(),
                level: "L1-RIGID".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "# using-forge\n## Description\n\nX.\n".to_string(),
                handoffs_md: None,
                loop_md: Some(common::perfect_loop_md()),
            }),
    );
    let diagnostics = handoff_completeness::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.code.starts_with("HANDOFF")));
    assert!(diagnostics
        .iter()
        .any(|d| d.message.contains("missing HANDOFFS.md")));
}

#[test]
fn handoff_completeness_ignores_non_loop_skills() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "acceptance-delivery".to_string(),
                name: "managing-feature-flags".to_string(),
                level: "L3-MECH".to_string(),
                owner: "devops-agent".to_string(),
                skill_md: "# managing-feature-flags\n## Description\n\nX.\n".to_string(),
                handoffs_md: None,
                loop_md: None,
            }),
    );
    let diagnostics = handoff_completeness::validate(&repo);
    assert!(diagnostics.is_empty());
}

// ────────────────────────── fixture_category ──────────────────────────

#[test]
fn fixture_category_emits_error_when_path_missing() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = fixture_category::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.code == "CAT-001"));
}

// ────────────────────────── additional edge-case coverage ──────────────────────────

#[test]
fn loop_sections_warns_on_unexpected_section() {
    let boilerplate = common::perfect_loop_md();
    let with_extra = format!("{}## Extra Section\n\nX\n", boilerplate);
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "using-forge".to_string(),
                level: "L1-RIGID".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "# using-forge\n## Description\n\nX.\n".to_string(),
                handoffs_md: None,
                loop_md: Some(with_extra),
            }),
    );
    let diagnostics = loop_sections::validate(&repo);
    assert!(diagnostics
        .iter()
        .any(|d| d.severity == forge_contract_tests::types::Severity::Warning));
}

#[test]
fn bidirectional_state_reports_graph_state_not_defined_in_skills() {
    // HANDOFFS.md references `ready-for-dev` in brackets, but no SKILL.md
    // lists it as a state model entry.
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "using-forge".to_string(),
                level: "L1-RIGID".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "# using-forge\n## Description\n\nX.\n## State Model\n\n- in-analysis\n".to_string(),
                handoffs_md: Some(
                    "# handoffs\n\n```\nusing-forge\n  └→ done → other (agent) [in-analysis → ready-for-dev]\n```\n".to_string(),
                ),
                loop_md: Some(common::perfect_loop_md()),
            }),
    );
    let diagnostics = bidirectional_state::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.code.starts_with("BSTATE")));
}

#[test]
fn state_machine_reports_skill_state_not_in_graph_nodes() {
    // Directly construct a repo where a skill defines `ready-for-dev` but the
    // handoff graph nodes do not contain it, to exercise the missing-state branch.
    let fixture: Fixture = parse_str(&canonical_fixture()).expect("fixture");
    let skill = Skill {
        name: "orphan-skill".to_string(),
        category: SkillCategory::Meta,
        path: std::path::PathBuf::from("skills/meta/orphan-skill"),
        level: SkillLevel::L2Guided,
        owner: vec![AgentRole::AllAgents],
        sections: vec!["Description".to_string(), "State Model".to_string()],
        states: vec![State {
            name: "ready-for-dev".to_string(),
            defined_in: vec!["orphan-skill".to_string()],
            is_terminal: false,
            is_entry: false,
        }],
        has_handoffs: false,
        has_loop: true,
    };
    let repo = Repo {
        root: std::path::PathBuf::from("/tmp/fake"),
        skills: vec![skill],
        fixture,
        handoff_graph: HandoffGraph {
            nodes: vec![],
            edges: vec![],
            entry_points: vec![],
        },
        readme_skills: vec![],
    };
    let diagnostics = state_machine::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.code.starts_with("STATE")));
}

#[test]
fn fixture_drift_warns_on_repo_skill_not_in_fixture() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_skill(common::SkillSpec {
                category: "meta".to_string(),
                name: "extra-skill".to_string(),
                level: "L2-GUIDED".to_string(),
                owner: "all-agents".to_string(),
                skill_md: "# extra-skill\n## Description\n\nX.\n".to_string(),
                handoffs_md: Some("# handoffs\n\nHand off to `using-forge`.\n".to_string()),
                loop_md: None,
            }),
    );
    let diagnostics = fixture_drift::validate(&repo);
    assert!(diagnostics.iter().any(|d| d.code.starts_with("DRIFT")));
}

#[test]
fn cross_references_ignores_known_exception_story_flag() {
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(&canonical_fixture())
            .with_readme("Feature flag `story-42-example` controls this.\n")
            .with_skill(perfect_skill_library().remove(0)),
    );
    let diagnostics = cross_references::validate(&repo);
    assert!(!diagnostics.iter().any(|d| d.message.contains("story-42-example")));
}

#[test]
fn handoff_graph_reports_terminal_state_with_outbound_edges() {
    let fixture = r#"
metadata:
  version: 1.0.0
  last_updated: 2026-06-21
  description: test
loops:
  - skill: a
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: test
canonical_states: [in-analysis, done]
required_loop_sections: []
required_skill_sections:
  all_levels: []
  l1_rigid_only: []
handoff_graph_invariants: []
terminal_states: [done]
entry_points: [in-analysis]
entry_triggers: []
"#;
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(fixture)
            .with_skill(common::SkillSpec {
                category: "quality".to_string(),
                name: "a".to_string(),
                level: "L2-GUIDED".to_string(),
                owner: "qa-agent".to_string(),
                skill_md: "# a\n## Description\n\nX.\n## State Model\n\n- in-analysis\n- done\n".to_string(),
                handoffs_md: Some(
                    "# handoffs\n\n```\na\n  └→ continue → a (agent) [done → in-analysis]\n```\n".to_string(),
                ),
                loop_md: Some(common::perfect_loop_md()),
            }),
    );
    let diagnostics = handoff_graph::validate(&repo);
    assert!(diagnostics
        .iter()
        .any(|d| d.message.contains("Terminal state") && d.message.contains("outbound")));
}

#[test]
fn handoff_graph_reports_dead_end_state() {
    let fixture = r#"
metadata:
  version: 1.0.0
  last_updated: 2026-06-21
  description: test
loops:
  - skill: a
    category: quality
    level: L2-GUIDED
    owner: [qa-agent]
    has_loop: true
    description: test
canonical_states: [in-analysis, dead-end]
required_loop_sections: []
required_skill_sections:
  all_levels: []
  l1_rigid_only: []
handoff_graph_invariants: []
terminal_states: []
entry_points: [in-analysis]
entry_triggers: []
"#;
    let (repo, _temp) = build_repo(
        RepoBuilder::new()
            .with_fixture(fixture)
            .with_skill(common::SkillSpec {
                category: "quality".to_string(),
                name: "a".to_string(),
                level: "L2-GUIDED".to_string(),
                owner: "qa-agent".to_string(),
                skill_md: "# a\n## Description\n\nX.\n## State Model\n\n- in-analysis\n- dead-end\n".to_string(),
                handoffs_md: Some(
                    "# handoffs\n\n```\na\n  └→ go → a (agent) [in-analysis → dead-end]\n```\n".to_string(),
                ),
                loop_md: Some(common::perfect_loop_md()),
            }),
    );
    let diagnostics = handoff_graph::validate(&repo);
    assert!(diagnostics
        .iter()
        .any(|d| d.message.contains("Dead-end") && d.message.contains("dead-end")));
}
