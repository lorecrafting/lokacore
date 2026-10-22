"""PreToolUse hook on SendMessage (.claude/settings.json): refuse to resume a subagent whose newest
compaction was a hook compaction (durationMs < 1000, the rule of bin/session_status.sh; resuming one
returned a 400, loka-2ti3). Built-in compaction may be resumed (docs/WORKFLOW.md). Exit 2 blocks the
call; a missing or unreadable transcript lets it through.
  python3 -I bin/send_guard.py < hook-input.json"""
import glob
import json
import os
import sys

try:
    hook = json.load(sys.stdin)
    to = hook["tool_input"]["to"]
    projects = os.path.dirname(hook["transcript_path"])
    [path] = glob.glob(os.path.join(glob.escape(projects), "*", "subagents", f"agent-{to}.jsonl"))
    with open(path) as f:
        last = [line for line in f if '"subtype":"compact_boundary"' in line][-1]
    ms = json.loads(last)["compactMetadata"]["durationMs"]
except Exception:
    sys.exit(0)
if ms < 1000:
    print(
        f"SendMessage refused: agent {to} was compacted by a hook ({ms} ms); resuming it fails. "
        "Spawn a fresh agent with a state note instead.",
        file=sys.stderr,
    )
    sys.exit(2)
