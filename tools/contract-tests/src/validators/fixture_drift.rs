use crate::diagnostic::{at_path, diagnostic};
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};
use std::collections::HashSet;

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let fixture_skills: HashSet<String> = repo
        .fixture
        .loops
        .iter()
        .map(|l| l.skill.clone())
        .collect();
    let repo_skills: HashSet<String> = repo
        .skills
        .iter()
        .map(|s| s.name.clone())
        .collect();

    for l in &repo.fixture.loops {
        if !repo_skills.contains(&l.skill) && l.has_loop {
            out.push(diagnostic(
                Severity::Error,
                format!("DRIFT-{0:03}", out.len() + 1),
                format!(
                    "Fixture skill `{}` is missing from the repository",
                    l.skill
                ),
                at_path(&repo.root.join("tools/contract-tests/fixtures/loop-contract.yaml")),
                format!(
                    "create skills/{}/{} or remove skill from fixture",
                    l.category, l.skill
                ),
            ));
        }
    }

    for skill in &repo.skills {
        if !fixture_skills.contains(&skill.name) {
            if skill.has_handoffs {
                out.push(diagnostic(
                    Severity::Warning,
                    format!("DRIFT-{0:03}", out.len() + 1),
                    format!(
                        "Repo skill `{}` is not in the fixture",
                        skill.name
                    ),
                    at_path(&skill.skill_md()),
                    "add the skill to fixtures/loop-contract.yaml or confirm it is not loop-worthy".to_string(),
                ));
            }
        }
    }
    out
}
