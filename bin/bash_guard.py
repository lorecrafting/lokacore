"""PreToolUse hook on Bash (.claude/settings.json): refuse `git ... --no-verify` (or `git commit -n`)
without the owner's OK marker, and a bare `br create` (loka-zrqm, loka-sakg). Exit 2 blocks the call
and shows stderr to the agent; anything unparseable lets the call through (one wrong refusal blocks
every agent). Quoted text is one token, so a message or pattern that mentions a flag passes.
ponytail: a command hidden in `sh -c '...'` or eval is not seen.
  python3 -I bin/bash_guard.py < hook-input.json"""
import json
import shlex
import sys

MARKER = "LOKA_OWNER_OK_NO_VERIFY=1"


def segments(command):
    lex = shlex.shlex(command, posix=True, punctuation_chars=";&|\n()")
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    seg = []
    for tok in lex:
        if tok and set(tok) <= set(";&|\n()"):
            yield seg
            seg = []
        else:
            seg.append(tok)
    yield seg


def refusal(seg):
    if "git" in seg:
        rest = seg[seg.index("git") + 1 :]
        words = [t for t in rest if not t.startswith("-")]
        hooks_off = "--no-verify" in rest or (
            words[:1] == ["commit"] and any(t[1:].isalpha() and "n" in t for t in rest if t[:2] != "--")
        )
        if hooks_off and MARKER not in seg:
            return f"git hooks skipped without the owner's OK. Fix the cause; with the owner's OK, prefix {MARKER}."
    if "br" in seg:
        words = [t for t in seg[seg.index("br") + 1 :] if not t.startswith("-")]
        if words[:1] == ["create"]:
            return "bare br create refused: use bin/br_create.sh (plain br create leaves a local source_repo_path)."
    return None


try:
    command = json.load(sys.stdin)["tool_input"]["command"]
    reasons = [r for r in map(refusal, segments(command)) if r]
except Exception:
    sys.exit(0)
if reasons:
    print(reasons[0], file=sys.stderr)
    sys.exit(2)
