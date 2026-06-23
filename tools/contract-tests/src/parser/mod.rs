pub mod constraints;
pub mod handoff;
pub mod readme;
pub mod skill;
pub mod yaml;

use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use std::path::Path;

pub fn parse_markdown_headings(text: &str) -> Vec<(usize, String)> {
    let mut headings = Vec::new();
    let parser = Parser::new(text);
    let mut current_level: Option<usize> = None;
    let mut current_text = String::new();
    for event in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                current_level = Some(level as usize);
                current_text.clear();
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some(level) = current_level {
                    headings.push((level, current_text.trim().to_string()));
                }
                current_level = None;
                current_text.clear();
            }
            Event::Text(t) | Event::Code(t) => {
                if current_level.is_some() {
                    current_text.push_str(&t);
                }
            }
            _ => {}
        }
    }
    headings
}

pub fn extract_yaml_frontmatter(text: &str) -> Option<(&str, &str)> {
    let trimmed = text.trim_start();
    if !trimmed.starts_with("---\n") && !trimmed.starts_with("---\r\n") {
        return None;
    }
    let rest = &trimmed[4..];
    if let Some(end) = rest.find("\n---") {
        let fm = &rest[..end];
        let body_start = end + 5;
        let body = &rest[body_start..];
        return Some((fm, body));
    }
    None
}

pub fn load_text(path: &Path) -> std::io::Result<String> {
    std::fs::read_to_string(path)
}
