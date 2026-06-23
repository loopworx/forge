use crate::parser::handoff::{build_handoff_graph, parse_all_handoffs};
use crate::parser::readme::parse_readme;
use crate::parser::skill::{normalize_states, parse_skill_dir};
use crate::parser::yaml::parse_file;
use crate::types::{Fixture, Repo, Skill};
use std::path::{Path, PathBuf};

impl Repo {
    pub fn from_current_working_dir_parent(ancestors_up: usize) -> std::io::Result<Self> {
        let mut dir = std::env::current_dir()?;
        for _ in 0..ancestors_up {
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
        Self::from_root(dir)
    }

    pub fn from_root(root: PathBuf) -> std::io::Result<Self> {
        let fixture_path = root
            .join("tools/contract-tests/fixtures/loop-contract.yaml");
        let fixture: Fixture = parse_file(&fixture_path).map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("fixture parse error: {}", e),
            )
        })?;

        let skills_dir = root.join("skills");
        let mut skills = discover_skills(&skills_dir)?;
        normalize_states(
            &mut skills,
            &fixture.canonical_states,
            &fixture.terminal_states,
            &fixture.entry_points,
        );

        let handoff_files = parse_all_handoffs(&skills_dir);
        let state_defs = crate::parser::skill::build_state_definitions(&skills);
        let handoff_graph = build_handoff_graph(
            &handoff_files,
            &state_defs,
            &fixture.canonical_states,
            &fixture.entry_points,
            &fixture.terminal_states,
        );

        let readme_skills = parse_readme(&root.join("README.md"));

        Ok(Repo {
            root,
            skills,
            fixture,
            handoff_graph,
            readme_skills,
        })
    }
}

fn discover_skills(skills_dir: &Path) -> std::io::Result<Vec<Skill>> {
    let mut skills = Vec::new();
    if !skills_dir.exists() {
        return Ok(skills);
    }
    for entry in std::fs::read_dir(skills_dir)? {
        let entry = entry?;
        if !entry.metadata()?.is_dir() {
            continue;
        }
        for skill_entry in std::fs::read_dir(entry.path())? {
            let skill_entry = skill_entry?;
            if !skill_entry.metadata()?.is_dir() {
                continue;
            }
            if let Some(skill) = parse_skill_dir(&skill_entry.path()) {
                skills.push(skill);
            }
        }
    }
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}
