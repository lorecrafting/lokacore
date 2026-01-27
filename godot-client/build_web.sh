#!/bin/bash
# Build Godot project for web and optionally serve it
# Usage:
#   ./build_web.sh          - Full build (import + export)
#   ./build_web.sh --fast   - Fast build (skip import, use debug export)
#   ./build_web.sh --serve  - Full build and serve on localhost:8060
#   ./build_web.sh --fast --serve  - Fast build and serve

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_DIR="build/web"
PORT=8060
FAST_MODE=false
SERVE_MODE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --fast) FAST_MODE=true ;;
        --serve) SERVE_MODE=true ;;
    esac
done

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
    exit 1
fi

echo "Using Godot: $GODOT"

# Create build directory
mkdir -p "$BUILD_DIR"

# Import resources (skip in fast mode)
if [ "$FAST_MODE" = false ]; then
    echo "Importing resources..."
    "$GODOT" --headless --path . --import 2>&1 || true
else
    echo "Skipping import (fast mode)"
fi

# Export to web (use debug in fast mode for speed)
if [ "$FAST_MODE" = true ]; then
    echo "Exporting to web (debug)..."
    "$GODOT" --headless --path . --export-debug "Web" "$BUILD_DIR/index.html" 2>&1
else
    echo "Exporting to web (release)..."
    "$GODOT" --headless --path . --export-release "Web" "$BUILD_DIR/index.html" 2>&1
fi

if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo "Error: Export failed - index.html not created"
    exit 1
fi

echo "Build complete: $BUILD_DIR/index.html"

# Serve if requested
if [ "$SERVE_MODE" = true ]; then
    echo ""
    echo "Starting web server on http://localhost:$PORT"
    echo "Press Ctrl+C to stop"

    # Kill any existing server on this port
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

    # Use Python's built-in HTTP server with CORS headers for SharedArrayBuffer
    cd "$BUILD_DIR"
    python3 -c "
import http.server
import socketserver

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, format, *args):
        print(f'[Server] {args[0]}')

with socketserver.TCPServer(('', $PORT), CORSRequestHandler) as httpd:
    httpd.serve_forever()
"
fi
