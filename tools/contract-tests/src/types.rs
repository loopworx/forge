use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SkillCategory {
    Meta,
    Discovery,
    Architecture,
    Development,
    Quality,
    IterationZero,
    AcceptanceDelivery,
}

impl SkillCategory {
    pub fn from_dir_name(s: &str) -> Option<Self> {
        match s {
            "meta" => Some(Self::Meta),
            "discovery" => Some(Self::Discovery),
            "architecture" => Some(Self::Architecture),
            "development" => Some(Self::Development),
            "quality" => Some(Self::Quality),
            "iteration-zero" => Some(Self::IterationZero),
            "acceptance-delivery" => Some(Self::AcceptanceDelivery),
            _ => None,
        }
    }

    pub fn as_dir_name(&self) -> &'static str {
        match self {
            Self::Meta => "meta",
            Self::Discovery => "discovery",
            Self::Architecture => "architecture",
            Self::Development => "development",
            Self::Quality => "quality",
            Self::IterationZero => "iteration-zero",
            Self::AcceptanceDelivery => "acceptance-delivery",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SkillLevel {
    L1Rigid,
    L2Guided,
    L3Mech,
}

impl SkillLevel {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "L1-RIGID" => Some(Self::L1Rigid),
            "L2-GUIDED" => Some(Self::L2Guided),
            "L3-MECH" => Some(Self::L3Mech),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::L1Rigid => "L1-RIGID",
            Self::L2Guided => "L2-GUIDED",
            Self::L3Mech => "L3-MECH",
        }
    }

    pub fn is_rigid(&self) -> bool {
        matches!(self, Self::L1Rigid)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentRole {
    PoAgent,
    UxAgent,
    ArchitectAgent,
    DeveloperAgent,
    QaAgent,
    DevopsAgent,
    SecopsAgent,
    AllAgents,
}

impl AgentRole {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "po-agent" => Some(Self::PoAgent),
            "ux-agent" => Some(Self::UxAgent),
            "architect-agent" => Some(Self::ArchitectAgent),
            "developer-agent" => Some(Self::DeveloperAgent),
            "qa-agent" => Some(Self::QaAgent),
            "devops-agent" => Some(Self::DevopsAgent),
            "secops-agent" => Some(Self::SecopsAgent),
            "all-agents" => Some(Self::AllAgents),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MismatchKind {
    InFixtureNotRepo,
    InRepoNotFixture,
    CategoryMismatch,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct State {
    pub name: String,
    pub defined_in: Vec<String>,
    pub is_terminal: bool,
    pub is_entry: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Skill {
    pub name: String,
    pub category: SkillCategory,
    pub path: PathBuf,
    pub level: SkillLevel,
    pub owner: Vec<AgentRole>,
    pub sections: Vec<String>,
    pub states: Vec<State>,
    pub has_handoffs: bool,
    pub has_loop: bool,
}

impl Skill {
    pub fn dir(&self) -> &Path {
        self.path.as_path()
    }

    pub fn skill_md(&self) -> PathBuf {
        self.path.join("SKILL.md")
    }

    pub fn handoffs_md(&self) -> PathBuf {
        self.path.join("HANDOFFS.md")
    }

    pub fn loop_md(&self) -> PathBuf {
        self.path.join("LOOP.md")
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Transition {
    pub from: String,
    pub to: String,
    pub trigger: String,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HandoffGraph {
    pub nodes: Vec<State>,
    pub edges: Vec<Transition>,
    pub entry_points: Vec<State>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub enum LoopSection {
    EntryConditions(String),
    LoopStateSchema(String),
    SingleIterationStep(String),
    ProofOfProgress(String),
    StateTransitionRule(String),
    HaltConditions(String),
    HandoffTarget(String),
    Unknown(String),
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LoopContract {
    pub skill: String,
    pub sections: Vec<LoopSection>,
    pub section_order_valid: bool,
    pub sub_loops: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileLocation {
    pub path: PathBuf,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Diagnostic {
    pub severity: Severity,
    pub code: String,
    pub message: String,
    pub location: FileLocation,
    pub help: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LoopStateFile {
    pub path: PathBuf,
    pub kind: LoopStateKind,
    pub fields: HashMap<String, String>,
    pub valid: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LoopStateKind {
    Inception,
    IterationBoard,
    Story,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiscoveredSkill {
    pub name: String,
    pub category: String,
    pub path: PathBuf,
    pub has_state_model: bool,
    pub has_handoffs: bool,
    pub level: Option<String>,
    pub heuristic_loop_worthy: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FixtureMismatch {
    pub skill: String,
    pub kind: MismatchKind,
    pub expected: String,
    pub actual: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AutoDiscoveryResult {
    pub skills: Vec<DiscoveredSkill>,
    pub loop_worthy: Vec<String>,
    pub not_loop_worthy: Vec<String>,
    pub fixture_mismatch: Vec<FixtureMismatch>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Repo {
    pub root: PathBuf,
    pub skills: Vec<Skill>,
    pub fixture: Fixture,
    pub handoff_graph: HandoffGraph,
    pub readme_skills: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct Fixture {
    pub metadata: FixtureMetadata,
    pub loops: Vec<FixtureLoop>,
    pub canonical_states: Vec<String>,
    #[serde(rename = "required_loop_sections")]
    pub required_loop_sections: Vec<RequiredSection>,
    #[serde(rename = "required_skill_sections")]
    pub required_skill_sections: RequiredSkillSections,
    pub handoff_graph_invariants: Vec<HandoffGraphInvariant>,
    pub terminal_states: Vec<String>,
    pub entry_points: Vec<String>,
    pub entry_triggers: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct FixtureMetadata {
    pub version: String,
    pub last_updated: String,
    pub description: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct FixtureLoop {
    pub skill: String,
    pub category: String,
    pub level: String,
    pub owner: Vec<String>,
    pub has_loop: bool,
    #[serde(default)]
    pub sub_loops: Vec<String>,
    pub description: String,
}

impl FixtureLoop {
    pub fn full_category_dir(&self) -> String {
        match self.category.as_str() {
            "iteration-zero" => "iteration-zero".to_string(),
            "acceptance-delivery" => "acceptance-delivery".to_string(),
            other => other.to_string(),
        }
    }
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct RequiredSection {
    pub heading: String,
    pub machine_name: String,
    pub required: bool,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct RequiredSkillSections {
    #[serde(rename = "all_levels")]
    pub all_levels: Vec<RequiredSection>,
    #[serde(rename = "l1_rigid_only")]
    pub l1_rigid_only: Vec<RequiredSection>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct HandoffGraphInvariant {
    pub name: String,
    pub rule: String,
}
