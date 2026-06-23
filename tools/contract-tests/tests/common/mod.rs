//! Test fixture scaffolding.
//!
//! Provides helpers to construct an ephemeral Forge repository on disk with
//! arbitrary skills, fixtures, README, and constraints, then load it via
//! `Repo::from_root` and run validators against it.
//!
//! All tests should use these helpers rather than mutating the real repo.

#![allow(dead_code)]

use std::fs;
use std::path::{Path, PathBuf};

/// A builder for ephemeral Forge repos used in tests.
///
/// Each builder is consumed by `build()` which materializes the on-disk repo
/// and returns its root path. The repo is automatically cleaned up when the
/// returned `TempRepo` is dropped.
pub struct RepoBuilder {
    tempdir: tempfile::TempDir,
    skills: Vec<SkillSpec>,
    fixture: Option<String>,
    constraints: Option<String>,
    readme: Option<String>,
    loop_state_files: Vec<(String, String)>,
}

#[derive(Clone)]
pub struct SkillSpec {
    pub category: String,
    pub name: String,
    pub level: String,
    pub owner: String,
    pub skill_md: String,
    pub handoffs_md: Option<String>,
    pub loop_md: Option<String>,
}

impl RepoBuilder {
    pub fn new() -> Self {
        Self {
            tempdir: tempfile::tempdir().expect("create tempdir"),
            skills: Vec::new(),
            fixture: None,
            constraints: None,
            readme: None,
            loop_state_files: Vec::new(),
        }
    }

    pub fn with_skill(mut self, spec: SkillSpec) -> Self {
        self.skills.push(spec);
        self
    }

    pub fn with_fixture(mut self, fixture_yaml: &str) -> Self {
        self.fixture = Some(fixture_yaml.to_string());
        self
    }

    pub fn with_constraints(mut self, yaml: &str) -> Self {
        self.constraints = Some(yaml.to_string());
        self
    }

    pub fn with_readme(mut self, content: &str) -> Self {
        self.readme = Some(content.to_string());
        self
    }

    pub fn with_loop_state_file(mut self, path: &str, content: &str) -> Self {
        self.loop_state_files.push((path.to_string(), content.to_string()));
        self
    }

    pub fn build(self) -> TempRepo {
        let root = self.tempdir.path().to_path_buf();
        write_file(&root.join("README.md"), self.readme.as_deref().unwrap_or(""));
        write_file(
            &root.join("project.constraints.yaml"),
            self.constraints.as_deref().unwrap_or("priorities:\n  quality: 1\n"),
        );

        if let Some(fixture) = self.fixture {
            write_file(
                &root.join("tools/contract-tests/fixtures/loop-contract.yaml"),
                &fixture,
            );
        }

        for skill in &self.skills {
            let dir = root.join("skills").join(&skill.category).join(&skill.name);
            fs::create_dir_all(&dir).unwrap();
            write_file(&dir.join("SKILL.md"), &skill.skill_md);
            if let Some(h) = &skill.handoffs_md {
                write_file(&dir.join("HANDOFFS.md"), h);
            }
            if let Some(l) = &skill.loop_md {
                write_file(&dir.join("LOOP.md"), l);
            }
        }

        for (path, content) in &self.loop_state_files {
            let full = root.join(path);
            if let Some(parent) = full.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            write_file(&full, content);
        }

        TempRepo {
            tempdir: self.tempdir,
            root,
        }
    }
}

impl Default for RepoBuilder {
    fn default() -> Self {
        Self::new()
    }
}

pub struct TempRepo {
    pub tempdir: tempfile::TempDir,
    pub root: PathBuf,
}

impl TempRepo {
    pub fn path(&self) -> &Path {
        &self.root
    }
}

fn write_file(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, content).unwrap();
}

/// The canonical fixture used by most tests.
pub fn canonical_fixture() -> String {
    include_str!("../fixtures/canonical-loop-contract.yaml").to_string()
}

/// Standard "perfect" 5-skill library used as a happy-path fixture.
pub fn perfect_skill_library() -> Vec<SkillSpec> {
    vec![
        SkillSpec {
            category: "meta".to_string(),
            name: "using-forge".to_string(),
            level: "L1-RIGID".to_string(),
            owner: "all-agents".to_string(),
            skill_md: skill_md_with_required_sections(
                "using-forge",
                "L1-RIGID",
                "all-agents",
                &[("State Model", "## State Model\n\n- in-analysis\n- ready-for-dev\n")],
                &[("Entry Conditions", "## Entry Conditions\n- new session"), ("Halt Conditions", "## Halt Conditions\n- unknown state")],
            ),
            handoffs_md: Some(
                "# using-forge — Handoff Map\n\n## Pull Protocol\n\n```\nusing-forge\n  └→ any → running-atdd-sessions (developer-agent) [in-analysis → ready-for-dev]\n  └→ claim → running-atdd-sessions (developer-agent) [ready-for-dev → in-dev]\n```\n"
                .to_string(),
            ),
            loop_md: Some(perfect_loop_md()),
        },
        SkillSpec {
            category: "development".to_string(),
            name: "running-atdd-sessions".to_string(),
            level: "L1-RIGID".to_string(),
            owner: "developer-agent".to_string(),
            skill_md: skill_md_with_required_sections(
                "running-atdd-sessions",
                "L1-RIGID",
                "developer-agent",
                &[("State Model", "## State Model\n\n- in-dev\n- ready-for-qa\n")],
                &[("Entry Conditions", "## Entry Conditions\n- story in in-dev"), ("Halt Conditions", "## Halt Conditions\n- outer AT unexpectedly green")],
            ),
            handoffs_md: Some(
                "# running-atdd-sessions — Handoffs\n\n\
                 ## On AC GREEN\n\n\
                 ```\n\
                 running-atdd-sessions\n\
                   └→ AC done → running-desk-checks (qa-agent) [in-dev → ready-for-qa]\n\
                 ```\n\
                 ## On desk check APPROVED\n\n\
                 Return to `running-desk-checks` after `ready-for-qa`.\n\n\
                 ```\n\
                 running-atdd-sessions\n\
                   └→ deskcheck passes → running-atdd-sessions (developer-agent) [ready-for-qa → in-dev]\n\
                 ```\n\
                 ## On desk check pending\n\n\
                 ```\n\
                 running-atdd-sessions\n\
                   └→ desk check pending → running-desk-checks (qa-agent) [ready-for-qa → in-deskcheck]\n\
                 ```\n\
                 ## Story complete\n\n\
                 ```\n\
                 running-atdd-sessions\n\
                   └→ all ACs done → finishing-stories (po-agent) [in-dev → done]\n\
                 ```\n"
                .to_string(),
            ),
            loop_md: Some(perfect_loop_md()),
        },
        SkillSpec {
            category: "quality".to_string(),
            name: "running-desk-checks".to_string(),
            level: "L2-GUIDED".to_string(),
            owner: "qa-agent".to_string(),
            skill_md: skill_md_with_required_sections(
                "running-desk-checks",
                "L2-GUIDED",
                "qa-agent",
                &[("State Model", "## State Model\n\n- in-deskcheck\n- ready-for-qa\n")],
                &[],
            ),
            handoffs_md: Some(
                "# running-desk-checks\n\n\
                 ## On APPROVED\n\n\
                 ```\n\
                 running-desk-checks\n\
                   └→ APPROVED → running-atdd-sessions (developer-agent) [in-deskcheck → ready-for-qa]\n\
                 ```\n"
                .to_string(),
            ),
            loop_md: Some(perfect_loop_md()),
        },
        SkillSpec {
            category: "meta".to_string(),
            name: "loop-guardian".to_string(),
            level: "L1-RIGID".to_string(),
            owner: "all-agents".to_string(),
            skill_md: skill_md_with_required_sections(
                "loop-guardian",
                "L1-RIGID",
                "all-agents",
                &[("State Model", "## State Model\n\n- any-state\n")],
                &[("Entry Conditions", "## Entry Conditions\n- before any loop step"), ("Halt Conditions", "## Halt Conditions\n- unsafe state")],
            ),
            handoffs_md: Some(
                "# loop-guardian — Handoffs\n\n\
                 ## On CLEARED\n\n\
                 Return control to the calling skill.\n\n\
                 ## On HALTED\n\n\
                 Post halt reason to Linear and wait for human.\n"
                .to_string(),
            ),
            loop_md: Some(perfect_loop_md()),
        },
        SkillSpec {
            category: "acceptance-delivery".to_string(),
            name: "finishing-stories".to_string(),
            level: "L3-MECH".to_string(),
            owner: "po-agent".to_string(),
            skill_md: skill_md_with_required_sections(
                "finishing-stories",
                "L3-MECH",
                "po-agent",
                &[("State Model", "## State Model\n\n- done\n")],
                &[],
            ),
            handoffs_md: Some(
                "# finishing-stories — Handoffs\n\n\
                 Story is complete. No further skill handoffs.\n"
                .to_string(),
            ),
            loop_md: None,
        },
    ]
}

pub fn skill_md_with_required_sections(
    name: &str,
    level: &str,
    owner: &str,
    extra_h2: &[(&str, &str)],
    l1_extras: &[(&str, &str)],
) -> String {
    let mut s = format!(
        "---\nname: {name}\nlevel: {level}\nowner: {owner}\ntrigger: always\n---\n\n# {name}\n\n## Description\n\nA test skill.\n\n## Rules\n\n1. Follow process.\n"
    );
    for (heading, body) in extra_h2 {
        s.push_str(&format!("\n{} {}\n{}\n", "##", heading, body));
    }
    for (heading, body) in l1_extras {
        s.push_str(&format!("\n{} {}\n{}\n", "##", heading, body));
    }
    s
}

pub fn perfect_loop_md() -> String {
    let canonical = [
        "Entry Conditions",
        "Loop State Schema",
        "Single Iteration Step",
        "Proof of Progress",
        "State Transition Rule",
        "Halt Conditions",
        "Handoff Target",
    ];
    let mut out = String::from("# Skill — Loop\n\n");
    for h in canonical {
        out.push_str(&format!("## {}\n\nBody text.\n\n", h));
    }
    out
}

/// Helpers for finding diagnostics.
pub fn has_code(diagnostics: &[forge_contract_tests::types::Diagnostic], prefix: &str) -> bool {
    diagnostics.iter().any(|d| d.code.starts_with(prefix))
}

pub fn count_with_prefix(
    diagnostics: &[forge_contract_tests::types::Diagnostic],
    prefix: &str,
) -> usize {
    diagnostics
        .iter()
        .filter(|d| d.code.starts_with(prefix))
        .count()
}
