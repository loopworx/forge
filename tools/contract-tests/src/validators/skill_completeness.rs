use crate::diagnostic::{at_path, diagnostic};
use crate::parser::skill::parse_skill_text;
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};
use std::collections::HashSet;

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let _all_required: Vec<String> = repo
        .fixture
        .required_skill_sections
        .all_levels
        .iter()
        .map(|s: &crate::types::RequiredSection| s.heading.clone())
        .collect();
    let aliases_map: Vec<(String, Vec<String>)> = repo
        .fixture
        .required_skill_sections
        .all_levels
        .iter()
        .map(|s| (s.heading.clone(), s.aliases.clone()))
        .collect();
    let l1_aliases: Vec<(String, Vec<String>)> = repo
        .fixture
        .required_skill_sections
        .l1_rigid_only
        .iter()
        .map(|s| (s.heading.clone(), s.aliases.clone()))
        .collect();

    for skill in &repo.skills {
        let path = skill.skill_md();
        let text = match std::fs::read_to_string(&path) {
            Ok(t) => t,
            Err(_) => {
                out.push(diagnostic(
                    Severity::Error,
                    format!("SKILL-{0:03}", out.len() + 1),
                    format!("Missing SKILL.md for `{}`", skill.name),
                    at_path(&skill.dir()),
                    "create SKILL.md with required sections".to_string(),
                ));
                continue;
            }
        };
        let parsed = parse_skill_text(&text);
        let headings_lower: HashSet<String> = parsed
            .sections
            .iter()
            .map(|h| h.to_lowercase())
            .collect();

        for (required, aliases) in &aliases_map {
            if !has_heading(&headings_lower, required, aliases) {
                out.push(diagnostic(
                    Severity::Error,
                    format!("SKILL-{0:03}", out.len() + 1),
                    format!(
                        "SKILL.md for `{}` is missing required section `{}`",
                        skill.name, required
                    ),
                    at_path(&skill.skill_md()),
                    format!("add a `## {}` section", required),
                ));
            }
        }

        if skill.level.is_rigid() {
            for (required, aliases) in &l1_aliases {
                if !has_heading(&headings_lower, required, aliases) {
                    out.push(diagnostic(
                        Severity::Error,
                        format!("SKILL-{0:03}", out.len() + 1),
                        format!(
                            "L1-RIGID SKILL.md for `{}` is missing required section `{}`",
                            skill.name, required
                        ),
                        at_path(&skill.skill_md()),
                        format!("add a `## {}` section", required),
                    ));
                }
            }
        }
    }
    out
}

fn has_heading(headings: &HashSet<String>, required: &str, aliases: &[String]) -> bool {
    let names: Vec<String> = std::iter::once(required.to_string())
        .chain(aliases.iter().cloned())
        .map(|s| s.to_lowercase())
        .collect();
    names.iter().any(|n| headings.contains(n))
}
