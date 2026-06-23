use crate::parser::load_text;
use crate::types::{HandoffGraph, State, Transition};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::path::Path;

pub struct ParsedHandoffFile {
    pub path: std::path::PathBuf,
    pub skill: String,
    pub transitions: Vec<Transition>,
    pub states: Vec<String>,
}

pub fn parse_all_handoffs(skills_dir: &Path) -> Vec<ParsedHandoffFile> {
    let mut results = Vec::new();
    if let Ok(entries) = std::fs::read_dir(skills_dir) {
        for entry in entries.flatten() {
            if !entry.metadata().map(|m| m.is_dir()).unwrap_or(false) {
                continue;
            }
            let category_dir = entry.path();
            if let Ok(skills) = std::fs::read_dir(&category_dir) {
                for s in skills.flatten() {
                    let skill_dir = s.path();
                    let handoffs = skill_dir.join("HANDOFFS.md");
                    if handoffs.exists() {
                        if let Ok(text) = load_text(&handoffs) {
                            let skill_name = skill_dir
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_string();
                            let parsed = parse_handoff_text(&text, &skill_name);
                            results.push(ParsedHandoffFile {
                                path: handoffs,
                                skill: skill_name,
                                transitions: parsed.transitions,
                                states: parsed.states,
                            });
                        }
                    }
                }
            }
        }
    }
    results
}

pub struct HandoffParseResult {
    pub transitions: Vec<Transition>,
    pub states: Vec<String>,
}

/// Extract prose state transitions such as "Move story to `ready-for-qa`".
/// Returns (optional explicit source state, target state) pairs.
fn extract_prose_state_transitions(text: &str) -> Vec<(Option<String>, String)> {
    let state_re = Regex::new(r"`([a-z][a-z0-9_-]*)`").unwrap();
    let transition_verbs = Regex::new(r"\b(move|moves|move back|routes|route|return|fallback|transition)\s+(to|back to)\b").unwrap();
    let mut out = Vec::new();

    for line in text.lines() {
        let lower = line.to_lowercase();
        if !transition_verbs.is_match(&lower) {
            continue;
        }
        let states: Vec<String> = state_re
            .captures_iter(line)
            .map(|cap| cap[1].to_string())
            .filter(|s| !s.is_empty() && !s.ends_with("-agent"))
            .collect();
        if states.is_empty() {
            continue;
        }
        // If two states appear, treat the first as source and the last as target.
        if states.len() >= 2 {
            out.push((Some(states[0].clone()), states.last().unwrap().clone()));
        } else {
            out.push((None, states[0].clone()));
        }
    }

    out
}

pub fn parse_handoff_text(text: &str, current_skill: &str) -> HandoffParseResult {
    let mut transitions: Vec<Transition> = Vec::new();
    let mut state_names: HashSet<String> = HashSet::new();

    // Prose skill references
    let skill_ref_re = Regex::new(r"`([a-z][a-z0-9_-]+)`").unwrap();
    for line in text.lines() {
        let lower = line.to_lowercase();
        if lower.contains("routes to")
            || lower.contains("return to")
            || lower.contains("hand off to")
            || lower.contains("move to")
            || lower.contains("trigger")
            || lower.contains("call")
            || lower.contains("→")
        {
            for cap in skill_ref_re.captures_iter(line) {
                let target = cap[1].to_string();
                if target.ends_with("-agent") {
                    continue;
                }
                transitions.push(Transition {
                    from: current_skill.to_string(),
                    to: target.clone(),
                    trigger: current_skill.to_string(),
                    condition: Some(line.trim().to_string()),
                });
            }
        }
    }

    // Prose state transitions
    for (source, target) in extract_prose_state_transitions(text) {
        state_names.insert(target.clone());
        if let Some(src) = source {
            state_names.insert(src.clone());
            transitions.push(Transition {
                from: src,
                to: target.clone(),
                trigger: current_skill.to_string(),
                condition: None,
            });
        } else {
            // Inferred target: source will be resolved later from the owning
            // skill's canonical states.
            transitions.push(Transition {
                from: current_skill.to_string(),
                to: target,
                trigger: current_skill.to_string(),
                condition: None,
            });
        }
    }

    // Code blocks with tree format: skill-name + └→ target-skill (agent) [state → next-state]
    let code_block_re = Regex::new(r"```[\s\S]*?```").unwrap();
    for cap in code_block_re.find_iter(text) {
        let block = cap.as_str();
        let lines: Vec<&str> = block.lines().collect();
        let mut current_from_skill: Option<String> = None;
        for line in lines {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("```") {
                continue;
            }
            if !trimmed.starts_with('└') && !trimmed.starts_with('├') {
                // candidate parent skill
                let token = trimmed.split_whitespace().next().unwrap_or("");
                if !token.ends_with("-agent") && !token.contains(':') && !token.contains('→') {
                    current_from_skill = Some(token.to_string());
                }
                continue;
            }
            let arrow_marker = Regex::new(r"[└├]→\s*(.+)$").unwrap();
            if let Some(m) = arrow_marker.captures(trimmed) {
                let rest = m[1].to_string();
                // Extract target skill after first →
                let parts: Vec<&str> = rest.split('→').collect();
                if parts.len() >= 2 {
                    let target_dirty = parts[1].trim();
                    let target = target_dirty
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .trim_matches('`')
                        .to_string();
                    if !target.is_empty() && !target.to_lowercase().contains("stop") && !target.ends_with("-agent") {
                        let from = current_from_skill
                            .clone()
                            .unwrap_or_else(|| current_skill.to_string());
                        let condition = parts.first().map(|s| s.trim().to_string());
                        transitions.push(Transition {
                            from,
                            to: target,
                            trigger: current_skill.to_string(),
                            condition,
                        });
                    }
                }
                // State transitions inside []
                let bracket_re = Regex::new(r"\[([^\]]+)\]").unwrap();
                for bcap in bracket_re.captures_iter(&rest) {
                    let inner = &bcap[1];
                    let state_tokens: Vec<String> = inner
                        .split('→')
                        .map(|s| s.trim().trim_matches('`').to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    for st in &state_tokens {
                        state_names.insert(st.clone());
                    }
                    // Build state-to-state transitions between consecutive tokens.
                    for pair in state_tokens.windows(2) {
                        transitions.push(Transition {
                            from: pair[0].clone(),
                            to: pair[1].clone(),
                            trigger: current_skill.to_string(),
                            condition: None,
                        });
                    }
                }
            }
        }
    }

    // Extract inline states referenced in prose
    let state_re = Regex::new(r"`([a-z][a-z0-9_-]*)`").unwrap();
    for cap in state_re.captures_iter(text) {
        state_names.insert(cap[1].to_string());
    }

    HandoffParseResult {
        transitions: dedupe_transitions(transitions),
        states: state_names.into_iter().collect(),
    }
}

pub fn build_handoff_graph(
    handoffs: &[ParsedHandoffFile],
    state_defs: &HashMap<String, State>,
    canonical: &[String],
    entry_points: &[String],
    terminal_states: &[String],
) -> HandoffGraph {
    let mut nodes: HashMap<String, State> = HashMap::new();
    let mut edges: Vec<Transition> = Vec::new();
    let canonical_set: HashSet<_> = canonical.iter().cloned().collect();
    let terminal_set: HashSet<_> = terminal_states.iter().cloned().collect();

    // Pre-compute the canonical states owned by each skill so prose transitions
    // without an explicit source can be wired from the owning skill's states.
    let mut states_by_skill: HashMap<String, Vec<String>> = HashMap::new();
    for (state_name, state) in state_defs {
        for skill_name in &state.defined_in {
            states_by_skill
                .entry(skill_name.clone())
                .or_default()
                .push(state_name.clone());
        }
    }

    for hf in handoffs {
        for s in &hf.states {
            if canonical_set.contains(s) {
                nodes.entry(s.clone()).or_insert_with(|| State {
                    name: s.clone(),
                    defined_in: Vec::new(),
                    is_terminal: terminal_set.contains(s),
                    is_entry: entry_points.contains(s),
                });
            }
        }

        // Explicit source/target transitions already present in hf.transitions.
        for t in &hf.transitions {
            if canonical_set.contains(&t.from) {
                nodes.entry(t.from.clone()).or_insert_with(|| State {
                    name: t.from.clone(),
                    defined_in: Vec::new(),
                    is_terminal: terminal_set.contains(&t.from),
                    is_entry: entry_points.contains(&t.from),
                });
                edges.push(t.clone());
            }
        }

        // Prose transitions that lacked an explicit source state are wired from
        // every canonical state owned by this skill (except terminal states, so
        // terminal semantics stay intact).
        let owned_states: Vec<String> = states_by_skill
            .get(&hf.skill)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|s| canonical_set.contains(s) && !terminal_set.contains(s))
            .collect();

        for t in &hf.transitions {
            if !canonical_set.contains(&t.to) || t.from.is_empty() {
                continue;
            }
            // This transition was produced from a prose target without an
            // explicit source (from == "" is not possible normally; we flag
            // prose targets by checking whether the source is a skill name or
            // a state). If `t.from` is not a canonical state, treat it as an
            // inferred prose target and wire from owned states.
            if !canonical_set.contains(&t.from) {
                for src in &owned_states {
                    edges.push(Transition {
                        from: src.clone(),
                        to: t.to.clone(),
                        trigger: hf.skill.clone(),
                        condition: t.condition.clone(),
                    });
                }
            }
        }
    }

    // Merge in definitions from skills
    for (name, state) in state_defs {
        nodes
            .entry(name.clone())
            .and_modify(|n| {
                n.defined_in.extend(state.defined_in.clone());
                n.defined_in.sort();
                n.defined_in.dedup();
            })
            .or_insert_with(|| state.clone());
    }

    let entry_nodes: Vec<State> = nodes
        .values()
        .filter(|n| n.is_entry)
        .cloned()
        .collect();

    HandoffGraph {
        nodes: nodes.into_values().collect(),
        edges: dedupe_transitions(edges),
        entry_points: entry_nodes,
    }
}

fn dedupe_transitions(transitions: Vec<Transition>) -> Vec<Transition> {
    let mut seen = HashSet::new();
    transitions
        .into_iter()
        .filter(|t| {
            let key = format!("{}->{}@{}", t.from, t.to, t.trigger);
            seen.insert(key)
        })
        .collect()
}
