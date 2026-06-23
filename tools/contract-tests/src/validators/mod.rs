use crate::types::Repo;
use crate::types::Diagnostic;

pub mod bidirectional_state;
pub mod constraints_loop_block;
pub mod cross_references;
pub mod fixture_category;
pub mod fixture_drift;
pub mod handoff_completeness;
pub mod handoff_graph;
pub mod loop_completeness;
pub mod loop_section_order;
pub mod loop_sections;
pub mod loop_state_files;
pub mod simulation;
pub mod skill_completeness;
pub mod state_machine;

pub fn run_all(repo: &Repo) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    diagnostics.extend(loop_completeness::validate(repo));
    diagnostics.extend(loop_sections::validate(repo));
    diagnostics.extend(loop_section_order::validate(repo));
    diagnostics.extend(state_machine::validate(repo));
    diagnostics.extend(bidirectional_state::validate(repo));
    diagnostics.extend(handoff_graph::validate(repo));
    diagnostics.extend(handoff_completeness::validate(repo));
    diagnostics.extend(simulation::validate(repo));
    diagnostics.extend(cross_references::validate(repo));
    diagnostics.extend(skill_completeness::validate(repo));
    diagnostics.extend(loop_state_files::validate(repo));
    diagnostics.extend(constraints_loop_block::validate(repo));
    diagnostics.extend(fixture_drift::validate(repo));
    diagnostics.extend(fixture_category::validate(repo));
    diagnostics
}
