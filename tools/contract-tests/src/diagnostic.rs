use crate::types::{Diagnostic, FileLocation, Severity};
use std::path::Path;

pub fn at_path(path: &Path) -> FileLocation {
    FileLocation {
        path: path.to_path_buf(),
        line: None,
        column: None,
    }
}

pub fn at_line(path: &Path, line: usize) -> FileLocation {
    FileLocation {
        path: path.to_path_buf(),
        line: Some(line),
        column: None,
    }
}

pub fn diagnostic(
    severity: Severity,
    code: impl Into<String>,
    message: impl Into<String>,
    location: FileLocation,
    help: impl Into<String>,
) -> Diagnostic {
    Diagnostic {
        severity,
        code: code.into(),
        message: message.into(),
        location,
        help: help.into(),
    }
}

pub fn format_diagnostics(diagnostics: &[Diagnostic]) -> String {
    if diagnostics.is_empty() {
        return "All contract checks passed ✅".to_string();
    }
    let mut lines: Vec<String> = Vec::new();
    let (errors, warnings): (Vec<_>, Vec<_>) = diagnostics
        .iter()
        .partition(|d| matches!(d.severity, Severity::Error));
    for (label, group) in [("ERRORS", errors), ("WARNINGS", warnings)] {
        if !group.is_empty() {
            lines.push(format!("\n{} ({})", label, group.len()));
            for d in group {
                lines.push(format_diagnostic(d));
            }
        }
    }
    lines.join("\n")
}

pub fn format_diagnostic(d: &Diagnostic) -> String {
    let loc = match (d.location.line, d.location.column) {
        (Some(l), Some(c)) => format!("{}:{}:{}", d.location.path.display(), l, c),
        (Some(l), None) => format!("{}:{}", d.location.path.display(), l),
        _ => d.location.path.display().to_string(),
    };
    let severity = match d.severity {
        Severity::Error => "ERROR",
        Severity::Warning => "WARN",
        Severity::Info => "INFO",
    };
    format!(
        "[{}] {}: {}\n  → {}\n  → help: {}",
        severity, d.code, d.message, loc, d.help
    )
}

pub fn diagnostics_json(diagnostics: &[Diagnostic]) -> String {
    serde_json::to_string_pretty(diagnostics).unwrap_or_else(|_| "[]".to_string())
}
