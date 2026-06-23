use crate::diagnostic::{at_path, diagnostic};
use crate::types::{Diagnostic, Repo, Severity};
use std::collections::HashSet;

/// Every skill marked `has_loop: true` in the contract fixture MUST have a
/// HANDOFFS.md file describing its inbound triggers and outbound routes.
pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let loop_required: HashSet<String> = repo
        .fixture
        .loops
        .iter()
        .filter(|l| l.has_loop)
        .map(|l| l.skill.clone())
        .collect();

    for skill in &repo.skills {
        if loop_required.contains(&skill.name) && !skill.has_handoffs {
            out.push(diagnostic(
                Severity::Error,
                format!("HANDOFF-{0:03}", out.len() + 1),
                format!(
                    "Loop skill `{}` is missing HANDOFFS.md",
                    skill.name
                ),
                at_path(&skill.dir()),
                "add HANDOFFS.md describing inbound triggers and outbound handoff routes".to_string(),
            ));
        }
    }
    out
}
