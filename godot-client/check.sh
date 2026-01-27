#!/bin/bash
# Validate Godot scripts headlessly
# Usage:
#   ./check.sh          - Validate only (check for errors)
#   ./check.sh --run    - Run the game with console output

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Find Godot executable
GODOT=""
if command -v godot &> /dev/null; then
    GODOT="godot"
elif [ -d "/Applications/Godot.app" ]; then
    GODOT="/Applications/Godot.app/Contents/MacOS/Godot"
elif [ -f "/Applications/Godot_4.app/Contents/MacOS/Godot" ]; then
    GODOT="/Applications/Godot_4.app/Contents/MacOS/Godot"
else
    echo "Error: Godot executable not found."
    echo "Please install Godot 4.x or add it to PATH."
    exit 1
fi

echo "Using Godot: $GODOT"

if [ "$1" = "--run" ]; then
    echo "Running game..."
    "$GODOT" --path . 2>&1
else
    echo "Validating scripts (headless)..."
    # Import resources and validate scripts
    "$GODOT" --headless --path . --import 2>&1 || true
    "$GODOT" --headless --path . --check-only 2>&1
    echo "Validation complete. No script errors found."
fi
