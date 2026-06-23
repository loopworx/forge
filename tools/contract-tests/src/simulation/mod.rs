//! Deterministic simulation of the Forge delivery loop.
//!
//! This module walks the canonical state graph as if a session were executing.
//! It does NOT run agents or LLMs; it checks that the state machine itself is
//! executable: budgets are defined, every reachable non-terminal state can
//! eventually reach a terminal or halted state, and state transitions stay
//! within the canonical catalog.

use crate::parser::yaml::parse_file;
use crate::types::Repo;
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Violation {
    MissingLoopBlock,
    MissingBudgetField(String),
    InvalidBudgetField { key: String, reason: String },
    UnreachableTerminal { entry: String },
    TransitionToUnknownState { from: String, to: String },
}

const REQUIRED_COMMANDS: &[&str] = &[
    "outer_at_command",
    "component_test_command",
    "cdc_test_command",
    "regression_command",
    "smoke_command",
];

const REQUIRED_BUDGETS: &[&str] = &[
    "max_iterations_per_subslice",
    "max_no_progress_retries",
    "max_story_loop_minutes",
    "max_story_loop_cost_usd",
];

/// Read `project.constraints.yaml` and validate that the `loop:` block has the
/// commands and numeric budgets needed to execute any loop.
pub fn validate_budgets(repo: &Repo) -> Vec<Violation> {
    let mut violations = Vec::new();
    let constraints_path = repo.root.join("project.constraints.yaml");
    let value: Result<serde_yml::Value, _> = parse_file(&constraints_path);

    let loop_block = match value.as_ref().ok().and_then(|v| v.get("loop")) {
        Some(v) => v,
        None => {
            violations.push(Violation::MissingLoopBlock);
            return violations;
        }
    };

    for key in REQUIRED_COMMANDS {
        match loop_block.get(*key) {
            Some(serde_yml::Value::String(s)) if !s.trim().is_empty() => {}
            _ => violations.push(Violation::MissingBudgetField(key.to_string())),
        }
    }

    for key in REQUIRED_BUDGETS {
        match loop_block.get(*key) {
            Some(serde_yml::Value::Number(n)) if is_positive(n) => {}
            Some(serde_yml::Value::Number(n)) => violations.push(Violation::InvalidBudgetField {
                key: key.to_string(),
                reason: format!("{} must be positive, got {}", key, n),
            }),
            Some(v) => violations.push(Violation::InvalidBudgetField {
                key: key.to_string(),
                reason: format!("{} must be a number, got {:?}", key, v),
            }),
            None => violations.push(Violation::MissingBudgetField(key.to_string())),
        }
    }

    violations
}

fn is_positive(n: &serde_yml::Number) -> bool {
    n.as_u64().map(|v| v > 0).unwrap_or(false) || n.as_f64() > 0.0
}

/// Simulate execution from each fixture entry point through the canonical
/// state graph. Returns every reachable state plus any violations.
pub fn simulate_loop(repo: &Repo) -> (HashSet<String>, Vec<Violation>) {
    let canonical: HashSet<String> = repo.fixture.canonical_states.iter().cloned().collect();
    let terminal: HashSet<String> = repo.fixture.terminal_states.iter().cloned().collect();
    let entry_points: Vec<String> = repo.fixture.entry_points.iter().cloned().collect();

    // Build adjacency for canonical-state → canonical-state edges only.
    let mut outbound: HashMap<String, HashSet<String>> = HashMap::new();
    for edge in &repo.handoff_graph.edges {
        if canonical.contains(&edge.from) && canonical.contains(&edge.to) {
            outbound
                .entry(edge.from.clone())
                .or_default()
                .insert(edge.to.clone());
        }
    }

    let mut violations = Vec::new();
    let mut reachable: HashSet<String> = HashSet::new();

    for entry in &entry_points {
        let mut visited: HashSet<String> = HashSet::new();
        let mut queue: VecDeque<String> = VecDeque::new();
        queue.push_back(entry.clone());
        reachable.insert(entry.clone());

        let mut found_terminal = false;
        while let Some(cur) = queue.pop_front() {
            if !visited.insert(cur.clone()) {
                continue;
            }
            reachable.insert(cur.clone());
            if terminal.contains(&cur) || cur.starts_with("halted-") {
                found_terminal = true;
                continue;
            }

            if let Some(nexts) = outbound.get(&cur) {
                for n in nexts {
                    if !canonical.contains(n) {
                        violations.push(Violation::TransitionToUnknownState {
                            from: cur.clone(),
                            to: n.clone(),
                        });
                        continue;
                    }
                    queue.push_back(n.clone());
                }
            }
        }

        if !found_terminal && !terminal.contains(entry) && !entry.starts_with("halted-") {
            violations.push(Violation::UnreachableTerminal {
                entry: entry.clone(),
            });
        }
    }

    (reachable, violations)
}

/// Run both budget validation and graph simulation.
pub fn run_all(repo: &Repo) -> Vec<Violation> {
    let mut out = validate_budgets(repo);
    out.extend(simulate_loop(repo).1);
    out
}
