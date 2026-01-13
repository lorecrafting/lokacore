#!/bin/bash
# E2E Test Runner for Loka Mobile
#
# Usage:
#   ./scripts/e2e-test.sh              # Run all tests
#   ./scripts/e2e-test.sh smoke        # Run smoke tests only
#   ./scripts/e2e-test.sh auth         # Run auth tests
#   ./scripts/e2e-test.sh --record     # Record test run as GIF

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$(dirname "$MOBILE_DIR")/server"
TEST_RUN_ID=$(date +%s)
MAESTRO_OUTPUT_DIR="$MOBILE_DIR/.maestro/output"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
TEST_FILTER=""
RECORD_MODE=false
SKIP_SERVER_CHECK=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --record)
      RECORD_MODE=true
      shift
      ;;
    --skip-server-check)
      SKIP_SERVER_CHECK=true
      shift
      ;;
    smoke|auth|navigation|dialogue|inventory|combat)
      TEST_FILTER=$1
      shift
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Check for Maestro installation
check_maestro() {
  if ! command -v maestro &> /dev/null; then
    log_error "Maestro is not installed. Install it with:"
    echo "  curl -Ls 'https://get.maestro.mobile.dev' | bash"
    exit 1
  fi
  log_info "Maestro version: $(maestro --version)"
}

# Check if server is running
check_server() {
  if [[ "$SKIP_SERVER_CHECK" == true ]]; then
    log_warn "Skipping server check"
    return 0
  fi

  log_info "Checking if server is running at localhost:4000..."

  if curl -s --max-time 5 "http://localhost:4000/api/health" > /dev/null 2>&1; then
    log_info "Server is running"
    return 0
  fi

  log_warn "Server not running. Starting server..."

  # Start server in background
  cd "$SERVER_DIR"
  mix phx.server &
  SERVER_PID=$!

  # Wait for server to be ready
  log_info "Waiting for server to start..."
  for i in {1..30}; do
    if curl -s --max-time 2 "http://localhost:4000/api/health" > /dev/null 2>&1; then
      log_info "Server started successfully (PID: $SERVER_PID)"
      return 0
    fi
    sleep 1
  done

  log_error "Server failed to start within 30 seconds"
  exit 1
}

# Setup test fixtures on the server
setup_test_fixtures() {
  log_info "Setting up test fixtures..."

  cd "$SERVER_DIR"

  # Run the E2E setup mix task (if it exists)
  if mix run -e "Code.ensure_loaded?(Mix.Tasks.Loka.E2e.Setup)" 2>/dev/null | grep -q "true"; then
    mix loka.e2e.setup --test-run-id "$TEST_RUN_ID"
  else
    log_warn "E2E setup task not found, skipping fixture setup"
  fi
}

# Run Maestro tests
run_tests() {
  log_info "Running E2E tests (run ID: $TEST_RUN_ID)..."

  cd "$MOBILE_DIR"
  mkdir -p "$MAESTRO_OUTPUT_DIR"

  # Build test command
  MAESTRO_CMD="maestro test"
  MAESTRO_CMD="$MAESTRO_CMD --env TEST_RUN_ID=$TEST_RUN_ID"
  MAESTRO_CMD="$MAESTRO_CMD --output $MAESTRO_OUTPUT_DIR/$TEST_RUN_ID"

  if [[ "$RECORD_MODE" == true ]]; then
    MAESTRO_CMD="$MAESTRO_CMD --record"
  fi

  # Determine which tests to run
  if [[ -n "$TEST_FILTER" ]]; then
    case $TEST_FILTER in
      smoke)
        MAESTRO_CMD="$MAESTRO_CMD .maestro/flows/smoke-test.yaml"
        ;;
      auth)
        MAESTRO_CMD="$MAESTRO_CMD .maestro/flows/auth/"
        ;;
      navigation)
        MAESTRO_CMD="$MAESTRO_CMD .maestro/flows/navigation/"
        ;;
      dialogue)
        MAESTRO_CMD="$MAESTRO_CMD .maestro/flows/dialogue/"
        ;;
      inventory)
        MAESTRO_CMD="$MAESTRO_CMD .maestro/flows/inventory/"
        ;;
      combat)
        MAESTRO_CMD="$MAESTRO_CMD .maestro/flows/combat/"
        ;;
    esac
  else
    # Run all tests
    MAESTRO_CMD="$MAESTRO_CMD .maestro/flows/"
  fi

  log_info "Executing: $MAESTRO_CMD"

  # Run tests
  if eval "$MAESTRO_CMD"; then
    log_info "Tests passed!"
    return 0
  else
    log_error "Tests failed!"
    return 1
  fi
}

# Cleanup
cleanup() {
  log_info "Cleaning up..."

  # Stop server if we started it
  if [[ -n "$SERVER_PID" ]]; then
    log_info "Stopping server (PID: $SERVER_PID)"
    kill $SERVER_PID 2>/dev/null || true
  fi

  # Cleanup test data
  cd "$SERVER_DIR"
  if mix run -e "Code.ensure_loaded?(Mix.Tasks.Loka.E2e.Cleanup)" 2>/dev/null | grep -q "true"; then
    mix loka.e2e.cleanup --test-run-id "$TEST_RUN_ID"
  fi
}

# Main
main() {
  trap cleanup EXIT

  log_info "=== Loka Mobile E2E Tests ==="
  log_info "Test Run ID: $TEST_RUN_ID"

  check_maestro
  check_server
  setup_test_fixtures
  run_tests
}

main
