#!/bin/bash
# Build, serve, and verify Godot web export
# This script builds the project and starts a server for browser testing
#
# Usage:
#   ./verify_web.sh         - Build and serve (open browser manually)
#   ./verify_web.sh --open  - Build, serve, and open in default browser

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8060
BUILD_DIR="build/web"

echo "=== Godot Web Verification ==="

# Kill any existing server on the port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

# Build
echo "Building web export..."
./build_web.sh

if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo "ERROR: Build failed"
    exit 1
fi

echo ""
echo "=== Starting server on http://localhost:$PORT ==="
echo ""
echo "Verification checklist:"
echo "  [ ] Page displays with parchment background"
echo "  [ ] Room title 'Monastery Gate' is visible"
echo "  [ ] Room description text is readable"
echo "  [ ] Compass buttons (N/E/S/W) are visible"
echo "  [ ] Click N button - page should curl and show Courtyard"
echo "  [ ] Keyboard W/A/S/D should navigate"
echo ""

# Start server in background
cd "$BUILD_DIR"
python3 -c "
import http.server
import socketserver
import signal
import sys

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, format, *args):
        print(f'[{args[0]}] {args[1]} {args[2]}')

def signal_handler(sig, frame):
    print('\nServer stopped')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

with socketserver.TCPServer(('', $PORT), CORSRequestHandler) as httpd:
    print(f'Serving at http://localhost:$PORT')
    print('Press Ctrl+C to stop')
    httpd.serve_forever()
" &

SERVER_PID=$!

# Open browser if requested
if [ "$1" = "--open" ]; then
    sleep 1
    open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || echo "Open http://localhost:$PORT in your browser"
fi

# Wait for server
wait $SERVER_PID
