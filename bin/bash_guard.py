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


def invoked(seg, name):
    """(index of the `name` binary, its subcommand) or None; skips git's -C/-c values."""
    for i, t in enumerate(seg):
        if t.rsplit("/", 1)[-1] == name:
            rest = iter(seg[i + 1 :])
            for w in rest:
                if w in ("-C", "-c"):
                    next(rest, None)
                elif not w.startswith("-"):
                    return i, w
            return i, None
    return None


def skips_hooks(args):
    """An `n` in a short-flag cluster of `git commit`, before a flag that takes the rest as its value."""
    for t in args:
        if t[:1] == "-" and t[1:2] != "-":
            for c in t[1:]:
                if c == "n":
                    return True
                if c in "mFCcSut":  # the rest of the token is this flag's value
                    break
    return False


def refusal(seg):
    git = invoked(seg, "git")
    if git:
        i, sub = git
        args = seg[i + 1 :]
        hooks_off = "--no-verify" in args or (sub == "commit" and skips_hooks(args[args.index("commit") + 1 :]))
        if hooks_off and MARKER not in seg[:i]:
            return f"git hooks skipped without the owner's OK. Fix the cause; with the owner's OK, prefix {MARKER}."
    br = invoked(seg, "br")
    if br and br[1] == "create":
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
