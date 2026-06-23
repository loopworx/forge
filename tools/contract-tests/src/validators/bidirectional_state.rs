use crate::diagnostic::{at_path, diagnostic};
use crate::parser::skill::build_state_definitions;
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};
use std::collections::HashSet;

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let state_defs = build_state_definitions(&repo.skills);
    let defined: HashSet<String> = state_defs.keys().cloned().collect();
    let canonical: HashSet<String> = repo.fixture.canonical_states.iter().cloned().collect();
    let terminal: HashSet<String> = repo.fixture.terminal_states.iter().cloned().collect();

    for node in &repo.handoff_graph.nodes {
        // Only consider canonical states; terminal states are global and do
        // not need to be listed in a SKILL.md state model.
        if !canonical.contains(&node.name) || terminal.contains(&node.name) {
            continue;
        }
        if !defined.contains(&node.name) {
            out.push(diagnostic(
                Severity::Error,
                format!("BSTATE-{0:03}", out.len() + 1),
                format!(
                    "State `{}` in handoff graph is not defined by any SKILL.md",
                    node.name
                ),
                at_path(&repo.root.join("skills")),
                format!(
                    "add `{}` to the state model of the skill that owns this state",
                    node.name
                ),
            ));
        }
    }
    out
}
