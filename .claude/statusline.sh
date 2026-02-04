#!/bin/bash
# Loka Development Status Line for Claude Code Pro
# Uses ccusage for accurate block tracking
# Shows: Model | Context | Block Time Left | Branch | Modes

input=$(cat)

# Parse JSON input from Claude Code
MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"' 2>/dev/null)
INPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0' 2>/dev/null)
OUTPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0' 2>/dev/null)
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000' 2>/dev/null)
PROJECT_DIR=$(echo "$input" | jq -r '.workspace.project_dir // ""' 2>/dev/null)

# ANSI colors
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
MAGENTA="\033[35m"

# Color coding function
color_percent() {
    local pct=$1
    if [ "$pct" -ge 80 ]; then
        echo -n "$RED"
    elif [ "$pct" -ge 60 ]; then
        echo -n "$YELLOW"
    else
        echo -n "$GREEN"
    fi
}

# Shorten model name
case "$MODEL" in
    *"Opus"*) SHORT_MODEL="Opus" ;;
    *"Sonnet"*) SHORT_MODEL="Sonnet" ;;
    *"Haiku"*) SHORT_MODEL="Haiku" ;;
    *) SHORT_MODEL="$MODEL" ;;
esac

# Calculate context usage
TOTAL_TOKENS=$((INPUT_TOKENS + OUTPUT_TOKENS))
CONTEXT_PERCENT=$((TOTAL_TOKENS * 100 / CONTEXT_SIZE))
CTX_COLOR=$(color_percent $CONTEXT_PERCENT)

# Get block info from ccusage (cached for performance)
CACHE_FILE="/tmp/ccusage_block_cache.json"
CACHE_AGE=60  # Refresh every 60 seconds

# Check if cache is fresh
REFRESH_CACHE=true
if [ -f "$CACHE_FILE" ]; then
    CACHE_MTIME=$(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null)
    NOW=$(date +%s)
    if [ $((NOW - CACHE_MTIME)) -lt $CACHE_AGE ]; then
        REFRESH_CACHE=false
    fi
fi

# Refresh cache if needed
if [ "$REFRESH_CACHE" = true ]; then
    ccusage blocks --json 2>/dev/null | jq '.blocks | map(select(.isActive == true)) | .[0] // empty' > "$CACHE_FILE" 2>/dev/null
fi

# Read block data
BLOCK_DATA=$(cat "$CACHE_FILE" 2>/dev/null)

if [ -n "$BLOCK_DATA" ] && [ "$BLOCK_DATA" != "null" ]; then
    REMAINING_MINS=$(echo "$BLOCK_DATA" | jq -r '.projection.remainingMinutes // 0' 2>/dev/null)
    BLOCK_COST=$(echo "$BLOCK_DATA" | jq -r '.costUSD // 0' 2>/dev/null)

    # Convert remaining minutes to hours:mins
    BLOCK_HOURS=$((REMAINING_MINS / 60))
    BLOCK_MINS=$((REMAINING_MINS % 60))

    # Color based on time remaining (more time = green)
    if [ "$REMAINING_MINS" -le 60 ]; then
        BLOCK_COLOR="$RED"
    elif [ "$REMAINING_MINS" -le 150 ]; then
        BLOCK_COLOR="$YELLOW"
    else
        BLOCK_COLOR="$GREEN"
    fi

    BLOCK_INFO="${DIM}Block:${RESET} ${BLOCK_COLOR}${BLOCK_HOURS}h${BLOCK_MINS}m left${RESET}"
else
    BLOCK_INFO="${DIM}Block:${RESET} ${GREEN}fresh${RESET}"
fi

# Get git branch
GIT_BRANCH=""
if [ -n "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR/.git" ]; then
    GIT_BRANCH=$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null)
fi

# Build status line
STATUS="${DIM}Model:${RESET} ${BOLD}${CYAN}$SHORT_MODEL${RESET}"
STATUS="$STATUS ${DIM}|${RESET} ${DIM}Context:${RESET} ${CTX_COLOR}${CONTEXT_PERCENT}%${RESET}"
STATUS="$STATUS ${DIM}|${RESET} $BLOCK_INFO"

if [ -n "$GIT_BRANCH" ]; then
    STATUS="$STATUS ${DIM}|${RESET} ${DIM}Branch:${RESET} ${MAGENTA}${GIT_BRANCH}${RESET}"
fi

echo -e "$STATUS"
