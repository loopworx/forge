use crate::diagnostic::{at_path, diagnostic};
use crate::types::Repo;
use crate::types::{Diagnostic, Severity};

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let inception = repo.root.join("docs/inception.loop.md");
    if !inception.exists() {
        out.push(diagnostic(
            Severity::Error,
            format!("LSTATE-{0:03}", out.len() + 1),
            "Missing operational loop-state file docs/inception.loop.md".to_string(),
            at_path(&inception),
            "create docs/inception.loop.md per perfect loop plan Section 3".to_string(),
        ));
    }
    let iteration_board = repo.root.join("docs/iteration-board.loop.md");
    if !iteration_board.exists() {
        out.push(diagnostic(
            Severity::Error,
            format!("LSTATE-{0:03}", out.len() + 1),
            "Missing operational loop-state file docs/iteration-board.loop.md".to_string(),
            at_path(&iteration_board),
            "create docs/iteration-board.loop.md per perfect loop plan Section 3".to_string(),
        ));
    }
    out
}
