#!/usr/bin/env bash
# Install forge skills into ~/.agents/skills/ for OpenCode / Claude Code / Hermes discovery.
#
# Usage:
#   git clone https://github.com/loopworx/forge ~/.agents/forge
#   bash ~/.agents/forge/install.sh
#
# Or from any forge checkout:
#   bash /path/to/forge/install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
SKILLS_DST="$HOME/.agents/skills"

if [ ! -d "$SKILLS_SRC" ]; then
    echo "error: skills directory not found at $SKILLS_SRC" >&2
    exit 1
fi

mkdir -p "$SKILLS_DST"
echo "Installing forge skills to $SKILLS_DST ..."
count=0
for skill_dir in "$SKILLS_SRC"/*/; do
    name=$(basename "$skill_dir")
    target="$SKILLS_DST/$name"
    rm -f "$target"
    ln -sf "$(cd "$skill_dir" && pwd)" "$target"
    echo "  $name"
    ((count++))
done

echo ""
echo "$count skills installed."
echo "Run: loopkit . --verbose   (to verify)"