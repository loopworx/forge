export const THEME = {
  background: "transparent",
  backgroundPanel: "#1a1b26",
  backgroundElement: "#24283b",
  border: "#3b4261",
  borderActive: "#7aa2f7",
  primary: "#7aa2f7",
  success: "#9ece6a",
  warning: "#e0af68",
  error: "#f7768e",
  text: "#c0caf5",
  textMuted: "#565f89",
  thinking: "#565f89",
  spinner: "#7aa2f7",
} as const;

export const AGENT_COLORS: Record<string, string> = {
  "po-agent": "#7aa2f7",
  "architect-agent": "#9ece6a",
  "ux-agent": "#bb9af7",
  "developer-agent": "#7dcfff",
  "qa-agent": "#ff007c",
  "devops-agent": "#e0af68",
  "guardian-agent": "#e0af68",
};
