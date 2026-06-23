use crate::diagnostic::{at_path, diagnostic};
use crate::parser::parse_markdown_headings;
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};
use std::collections::HashSet;

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let required: HashSet<String> = repo
        .fixture
        .required_loop_sections
        .iter()
        .map(|s| s.heading.clone())
        .collect();

    for skill in &repo.skills {
        if !skill.has_loop {
            continue;
        }
        let text = match std::fs::read_to_string(&skill.loop_md()) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let headings: Vec<String> = parse_markdown_headings(&text)
            .into_iter()
            .filter(|(l, _)| *l == 2)
            .map(|(_, h)| h)
            .collect();
        let found: HashSet<String> = headings.iter().cloned().collect();
        let missing: Vec<String> = required.difference(&found).cloned().collect();
        let unexpected: Vec<String> = found.difference(&required).cloned().collect();

        if !missing.is_empty() {
            out.push(diagnostic(
                Severity::Error,
                format!("LOOP-{0:03}", 100 + out.len()),
                format!(
                    "LOOP.md for `{}` is missing required sections",
                    skill.name
                ),
                at_path(&skill.loop_md()),
                format!(
                    "add sections: {}",
                    missing.join(", ")
                ),
            ));
        }
        if !unexpected.is_empty() {
            out.push(diagnostic(
                Severity::Warning,
                format!("LOOP-{0:03}", 100 + out.len()),
                format!(
                    "LOOP.md for `{}` has unexpected sections",
                    skill.name
                ),
                at_path(&skill.loop_md()),
                format!(
                    "review or remove: {}",
                    unexpected.join(", ")
                ),
            ));
        }
    }
    out
}
