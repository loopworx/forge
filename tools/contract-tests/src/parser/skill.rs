use crate::parser::{extract_yaml_frontmatter, load_text, parse_markdown_headings};
use crate::types::{AgentRole, Skill, SkillCategory, SkillLevel, State};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::path::Path;

pub struct ParsedSkill {
    pub name: String,
    pub level: Option<SkillLevel>,
    pub owner: Vec<AgentRole>,
    pub sections: Vec<String>,
    pub states: Vec<State>,
    pub section_headings: Vec<(usize, String)>,
}

pub fn parse_skill_dir(dir: &Path) -> Option<Skill> {
    let skill_md = dir.join("SKILL.md");
    if !skill_md.exists() {
        return None;
    }
    let text = load_text(&skill_md).ok()?;
    let parsed = parse_skill_text(&text);
    let category = dir
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .and_then(SkillCategory::from_dir_name)
        .unwrap_or(SkillCategory::Meta);
    Some(Skill {
        name: parsed.name,
        category,
        path: dir.to_path_buf(),
        level: parsed.level.unwrap_or(SkillLevel::L3Mech),
        owner: parsed.owner,
        sections: parsed.sections,
        states: parsed.states,
        has_handoffs: dir.join("HANDOFFS.md").exists(),
        has_loop: dir.join("LOOP.md").exists(),
    })
}

pub fn parse_skill_text(text: &str) -> ParsedSkill {
    let fm_body = extract_yaml_frontmatter(text);
    let front = fm_body.map(|(f, _)| f).unwrap_or("");
    let body = fm_body.map(|(_, b)| b).unwrap_or(text);
    let mut name = String::new();
    let mut level = None;
    let mut owner = Vec::new();

    if let Ok(value) = serde_yml::from_str::<serde_yml::Value>(front) {
        if let Some(n) = value.get("name") {
            name = n.as_str().map(|s| s.to_string()).unwrap_or_default();
        }
        if let Some(l) = value.get("level") {
            level = l.as_str().and_then(SkillLevel::from_str);
        }
        if let Some(o) = value.get("owner") {
            if let Some(arr) = o.as_sequence() {
                owner = arr
                    .iter()
                    .filter_map(|v| v.as_str().and_then(AgentRole::from_str))
                    .collect();
            } else if let Some(s) = o.as_str() {
                owner = s.split(',').filter_map(|p| AgentRole::from_str(p.trim())).collect();
            }
        }
    }

    if name.is_empty() {
        if let Some(first_line) = body.lines().find(|l| !l.trim().is_empty()) {
            let clean = first_line.trim().trim_start_matches("#").trim();
            name = clean.to_string();
        }
    }

    let headings = parse_markdown_headings(body);
    let sections: Vec<String> = headings
        .iter()
        .filter(|(level, _)| *level == 2)
        .map(|(_, text)| text.clone())
        .collect();

    let state_names = extract_state_names(body);
    let states: Vec<State> = state_names
        .into_iter()
        .map(|n| State {
            name: n,
            defined_in: vec![name.clone()],
            is_terminal: false,
            is_entry: false,
        })
        .collect();

    ParsedSkill {
        name,
        level,
        owner,
        sections,
        states,
        section_headings: headings,
    }
}

pub fn extract_state_names(text: &str) -> Vec<String> {
    let re = Regex::new(r"`([a-z][a-z0-9_-]*)`").unwrap();
    let state_re = Regex::new(r"^[a-z][a-z0-9_-]*$").unwrap();
    let mut candidates: HashSet<String> = HashSet::new();
    for cap in re.captures_iter(text) {
        candidates.insert(cap[1].to_string());
    }
    // Code blocks
    let fenced_re = Regex::new(r"```[\s\S]*?```").unwrap();
    for mat in fenced_re.find_iter(text) {
        for cap in re.captures_iter(mat.as_str()) {
            candidates.insert(cap[1].to_string());
        }
    }
    // Arrow chains: split each line on `→` and pick up adjacent state names.
    let arrow_re = Regex::new(r"\s*→\s*").unwrap();
    for line in text.lines() {
        let trimmed = line.trim().trim_matches('`');
        if !trimmed.contains('→') {
            continue;
        }
        for token in arrow_re.split(trimmed) {
            let token = token.trim().trim_matches('`');
            if token.is_empty() {
                continue;
            }
            if state_re.is_match(token) {
                candidates.insert(token.to_string());
            }
        }
    }
    // Bullet list items under a State Model section: `- in-strange-state`
    let mut in_state_model = false;
    for line in text.lines() {
        if line.starts_with("# ") || line.starts_with("## ") {
            in_state_model = line.to_lowercase().contains("state model")
                || line.to_lowercase().contains("the loop")
                || line.to_lowercase().contains("loop state")
                || line.to_lowercase().contains("states");
            continue;
        }
        if in_state_model {
            let stripped = line.trim_start_matches(|c: char| c == '-' || c == '*' || c.is_whitespace());
            if state_re.is_match(stripped) && !stripped.contains(' ') {
                candidates.insert(stripped.to_string());
            }
        }
    }
    candidates.into_iter().collect()
}

pub fn normalize_states(
    skills: &mut [Skill],
    canonical: &[String],
    terminal: &[String],
    entries: &[String],
) {
    let canonical_set: HashSet<_> = canonical.iter().cloned().collect();
    for skill in skills.iter_mut() {
        skill.states.retain(|s| canonical_set.contains(&s.name));
        for state in skill.states.iter_mut() {
            state.is_terminal = terminal.contains(&state.name);
            state.is_entry = entries.contains(&state.name);
        }
    }
}

pub fn build_state_definitions(skills: &[Skill]) -> HashMap<String, State> {
    let mut map: HashMap<String, State> = HashMap::new();
    for skill in skills {
        for state in &skill.states {
            map.entry(state.name.clone())
                .or_insert_with(|| State {
                    name: state.name.clone(),
                    defined_in: Vec::new(),
                    is_terminal: state.is_terminal,
                    is_entry: state.is_entry,
                })
                .defined_in
                .push(skill.name.clone());
        }
    }
    map
}
