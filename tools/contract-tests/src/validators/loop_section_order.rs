use crate::diagnostic::{at_path, diagnostic};
use crate::parser::parse_markdown_headings;
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let canonical: Vec<String> = repo
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

        let filtered: Vec<&String> = headings
            .iter()
            .filter(|h| canonical.contains(h))
            .collect();

        let mut prev_index: Option<usize> = None;
        for h in filtered {
            let idx = canonical.iter().position(|c| c == h).unwrap();
            if let Some(p) = prev_index {
                if idx < p {
                    out.push(diagnostic(
                        Severity::Error,
                        format!("ORDER-{0:03}", out.len() + 1),
                        format!(
                            "LOOP.md for `{}` has sections out of canonical order",
                            skill.name
                        ),
                        at_path(&skill.loop_md()),
                        format!(
                            "expected order: {}",
                            canonical.join(" → ")
                        ),
                    ));
                    break;
                }
            }
            prev_index = Some(idx);
        }
    }
    out
}
