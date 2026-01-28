#!/bin/bash
# Build iOS export for Godot project
# Creates an Xcode project that can be opened and built to device

set -e

GODOT="${GODOT_PATH:-godot}"
BUILD_DIR="build/ios"
PROJECT_NAME="Loka"

echo "=== Loka iOS Export ==="
echo ""

# Create build directory
mkdir -p "$BUILD_DIR"

# Check if Godot is available
if ! command -v "$GODOT" &> /dev/null; then
    echo "Error: Godot not found. Set GODOT_PATH or add godot to PATH"
    exit 1
fi

echo "Using Godot: $GODOT"
echo "Output: $BUILD_DIR/$PROJECT_NAME.xcodeproj"
echo ""

# Export iOS project
echo "Exporting iOS project..."
"$GODOT" --headless --export-debug "iOS" "$BUILD_DIR/$PROJECT_NAME.xcodeproj"

if [ -d "$BUILD_DIR/$PROJECT_NAME.xcodeproj" ]; then
    echo ""
    echo "=== Build Complete ==="
    echo ""
    echo "Xcode project: $BUILD_DIR/$PROJECT_NAME.xcodeproj"
    echo ""
    echo "Next steps:"
    echo "  1. Open in Xcode:  open $BUILD_DIR/$PROJECT_NAME.xcodeproj"
    echo "  2. Select your Team in Signing & Capabilities"
    echo "  3. Connect iPhone and select it as target"
    echo "  4. Click Run (Cmd+R) to build and deploy"
    echo ""
    echo "Make sure:"
    echo "  - Phoenix server is running: cd ../server && mix phx.server"
    echo "  - iPhone is on Tailscale network"
    echo "  - Server URL: ws://100.69.21.60:4000/socket/websocket"
    echo ""

    # Optionally open Xcode
    if [ "$1" = "--open" ]; then
        echo "Opening Xcode..."
        open "$BUILD_DIR/$PROJECT_NAME.xcodeproj"
    fi
else
    echo "Error: Export failed - Xcode project not created"
    exit 1
fi
