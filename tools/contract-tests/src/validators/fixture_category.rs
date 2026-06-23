use crate::diagnostic::{at_path, diagnostic};
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    for l in &repo.fixture.loops {
        let expected_path = repo
            .root
            .join("skills")
            .join(&l.category)
            .join(&l.skill);
        if !expected_path.exists() {
            out.push(diagnostic(
                Severity::Error,
                format!("CAT-{0:03}", out.len() + 1),
                format!(
                    "Fixture category mismatch or missing skill `{}`",
                    l.skill
                ),
                at_path(&expected_path),
                format!(
                    "expected path skills/{}/{}; update fixture category or create skill directory",
                    l.category, l.skill
                ),
            ));
        }
    }
    out
}
