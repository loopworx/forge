use forge_contract_tests::diagnostic::{diagnostics_json, format_diagnostics};
use forge_contract_tests::types::Repo;
use forge_contract_tests::validators::run_all;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let json = args.iter().any(|a| a == "--json");

    let repo = Repo::from_current_working_dir_parent(2).expect("load repo");
    let diagnostics = run_all(&repo);

    if json {
        println!("{}", diagnostics_json(&diagnostics));
    } else {
        println!("{}", format_diagnostics(&diagnostics));
    }

    let errors = diagnostics
        .iter()
        .filter(|d| matches!(d.severity, forge_contract_tests::types::Severity::Error))
        .count();
    if errors > 0 {
        std::process::exit(1);
    }
}
