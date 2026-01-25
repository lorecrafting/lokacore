#!/bin/bash

# Compound Engineering Auto-Activation Hook
# This hook ensures the compound skill evaluates every work session
# for knowledge worth feeding back into the system.
#
# Installation:
#   Already installed in lokacore project
#   Triggers automatically on SessionEnd event

cat << 'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
♻️  COMPOUND ENGINEERING - AUTOMATIC LEARNING LOOP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The compound skill will now evaluate this work session for knowledge
that can be fed back into the system to make future work easier.

This happens automatically after each session. The skill will:
1. Analyze what was accomplished
2. Extract compoundable knowledge (skills, docs, patterns)
3. Feed learnings back into the system
4. Skip if no valuable knowledge was discovered

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
