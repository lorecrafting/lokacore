#!/bin/bash
# Run Godot unit tests headlessly
# Usage: ./run_tests.sh [test_file]
#   Without arguments: runs all tests
#   With argument: runs specific test file (e.g., ./run_tests.sh test_game_state)

set -e

# Find Godot executable
GODOT=""
if command -v godot &> /dev/null; then
    GODOT="godot"
elif [ -f "/Applications/Godot.app/Contents/MacOS/Godot" ]; then
    GODOT="/Applications/Godot.app/Contents/MacOS/Godot"
else
    echo "Error: Godot not found in PATH or Applications"
    exit 1
fi

echo "Using Godot: $GODOT"
echo ""

# Directory containing tests
TEST_DIR="scripts/tests"

# Check if test directory exists
if [ ! -d "$TEST_DIR" ]; then
    echo "Error: Test directory not found: $TEST_DIR"
    exit 1
fi

# Function to run a single test
run_test() {
    local test_file=$1
    echo "========================================"
    echo "Running: $test_file"
    echo "========================================"
    $GODOT --headless --script "res://$test_file" 2>&1 || {
        echo "[FAIL] Test failed: $test_file"
        return 1
    }
    echo ""
}

# Track results
TOTAL=0
PASSED=0
FAILED=0

if [ -n "$1" ]; then
    # Run specific test
    test_file="$TEST_DIR/$1.gd"
    if [ ! -f "$test_file" ]; then
        test_file="$TEST_DIR/test_$1.gd"
    fi
    if [ ! -f "$test_file" ]; then
        echo "Error: Test file not found: $1"
        echo "Available tests:"
        ls -1 "$TEST_DIR"/*.gd 2>/dev/null | while read f; do
            basename "$f" .gd
        done
        exit 1
    fi
    run_test "$test_file"
else
    # Run all tests
    echo "Running all tests..."
    echo ""

    for test_file in "$TEST_DIR"/test_*.gd; do
        if [ -f "$test_file" ]; then
            TOTAL=$((TOTAL + 1))
            if run_test "$test_file"; then
                PASSED=$((PASSED + 1))
            else
                FAILED=$((FAILED + 1))
            fi
        fi
    done

    echo "========================================"
    echo "SUMMARY"
    echo "========================================"
    echo "Total:  $TOTAL"
    echo "Passed: $PASSED"
    echo "Failed: $FAILED"
    echo ""

    if [ $FAILED -gt 0 ]; then
        echo "[FAIL] Some tests failed!"
        exit 1
    else
        echo "[PASS] All tests passed!"
        exit 0
    fi
fi
