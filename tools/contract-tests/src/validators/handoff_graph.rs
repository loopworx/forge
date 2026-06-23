use crate::diagnostic::{at_path, diagnostic};
use crate::types::{Diagnostic, Repo, Severity};
use std::collections::{HashMap, HashSet, VecDeque};

pub fn validate(repo: &Repo) -> Vec<Diagnostic> {
    let mut out = Vec::new();
    let terminal: HashSet<String> = repo.fixture.terminal_states.iter().cloned().collect();
    let entries: HashSet<String> = repo.fixture.entry_points.iter().cloned().collect();
    let canonical: HashSet<String> = repo.fixture.canonical_states.iter().cloned().collect();

    // State-graph only considers canonical state nodes. Skill names appearing
    // as edge endpoints are not state nodes.
    let mut outbound_states: HashMap<String, HashSet<String>> = HashMap::new();
    let mut nodes: HashSet<String> = HashSet::new();
    for state in &repo.handoff_graph.nodes {
        if !canonical.contains(&state.name) {
            continue;
        }
        nodes.insert(state.name.clone());
        outbound_states.entry(state.name.clone()).or_default();
    }
    for edge in &repo.handoff_graph.edges {
        // Only add state-to-state edges where both endpoints are canonical states.
        if canonical.contains(&edge.from) && canonical.contains(&edge.to) {
            outbound_states
                .entry(edge.from.clone())
                .or_default()
                .insert(edge.to.clone());
        }
    }

    // Dead-end checks: skip entry points (they have no inbound by design) and terminal states
    for name in &nodes {
        if terminal.contains(name) || entries.contains(name) {
            continue;
        }
        let has_outbound = outbound_states
            .get(name)
            .map(|v| !v.is_empty())
            .unwrap_or(false);
        if !has_outbound {
            out.push(diagnostic(
                Severity::Error,
                format!("GRAPH-{0:03}", out.len() + 1),
                format!("Dead-end state `{}` has no outbound edges", name),
                at_path(&repo.root.join("skills")),
                "add an outbound transition or declare the state as terminal".to_string(),
            ));
        }
    }

    // Reachability from entry points
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<String> = VecDeque::new();
    for e in entries.iter() {
        queue.push_back(e.clone());
    }
    while let Some(cur) = queue.pop_front() {
        if !visited.insert(cur.clone()) {
            continue;
        }
        if let Some(nexts) = outbound_states.get(&cur) {
            for n in nexts {
                queue.push_back(n.clone());
            }
        }
    }

    for name in &nodes {
        if terminal.contains(name) {
            continue;
        }
        if !visited.contains(name) {
            out.push(diagnostic(
                Severity::Error,
                format!("GRAPH-{0:03}", out.len() + 1),
                format!(
                    "State `{}` is not reachable from any entry point",
                    name
                ),
                at_path(&repo.root.join("skills")),
                format!(
                    "add a transition leading to `{}` or add it to entry_points",
                    name
                ),
            ));
        }
    }

    // Terminal-state-violation check
    for name in &nodes {
        if terminal.contains(name) {
            let has_outbound = outbound_states
                .get(name)
                .map(|v| !v.is_empty())
                .unwrap_or(false);
            if has_outbound {
                out.push(diagnostic(
                    Severity::Error,
                    format!("GRAPH-{0:03}", out.len() + 1),
                    format!("Terminal state `{}` has outbound edges", name),
                    at_path(&repo.root.join("skills")),
                    "remove outbound edges from terminal state".to_string(),
                ));
            }
        }
    }

    out
}
