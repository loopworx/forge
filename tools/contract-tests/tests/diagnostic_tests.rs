//! Tests for diagnostic formatting helpers.

use forge_contract_tests::diagnostic::{diagnostics_json, format_diagnostic, format_diagnostics};
use forge_contract_tests::types::{Diagnostic, FileLocation, Severity};

fn sample_diagnostic(severity: Severity, code: &str, message: &str, help: &str) -> Diagnostic {
    Diagnostic {
        severity,
        code: code.to_string(),
        message: message.to_string(),
        location: FileLocation {
            path: std::path::PathBuf::from("skills/meta/using-forge/SKILL.md"),
            line: Some(12),
            column: Some(3),
        },
        help: help.to_string(),
    }
}

#[test]
fn format_diagnostics_empty_returns_success_message() {
    let out = format_diagnostics(&[]);
    assert_eq!(out, "All contract checks passed ✅");
}

#[test]
fn format_diagnostics_groups_errors_and_warnings() {
    let diagnostics = vec![
        sample_diagnostic(Severity::Error, "E1", "missing loop", "add LOOP.md"),
        sample_diagnostic(Severity::Warning, "W1", "low coverage", "add tests"),
    ];
    let out = format_diagnostics(&diagnostics);
    assert!(out.contains("ERRORS (1)"));
    assert!(out.contains("WARNINGS (1)"));
    assert!(out.contains("[ERROR] E1: missing loop"));
    assert!(out.contains("[WARN] W1: low coverage"));
}

#[test]
fn format_diagnostics_warning_only_no_error_section() {
    let diagnostics = vec![sample_diagnostic(Severity::Warning, "W2", "x", "y")];
    let out = format_diagnostics(&diagnostics);
    assert!(!out.contains("ERRORS"));
    assert!(out.contains("WARNINGS (1)"));
}

#[test]
fn format_diagnostic_includes_line_and_column() {
    let d = sample_diagnostic(Severity::Info, "I1", "note", "helpful");
    let out = format_diagnostic(&d);
    assert!(out.contains("[INFO] I1: note"));
    assert!(out.contains("skills/meta/using-forge/SKILL.md:12:3"));
    assert!(out.contains("help: helpful"));
}

#[test]
fn diagnostics_json_serializes_empty_array() {
    let out = diagnostics_json(&[]);
    assert_eq!(out, "[]");
}

#[test]
fn diagnostics_json_serializes_diagnostics() {
    let d = sample_diagnostic(Severity::Error, "E2", "bad", "fix");
    let out = diagnostics_json(&[d]);
    assert!(out.contains("\"code\": \"E2\""));
    assert!(out.contains("\"severity\": \"error\""));
}
