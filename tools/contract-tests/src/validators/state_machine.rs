use crate::diagnostic::{at_path, diagnostic};
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};
use std::collections::HashSet;

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let graph_states: HashSet<String> = repo
        .handoff_graph
        .nodes
        .iter()
        .map(|n| n.name.clone())
        .collect();

    for skill in &repo.skills {
        for state in &skill.states {
            if !graph_states.contains(&state.name) {
                out.push(diagnostic(
                    Severity::Error,
                    format!("STATE-{0:03}", out.len() + 1),
                    format!(
                        "State `{}` referenced in SKILL.md is absent from handoff graph",
                        state.name
                    ),
                    at_path(&skill.skill_md()),
                    format!(
                        "add `{}` to HANDOFFS.md with inbound/outbound transitions",
                        state.name
                    ),
                ));
            }
        }
    }
    out
}
