//! Integration tests.
//!
//! Two test scenarios:
//!
//! 1. **`integration_run_against_real_repo`** — runs the harness against the
//!    actual repository. Since the perfect-loop plan is not yet fully
//!    implemented, this test verifies that the harness emits the expected
//!    diagnostic codes (proves the harness detects real gaps).
//!
//! 2. **`integration_run_against_synthetic_perfect_repo`** — builds a synthetic
//!    "perfect" repository where every fixture-required skill has all the
//!    required artifacts and the handoff graph is fully connected. The harness
//!    must produce zero errors against this fixture (regression guard against
//!    false-positive diagnostics).

use forge_contract_tests::types::Repo;
use forge_contract_tests::validators::run_all;
use forge_contract_tests::validators::{
    bidirectional_state, constraints_loop_block, cross_references, fixture_category,
    fixture_drift, handoff_completeness, handoff_graph, loop_completeness, loop_section_order,
    loop_sections, loop_state_files, simulation, skill_completeness, state_machine,
};

#[path = "common/mod.rs"]
mod tests_common;

#[test]
fn integration_run_against_real_repo() {
    let repo = Repo::from_current_working_dir_parent(2).expect("repo root");
    let diagnostics = run_all(&repo);

    // The perfect-loop plan is now fully implemented: every fixture-required
    // skill has LOOP.md, all SKILL.md sections are present, the handoff
    // graph is wired, and the operational state files exist. The harness
    // should produce zero error-level diagnostics.
    let errors: Vec<_> = diagnostics
        .iter()
        .filter(|d| matches!(d.severity, forge_contract_tests::types::Severity::Error))
        .collect();
    assert!(
        errors.is_empty(),
        "expected zero errors against the fully-implemented repo, got {}: {:#?}",
        errors.len(),
        errors
    );
}

#[test]
fn integration_run_against_synthetic_perfect_repo() {
    let mut builder = tests_common::RepoBuilder::new();
    builder = builder
        .with_fixture(&tests_common::canonical_fixture())
        .with_loop_state_file("docs/inception.loop.md", "# inception\n")
        .with_loop_state_file("docs/iteration-board.loop.md", "# board\n")
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
"#);
    let skills = tests_common::perfect_skill_library();
    for skill in &skills {
        builder = builder.with_skill(skill.clone());
    }
    let temp = builder.build();
    let repo = Repo::from_root(temp.path().to_path_buf()).expect("load perfect repo");

    let mut all = Vec::new();
    all.extend(loop_completeness::validate(&repo));
    all.extend(loop_sections::validate(&repo));
    all.extend(loop_section_order::validate(&repo));
    all.extend(state_machine::validate(&repo));
    all.extend(bidirectional_state::validate(&repo));
    all.extend(handoff_graph::validate(&repo));
    all.extend(handoff_completeness::validate(&repo));
    all.extend(simulation::validate(&repo));
    all.extend(cross_references::validate(&repo));
    all.extend(skill_completeness::validate(&repo));
    all.extend(loop_state_files::validate(&repo));
    all.extend(constraints_loop_block::validate(&repo));
    all.extend(fixture_drift::validate(&repo));
    all.extend(fixture_category::validate(&repo));

    let errors: Vec<_> = all
        .iter()
        .filter(|d| matches!(d.severity, forge_contract_tests::types::Severity::Error))
        .collect();
    assert!(
        errors.is_empty(),
        "perfect repo produced {} errors: {:#?}",
        errors.len(),
        errors
    );
}
