use std::path::Path;

#[derive(Debug, thiserror::Error)]
#[error("YAML parse failed: {0}")]
pub struct YamlError(pub String);

pub fn parse_file<T: serde::de::DeserializeOwned + 'static>(path: &Path) -> Result<T, YamlError> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| YamlError(format!("cannot read {}: {}", path.display(), e)))?;
    parse_str(&text)
}

pub fn parse_str<T: serde::de::DeserializeOwned + 'static>(text: &str) -> Result<T, YamlError> {
    serde_yml::from_str(text).map_err(|e| YamlError(e.to_string()))
}
