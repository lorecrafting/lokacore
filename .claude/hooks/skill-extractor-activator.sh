#!/bin/bash

# Claudeception Auto-Activation Hook
# This hook ensures the claudeception skill evaluates every interaction
# for extractable knowledge worth preserving.
#
# Installation:
#   1. Copy this script to ~/.claude/hooks/
#   2. Make it executable: chmod +x ~/.claude/hooks/claudeception-activator.sh
#   3. Add to ~/.claude/settings.json (see README for details)

cat << 'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
♻️  COMPOUND ENGINEERING - AUTOMATIC LEARNING LOOP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL: After completing this user request, you MUST evaluate whether
it produced compoundable knowledge using the compound skill.

EVALUATION PROTOCOL (NON-NEGOTIABLE):

1. COMPLETE the user's request first
2. EVALUATE: Ask yourself:
   - Did this require non-obvious investigation or debugging?
   - Was the solution something that would help in future similar situations?
   - Did I discover something not immediately obvious from documentation?

3. IF YES to any question above:
   ACTIVATE: Use Skill(compound) NOW to feed learnings back into the system

4. IF NO to all questions:
   SKIP: No compoundable knowledge this session

This is NOT optional. Failing to evaluate means valuable knowledge is lost.
The compound skill will analyze the session and extract skills, update docs,
and make future work easier.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
