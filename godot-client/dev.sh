#!/bin/bash
# Development server with hot reload for Godot web builds
# Watches for changes in scripts/ and shaders/, rebuilds, and refreshes browser
#
# Usage:
#   ./dev.sh              - Start dev server with file watching
#   ./dev.sh --no-watch   - Just serve (no file watching)
#
# Requirements: fswatch (brew install fswatch)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8060
BUILD_DIR="build/web"
WATCH_DIRS="scripts shaders scenes"
NO_WATCH=false

for arg in "$@"; do
    case $arg in
        --no-watch) NO_WATCH=true ;;
    esac
done

# Check for fswatch
if [ "$NO_WATCH" = false ] && ! command -v fswatch &> /dev/null; then
    echo "Warning: fswatch not found. Install with: brew install fswatch"
    echo "Running without file watching..."
    NO_WATCH=true
fi

# Kill existing processes on cleanup
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $SERVER_PID 2>/dev/null || true
    [ -n "$WATCH_PID" ] && kill $WATCH_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Initial build
echo "=== Godot Dev Server ==="
echo "Building initial export..."
./build_web.sh --fast

if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo "ERROR: Build failed"
    exit 1
fi

# Start web server
echo ""
echo "Starting server at http://localhost:$PORT"

cd "$BUILD_DIR"
python3 -c "
import http.server
import socketserver

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # Suppress request logging

with socketserver.TCPServer(('', $PORT), CORSRequestHandler) as httpd:
    httpd.serve_forever()
" &
SERVER_PID=$!
cd "$SCRIPT_DIR"

# Open browser
sleep 1
open "http://localhost:$PORT" 2>/dev/null || true

if [ "$NO_WATCH" = true ]; then
    echo "Server running. Press Ctrl+C to stop."
    wait $SERVER_PID
    exit 0
fi

# File watcher
echo ""
echo "Watching for changes in: $WATCH_DIRS"
echo "Press Ctrl+C to stop"
echo ""

rebuild_and_refresh() {
    echo "[$(date +%H:%M:%S)] Change detected, rebuilding..."
    if ./build_web.sh --fast 2>&1 | grep -q "Build complete"; then
        echo "[$(date +%H:%M:%S)] Build complete - refresh browser (Cmd+R)"
        # Try to refresh browser via AppleScript (macOS)
        osascript -e 'tell application "Google Chrome" to reload active tab of window 1' 2>/dev/null || \
        osascript -e 'tell application "Safari" to do JavaScript "location.reload()" in document 1' 2>/dev/null || \
        true
    else
        echo "[$(date +%H:%M:%S)] Build failed"
    fi
}

# Watch for file changes
fswatch -o $WATCH_DIRS -e ".*\.import$" -e ".*~$" | while read; do
    rebuild_and_refresh
done &
WATCH_PID=$!

wait $SERVER_PID
