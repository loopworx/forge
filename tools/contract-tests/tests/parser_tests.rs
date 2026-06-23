//! Unit tests for the markdown and YAML parsers.
//!
//! These tests are isolated — they construct a tiny SKILL.md or HANDOFFS.md in
//! memory and verify the parser extracts the expected fields.

use forge_contract_tests::parser::handoff::parse_handoff_text;
use forge_contract_tests::parser::readme::parse_readme;
use forge_contract_tests::parser::skill::{extract_state_names, normalize_states, parse_skill_text};
use forge_contract_tests::parser::yaml::parse_str;
use forge_contract_tests::parser::{extract_yaml_frontmatter, parse_markdown_headings};
use forge_contract_tests::types::{Skill, SkillCategory, SkillLevel};

// ────────────────────────── YAML / frontmatter ──────────────────────────

#[test]
fn yaml_frontmatter_extracts_simple_block() {
    let text = "---\nname: foo\nlevel: L1-RIGID\n---\n\n# foo\n\nBody.\n";
    let (fm, body) = extract_yaml_frontmatter(text).expect("frontmatter");
    assert!(fm.contains("name: foo"));
    assert!(body.contains("# foo"));
    assert!(!body.starts_with("---"));
}

#[test]
fn yaml_frontmatter_absent_returns_none() {
    let text = "# foo\n\nBody without frontmatter.\n";
    assert!(extract_yaml_frontmatter(text).is_none());
}

#[test]
fn yaml_frontmatter_handles_crlf() {
    let text = "---\r\nname: foo\r\n---\r\nbody\r\n";
    let (fm, body) = extract_yaml_frontmatter(text).expect("frontmatter");
    assert!(fm.contains("name: foo"));
    assert!(body.contains("body"));
}

#[test]
fn yaml_parses_fixture_typed() {
    let yaml = "metadata:\n  version: 1.0.0\n  last_updated: 2026-06-21\n  description: test\nloops:\n  - skill: a\n    category: meta\n    level: L1-RIGID\n    owner: [all-agents]\n    has_loop: true\n    description: x\ncanonical_states:\n  - in-analysis\nterminal_states: [done]\nentry_points: [in-analysis]\nentry_triggers: []\nrequired_loop_sections: []\nrequired_skill_sections:\n  all_levels: []\n  l1_rigid_only: []\nhandoff_graph_invariants: []\n";
    let fixture: forge_contract_tests::types::Fixture =
        parse_str(yaml).expect("parse");
    assert_eq!(fixture.metadata.version, "1.0.0");
    assert_eq!(fixture.loops.len(), 1);
    assert_eq!(fixture.loops[0].skill, "a");
    assert!(fixture.loops[0].has_loop);
    assert_eq!(fixture.terminal_states, vec!["done"]);
}

// ────────────────────────── Markdown headings ──────────────────────────

#[test]
fn heading_parser_extracts_h1_h2_h3() {
    let md = "# Title\n\n## Section\n\n### Sub\n";
    let h = parse_markdown_headings(md);
    assert_eq!(h, vec![(1, "Title".to_string()), (2, "Section".to_string()), (3, "Sub".to_string())]);
}

#[test]
fn heading_parser_skips_yaml_frontmatter() {
    // The parser doesn't know about frontmatter; the calling code (extract_yaml_frontmatter)
    // strips it first. After stripping, only real headings remain.
    let (fm, body) = extract_yaml_frontmatter("---\nfoo: bar\n---\n# Real\n## Real Two\n").unwrap();
    let _ = fm;
    let h = parse_markdown_headings(body);
    assert_eq!(h, vec![(1, "Real".to_string()), (2, "Real Two".to_string())]);
}

#[test]
fn heading_parser_handles_inline_code_in_heading() {
    let md = "## `running-atdd-sessions` skill\n";
    let h = parse_markdown_headings(md);
    assert_eq!(h, vec![(2, "running-atdd-sessions skill".to_string())]);
}

// ────────────────────────── SKILL.md parser ──────────────────────────

#[test]
fn skill_parser_extracts_yaml_fields() {
    let text = "---\nname: using-forge\nlevel: L1-RIGID\nowner: all-agents\ntrigger: every session\n---\n\n# using-forge\n\n## Description\n\nConductor.\n";
    let parsed = parse_skill_text(text);
    assert_eq!(parsed.name, "using-forge");
    assert_eq!(parsed.level, Some(SkillLevel::L1Rigid));
    assert_eq!(parsed.owner.len(), 1);
    assert!(parsed.sections.contains(&"Description".to_string()));
}

#[test]
fn skill_parser_owner_accepts_string_or_list() {
    let single = "---\nname: a\nowner: developer-agent\n---\n# a\n";
    let parsed = parse_skill_text(single);
    assert_eq!(parsed.owner.len(), 1);

    let multiple = "---\nname: a\nowner:\n  - developer-agent\n  - qa-agent\n---\n# a\n";
    let parsed = parse_skill_text(multiple);
    assert_eq!(parsed.owner.len(), 2);
}

#[test]
fn skill_parser_recognizes_the_loop_as_state_model_alias() {
    // `## The Loop` should be one of the section headings.
    let text = "---\nname: a\n---\n# a\n\n## Description\n\nText.\n\n## The Loop\n\nStates here.\n\n## Rules\n\nRules here.\n";
    let parsed = parse_skill_text(text);
    assert!(parsed.sections.iter().any(|s| s == "The Loop"));
}

#[test]
fn skill_parser_extracts_state_names() {
    let text = "Story moves to `ready-for-dev` and `in-dev`. Then `in-qa`.";
    let states = extract_state_names(text);
    for expected in ["ready-for-dev", "in-dev", "in-qa"] {
        assert!(states.contains(&expected.to_string()), "missing {expected}");
    }
    // Should NOT include non-state backtick tokens like `npm`, `test`.
    assert!(!states.contains(&"npm".to_string()));
    assert!(!states.contains(&"test".to_string()));
}

#[test]
fn skill_parser_extracts_states_from_arrow_chains() {
    let text = "`in-analysis` → `ready-for-dev` → `in-dev`";
    let states = extract_state_names(text);
    for s in ["in-analysis", "ready-for-dev", "in-dev"] {
        assert!(states.contains(&s.to_string()));
    }
}

#[test]
fn skill_parser_extracts_states_from_code_blocks() {
    let text = "Intro text.\n\n```\nin-analysis → ready-for-dev → in-dev\n```\n\nMore text.";
    let states = extract_state_names(text);
    assert!(states.contains(&"in-analysis".to_string()));
    assert!(states.contains(&"ready-for-dev".to_string()));
    assert!(states.contains(&"in-dev".to_string()));
}

#[test]
fn skill_parser_handles_missing_frontmatter() {
    let text = "# a\n\n## Description\n\nJust a heading and body.\n";
    let parsed = parse_skill_text(text);
    assert_eq!(parsed.name, "a");
    assert!(parsed.level.is_none());
}

#[test]
fn normalize_states_filters_to_canonical() {
    let mut skills = vec![Skill {
        name: "a".to_string(),
        category: SkillCategory::Meta,
        path: Default::default(),
        level: SkillLevel::L3Mech,
        owner: vec![],
        sections: vec![],
        states: vec![
            forge_contract_tests::types::State {
                name: "ready-for-dev".to_string(),
                defined_in: vec!["a".to_string()],
                is_terminal: false,
                is_entry: false,
            },
            forge_contract_tests::types::State {
                name: "magic-state".to_string(),
                defined_in: vec!["a".to_string()],
                is_terminal: false,
                is_entry: false,
            },
        ],
        has_handoffs: false,
        has_loop: false,
    }];
    normalize_states(
        &mut skills,
        &["ready-for-dev".to_string()],
        &["done".to_string()],
        &["ready-for-dev".to_string()],
    );
    assert_eq!(skills[0].states.len(), 1);
    assert_eq!(skills[0].states[0].name, "ready-for-dev");
    assert!(skills[0].states[0].is_entry);
    assert!(!skills[0].states[0].is_terminal);
}

// ────────────────────────── HANDOFFS.md parser ──────────────────────────

#[test]
fn handoff_parser_extracts_prose_routes() {
    let text = "# foo — Handoffs\n\n## On PASS\n\nReturn to `running-desk-checks`.\n";
    let parsed = parse_handoff_text(text, "foo");
    let targets: Vec<_> = parsed.transitions.iter().map(|t| t.to.clone()).collect();
    assert!(targets.contains(&"running-desk-checks".to_string()));
}

#[test]
fn handoff_parser_extracts_prose_trigger_phrases() {
    let text = "**Routes to:** `validating-test-harness`\n\n**Trigger:** `running-atdd-sessions`\n";
    let parsed = parse_handoff_text(text, "validating-test-harness");
    let targets: Vec<_> = parsed.transitions.iter().map(|t| t.to.clone()).collect();
    assert!(targets.contains(&"validating-test-harness".to_string()));
    assert!(targets.contains(&"running-atdd-sessions".to_string()));
}

#[test]
fn handoff_parser_skips_agent_labels() {
    let text = "Caller: developer-agent\nTriggered by: qa-agent\nReturn to `running-atdd-sessions`.\n";
    let parsed = parse_handoff_text(text, "foo");
    for t in &parsed.transitions {
        assert!(!t.to.ends_with("-agent"));
    }
    assert!(parsed.transitions.iter().any(|t| t.to == "running-atdd-sessions"));
}

#[test]
fn handoff_parser_extracts_tree_format() {
    let text = "\
```
using-forge
  └→ any → running-atdd-sessions (developer-agent) [in-analysis → ready-for-dev]
```
";
    let parsed = parse_handoff_text(text, "using-forge");
    let t = parsed
        .transitions
        .iter()
        .find(|t| t.to == "running-atdd-sessions")
        .expect("tree transition");
    assert_eq!(t.from, "using-forge");
    // State transition captured
    assert!(parsed.states.contains(&"in-analysis".to_string()));
    assert!(parsed.states.contains(&"ready-for-dev".to_string()));
}

#[test]
fn handoff_parser_tree_stops_at_terminal() {
    let text = "\
```
finishing-stories
  └→ PASS → STOP; post to Linear; await human
```
";
    let parsed = parse_handoff_text(text, "finishing-stories");
    // STOP is terminal — should not become a transition target
    assert!(parsed.transitions.iter().all(|t| !t.to.contains("STOP")));
}

#[test]
fn handoff_parser_handles_mixed_prose_and_tree() {
    let text = "\
# foo — Handoffs

## On PASS

**Action:** Move to `ready-to-deploy`
Return to `using-forge`.

```
foo
  └→ explicit → bar
```
";
    let parsed = parse_handoff_text(text, "foo");
    // Prose + tree targets should both appear
    let targets: Vec<_> = parsed.transitions.iter().map(|t| t.to.clone()).collect();
    assert!(targets.contains(&"using-forge".to_string()));
    assert!(targets.contains(&"bar".to_string()));
}

#[test]
fn handoff_parser_dedupes_repeated_transitions() {
    let text = "**Routes to:** `bar`\n**Routes to:** `bar`\n";
    let parsed = parse_handoff_text(text, "foo");
    let count = parsed.transitions.iter().filter(|t| t.to == "bar").count();
    assert_eq!(count, 1);
}

// ────────────────────────── README parser ──────────────────────────

#[test]
fn readme_parser_extracts_backtick_skill_names() {
    let dir = tempfile::tempdir().unwrap();
    let readme = dir.path().join("README.md");
    std::fs::write(&readme, "Use `using-forge` and `running-atdd-sessions`.").unwrap();
    let refs = parse_readme(&readme);
    assert!(refs.contains(&"using-forge".to_string()));
    assert!(refs.contains(&"running-atdd-sessions".to_string()));
    // Should not include generic backtick tokens like `npm`
    assert!(!refs.contains(&"npm".to_string()));
}

#[test]
fn readme_parser_extracts_skill_path_references() {
    let dir = tempfile::tempdir().unwrap();
    let readme = dir.path().join("README.md");
    std::fs::write(&readme, "See skills/meta/using-forge/ for details.").unwrap();
    let refs = parse_readme(&readme);
    assert!(refs.contains(&"using-forge".to_string()));
}

// ────────────────────────── SkillCategory ──────────────────────────

#[test]
fn skill_category_round_trip() {
    for cat in [
        SkillCategory::Meta,
        SkillCategory::Discovery,
        SkillCategory::Architecture,
        SkillCategory::Development,
        SkillCategory::Quality,
        SkillCategory::IterationZero,
        SkillCategory::AcceptanceDelivery,
    ] {
        let dir = cat.as_dir_name();
        let back = SkillCategory::from_dir_name(dir).expect("from_dir_name");
        assert_eq!(format!("{:?}", cat), format!("{:?}", back));
    }
}
