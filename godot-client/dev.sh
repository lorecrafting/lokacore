#!/bin/bash
# Development server with hot reload for Godot web builds
# Watches for changes in scripts/ and shaders/, rebuilds with debouncing
#
# Usage:
#   ./dev.sh              - Start dev server with file watching (2s debounce)
#   ./dev.sh --no-watch   - Just serve (no file watching)
#   ./dev.sh --delay 5    - Custom debounce delay (5 seconds)
#
# Requirements: fswatch (brew install fswatch)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8060
BUILD_DIR="build/web"
WATCH_DIRS="scripts shaders scenes"
DEBOUNCE_DELAY=2  # seconds to wait after last change before rebuilding
NO_WATCH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-watch) NO_WATCH=true; shift ;;
        --delay) DEBOUNCE_DELAY="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# Check for fswatch
if [ "$NO_WATCH" = false ] && ! command -v fswatch &> /dev/null; then
    echo "Warning: fswatch not found. Install with: brew install fswatch"
    echo "Running without file watching..."
    NO_WATCH=true
fi

# Temp files for debouncing
LAST_CHANGE_FILE=""
BUILD_LOCK_FILE=""

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down..."
    [ -n "$LAST_CHANGE_FILE" ] && rm -f "$LAST_CHANGE_FILE"
    [ -n "$BUILD_LOCK_FILE" ] && rm -f "$BUILD_LOCK_FILE"
    rm -f "$SCRIPT_DIR/.build_status"
    [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null || true
    [ -n "$WATCH_PID" ] && kill $WATCH_PID 2>/dev/null || true
    # Kill any background debounce processes
    jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

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

# Open browser (prefer Chrome for Claude extension compatibility)
sleep 1
open -a "Google Chrome" "http://localhost:$PORT" 2>/dev/null || \
open "http://localhost:$PORT" 2>/dev/null || true

if [ "$NO_WATCH" = true ]; then
    echo "Server running. Press Ctrl+C to stop."
    wait $SERVER_PID
    exit 0
fi

# File watcher with debouncing
echo ""
echo "Watching for changes in: $WATCH_DIRS"
echo "Debounce delay: ${DEBOUNCE_DELAY}s (rebuilds after changes settle)"
echo "Press Ctrl+C to stop"
echo ""

LAST_CHANGE_FILE=$(mktemp)
BUILD_LOCK_FILE=$(mktemp)

BUILD_STATUS_FILE="$SCRIPT_DIR/.build_status"

rebuild_and_refresh() {
    echo "[$(date +%H:%M:%S)] Rebuilding..."
    echo "building" > "$BUILD_STATUS_FILE"

    local output
    output=$(./build_web.sh --fast 2>&1)
    if echo "$output" | grep -q "Build complete"; then
        echo "[$(date +%H:%M:%S)] ✓ Build complete"
        echo "success $(date +%s)" > "$BUILD_STATUS_FILE"
        # Try to refresh browser via AppleScript (macOS)
        if osascript -e 'tell application "Google Chrome" to reload active tab of window 1' 2>/dev/null; then
            echo "[$(date +%H:%M:%S)] ✓ Browser refreshed"
        else
            echo "[$(date +%H:%M:%S)] → Refresh browser manually (Cmd+R)"
        fi
    else
        echo "[$(date +%H:%M:%S)] ✗ Build failed"
        echo "failed $(date +%s)" > "$BUILD_STATUS_FILE"
        echo "$output" | grep -E "(Error|error|ERROR)" | head -5
    fi
    rm -f "$BUILD_LOCK_FILE"
}

# Debounced rebuild - waits for changes to settle before building
debounced_rebuild() {
    local change_time=$(date +%s)
    echo "$change_time" > "$LAST_CHANGE_FILE"

    # If a build is already scheduled, let it handle this change
    if [ -f "$BUILD_LOCK_FILE" ]; then
        return
    fi

    touch "$BUILD_LOCK_FILE"

    (
        while true; do
            sleep "$DEBOUNCE_DELAY"
            local last_recorded=$(cat "$LAST_CHANGE_FILE" 2>/dev/null || echo "0")
            local now=$(date +%s)
            local elapsed=$((now - last_recorded))

            # If enough time has passed since last change, rebuild
            if [ "$elapsed" -ge "$DEBOUNCE_DELAY" ]; then
                rebuild_and_refresh
                break
            fi
            # Otherwise, keep waiting (more changes detected)
        done
    ) &
}

# Watch for file changes with debouncing
fswatch -o $WATCH_DIRS -e ".*\.import$" -e ".*~$" -e ".*\.tmp$" | while read; do
    echo "[$(date +%H:%M:%S)] Change detected, waiting ${DEBOUNCE_DELAY}s for more changes..."
    debounced_rebuild
done &
WATCH_PID=$!

wait $SERVER_PID
