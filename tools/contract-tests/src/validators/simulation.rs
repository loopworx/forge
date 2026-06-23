use crate::diagnostic::{at_path, diagnostic};
use crate::simulation::Violation;
use crate::types::{Diagnostic, Repo, Severity};

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let violations = crate::simulation::run_all(repo);

    for v in violations {
        let (code, message, help) = match v {
            Violation::MissingLoopBlock => (
                format!("SIM-{0:03}", out.len() + 1),
                "Simulation cannot run: missing `loop:` block in project.constraints.yaml".to_string(),
                "add a `loop:` block with commands and budgets".to_string(),
            ),
            Violation::MissingBudgetField(key) => (
                format!("SIM-{0:03}", out.len() + 1),
                format!(
                    "Simulation cannot run: missing loop budget field `{}`",
                    key
                ),
                format!("add `{}` to the `loop:` block in project.constraints.yaml", key),
            ),
            Violation::InvalidBudgetField { key, reason } => (
                format!("SIM-{0:03}", out.len() + 1),
                format!(
                    "Simulation cannot run: invalid loop budget field `{}`",
                    key
                ),
                reason,
            ),
            Violation::UnreachableTerminal { entry } => (
                format!("SIM-{0:03}", out.len() + 1),
                format!(
                    "Entry point `{}` cannot reach any terminal or halted state",
                    entry
                ),
                "add outbound transitions from this entry to a terminal/halted state or include it in terminal_states".to_string(),
            ),
            Violation::TransitionToUnknownState { from, to } => (
                format!("SIM-{0:03}", out.len() + 1),
                format!(
                    "State transition `{}` → `{}` references a non-canonical state",
                    from, to
                ),
                "add the state to fixtures/loop-contract.yaml canonical_states or remove the transition".to_string(),
            ),
        };
        out.push(diagnostic(
            Severity::Error,
            code,
            message,
            at_path(&repo.root.join("project.constraints.yaml")),
            help,
        ));
    }

    out
}
