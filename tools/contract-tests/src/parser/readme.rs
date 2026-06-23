use regex::Regex;
use std::collections::HashSet;
use std::path::Path;

pub fn parse_readme(path: &Path) -> Vec<String> {
    let text = std::fs::read_to_string(path).unwrap_or_default();
    let mut refs = HashSet::new();

    // Backtick skill references
    let re = Regex::new(r"`([a-z][a-z0-9_-]+)`").unwrap();
    for cap in re.captures_iter(&text) {
        refs.insert(cap[1].to_string());
    }

    // Explicit path references skills/.../
    let path_re = Regex::new(r"skills/([a-z][a-z0-9_-]+)/([a-z][a-z0-9_-]+)/?").unwrap();
    for cap in path_re.captures_iter(&text) {
        refs.insert(cap[2].to_string());
    }

    refs.into_iter().collect()
}
