use crate::diagnostic::{at_path, diagnostic};
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    for fixture_loop in &repo.fixture.loops {
        if !fixture_loop.has_loop {
            continue;
        }
        let dir = repo
            .root
            .join("skills")
            .join(&fixture_loop.category)
            .join(&fixture_loop.skill);
        let loop_md = dir.join("LOOP.md");
        if !loop_md.exists() {
            out.push(diagnostic(
                Severity::Error,
                format!("LOOP-{0:03}", out.len() + 1),
                format!(
                    "Missing LOOP.md for fixture-required skill `{}`",
                    fixture_loop.skill
                ),
                at_path(&loop_md),
                format!(
                    "create LOOP.md with the 7 required sections in skills/{}/{}/",
                    fixture_loop.category, fixture_loop.skill
                ),
            ));
        }
    }
    out
}
