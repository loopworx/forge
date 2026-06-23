use crate::diagnostic::{at_line, diagnostic};
use crate::types::{Diagnostic, Repo, Severity};
use regex::Regex;
use std::collections::HashSet;

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let valid_skills: HashSet<String> = repo
        .skills
        .iter()
        .map(|s| s.name.clone())
        .collect();
    let canonical_states: HashSet<String> = repo
        .fixture
        .canonical_states
        .iter()
        .cloned()
        .collect();

    // README
    let readme = repo.root.join("README.md");
    if let Ok(text) = std::fs::read_to_string(&readme) {
        let skill_ref_re = Regex::new(r"`([a-z][a-z0-9_-]+)`").unwrap();
        let path_re = Regex::new(r"skills/([a-z][a-z0-9_-]+)/([a-z][a-z0-9_-]+)/?").unwrap();
        for (line_no, line) in text.lines().enumerate() {
            for cap in skill_ref_re.captures_iter(line) {
                let name = cap[1].to_string();
                if !valid_skills.contains(&name)
                    && !canonical_states.contains(&name)
                    && !known_exception(&name)
                {
                    out.push(diagnostic(
                        Severity::Error,
                        format!("REF-{0:03}", out.len() + 1),
                        format!("README references non-existent skill `{}`", name),
                        at_line(&readme, line_no + 1),
                        "create the skill or remove the reference".to_string(),
                    ));
                }
            }
            for cap in path_re.captures_iter(line) {
                let name = cap[2].to_string();
                if !valid_skills.contains(&name) && !canonical_states.contains(&name) {
                    out.push(diagnostic(
                        Severity::Error,
                        format!("REF-{0:03}", out.len() + 1),
                        format!("README references non-existent skill path `{}`", name),
                        at_line(&readme, line_no + 1),
                        "create the skill directory or remove the reference".to_string(),
                    ));
                }
            }
        }
    }

    // HANDOFFS.md
    for skill in &repo.skills {
        if !skill.has_handoffs {
            continue;
        }
        let path = skill.handoffs_md();
        if let Ok(text) = std::fs::read_to_string(&path) {
            let re = Regex::new(r"`([a-z][a-z0-9_-]+)`").unwrap();
            for (line_no, line) in text.lines().enumerate() {
                for cap in re.captures_iter(line) {
                    let name = cap[1].to_string();
                    if name.ends_with("-agent")
                        || name == skill.name
                        || valid_skills.contains(&name)
                        || canonical_states.contains(&name)
                        || known_exception(&name)
                    {
                        continue;
                    }
                    out.push(diagnostic(
                        Severity::Error,
                        format!("REF-{0:03}", out.len() + 1),
                        format!(
                            "HANDOFFS.md for `{}` references non-existent skill `{}`",
                            skill.name, name
                        ),
                        at_line(&path, line_no + 1),
                        "create the skill or fix the handoff reference".to_string(),
                    ));
                }
            }
        }
    }

    out
}

fn known_exception(name: &str) -> bool {
    // Common non-skill tokens
    if matches!(name, "npm" | "test" | "Context" | "Linear" | "STORY" | "AC") {
        return true;
    }
    // Feature flag names follow `story-<id>-<slug>` pattern
    if name.starts_with("story-") {
        return true;
    }
    false
}
