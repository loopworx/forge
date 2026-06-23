use crate::diagnostic::{at_path, diagnostic};
use crate::parser::constraints::parse_constraints;
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let constraints = parse_constraints(&repo.root.join("project.constraints.yaml"));
    if !constraints.has_loop_block {
        out.push(diagnostic(
            Severity::Error,
            "CONS-001",
            "Missing `loop:` block in project.constraints.yaml".to_string(),
            at_path(&repo.root.join("project.constraints.yaml")),
            "add loop commands and budget constraints per perfect loop plan Section 4".to_string(),
        ));
    }
    out
}
