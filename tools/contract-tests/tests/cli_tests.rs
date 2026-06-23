//! CLI binary integration tests.

use std::process::Command;

fn bin() -> Command {
    let mut cmd = Command::new(std::env!("CARGO_BIN_EXE_forge-contract-tests"));
    cmd.current_dir(env!("CARGO_MANIFEST_DIR"));
    cmd
}

#[test]
fn cli_passes_against_real_repo() {
    let output = bin().output().expect("run binary");
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        output.status.success(),
        "binary should exit 0 against the real repo; stderr:\n{}\nstdout:\n{}",
        String::from_utf8_lossy(&output.stderr),
        stdout
    );
    assert!(
        stdout.contains("All contract checks passed"),
        "expected success banner, got:\n{}",
        stdout
    );
}

#[test]
fn cli_json_mode_passes_against_real_repo() {
    let output = bin().arg("--json").output().expect("run binary with --json");
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        output.status.success(),
        "binary --json should exit 0; stderr:\n{}\nstdout:\n{}",
        String::from_utf8_lossy(&output.stderr),
        stdout
    );
    let parsed: serde_json::Value = serde_json::from_str(&stdout).expect("valid JSON output");
    assert!(parsed.is_array(), "json output should be an array");
    assert!(parsed.as_array().unwrap().is_empty(), "expected empty diagnostics array");
}

#[test]
fn cli_json_mode_reports_errors_for_bad_repo() {
    let bad_root = std::env::temp_dir().join("forge-contract-tests-bad-root");
    let _ = std::fs::remove_dir_all(&bad_root);

    // Mirror the layout the binary expects: running from
    // <repo>/tools/contract-tests it walks up two parents to find repo root.
    let cwd = bad_root.join("tools/contract-tests");
    std::fs::create_dir_all(&cwd).unwrap();
    std::fs::write(bad_root.join("README.md"), "").unwrap();
    std::fs::write(
        bad_root.join("project.constraints.yaml"),
        "priorities:\n  quality: 1\n",
    )
    .unwrap();
    // Copy the canonical fixture so loading succeeds but repo contents fail validation.
    let fixture_src = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/loop-contract.yaml");
    let fixture_dst = bad_root.join("tools/contract-tests/fixtures/loop-contract.yaml");
    std::fs::create_dir_all(fixture_dst.parent().unwrap()).unwrap();
    std::fs::copy(&fixture_src, &fixture_dst).unwrap();

    let output = bin()
        .arg("--json")
        .current_dir(&cwd)
        .output()
        .expect("run binary in bad repo");
    assert!(!output.status.success(), "expected non-zero exit for bad repo");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).expect("valid JSON output");
    assert!(
        parsed.is_array() && !parsed.as_array().unwrap().is_empty(),
        "expected non-empty diagnostics array, got {}",
        parsed
    );
}
