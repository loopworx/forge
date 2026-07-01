#!/usr/bin/env bash
set -euo pipefail

echo "=== ui-ux-pro-max Integration Installer ==="
echo ""

OPENCODE_DIR="${HOME}/.config/opencode"

if [ ! -d "$OPENCODE_DIR" ]; then
  echo "Error: opencode config directory not found at $OPENCODE_DIR"
  echo "Install opencode first: https://opencode.ai"
  exit 1
fi

PLUGINS_DIR="${OPENCODE_DIR}/plugins"
SKILLS_DIR="${OPENCODE_DIR}/skills/ui-ux-pro-max"

mkdir -p "$PLUGINS_DIR" "$SKILLS_DIR"

echo "1. Installing ui-ux-pro-max skill..."
if [ -d "skills/ui-ux-pro-max" ]; then
  cp -r skills/ui-ux-pro-max/* "$SKILLS_DIR/"
  echo "   Skill installed at $SKILLS_DIR"
else
  echo "   Warning: skills/ui-ux-pro-max not found in forge package"
  echo "   Download from: https://github.com/nicobailon/ui-ux-pro-max"
  echo "   Place files in $SKILLS_DIR"
fi

echo ""
echo "2. Configuring opencode.json..."
OCPATH="${PWD}/opencode.json"
if [ -f "$OCPATH" ]; then
  echo "   opencode.json exists. Add ui-ux-pro-max to MCP if needed."
else
  echo "   opencode.json not found. Run 'forge init' first."
fi

echo ""
echo "3. ui-ux-pro-max is a design generation tool."
echo "   It produces React/HTML/Tailwind components from design specs."
echo "   Used by: ux-agent during inception Phase 5 (designing-ux)"
echo ""
echo "=== ui-ux-pro-max installation complete ==="
echo "Next: Run '/forge new project' and the ux-agent will use this tool during Phase 5."
