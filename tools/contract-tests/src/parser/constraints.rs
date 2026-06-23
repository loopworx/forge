use crate::parser::yaml::parse_file;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct Constraints {
    pub inner: HashMap<String, serde_yml::Value>,
    pub has_loop_block: bool,
}

pub fn parse_constraints(path: &Path) -> Constraints {
    let mut c = Constraints::default();
    if let Ok(value) = parse_file::<serde_yml::Value>(path) {
        c.has_loop_block = value.get("loop").is_some();
        if let Some(mapping) = value.as_mapping() {
            for (k, v) in mapping.iter() {
                c.inner.insert(k.clone(), v.clone());
            }
        }
    }
    c
}
