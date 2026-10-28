"""PreToolUse hook on Bash (.claude/settings.json): refuse `git ... --no-verify` (or `git commit -n`),
a force push and `git rebase` (not --continue/--abort, nor `git pull --rebase`) without the owner's OK
marker, and a bare `br create` (loka-zrqm, loka-sakg). Without the PM's LOKA_PM=1 prefix refuse
pkill/killall, `gh run watch`, `gh workflow run`, the full `npm test`, `test:e2e`, `storybook:smoke`,
bin/check_all.sh, and `git worktree add` outside worktrees.noindex (docs/WORKFLOW.md, Every agent).
Both markers count only as an env prefix of the command. Exit 2 blocks the call
and shows stderr to the agent; anything unparseable lets the call through (one wrong refusal blocks
every agent). Quoted text is one token, so a message or pattern that mentions a flag passes.
ponytail: a command hidden in `sh -c '...'` or eval is not seen.
  python3 -I bin/bash_guard.py < hook-input.json"""
import json
import re
import shlex
import sys

MARKER = "LOKA_OWNER_OK_NO_VERIFY=1"
PM = "LOKA_PM=1"
NPM_FULL = {"test", "test:e2e", "storybook:smoke"}


def strip_heredocs(command):
    """Drop heredoc bodies: they are text (a message, a file), not commands."""
    out, end = [], None
    for line in command.split("\n"):
        if end is None:
            out.append(line)
            m = re.search(r"(?<!<)<<(?!<)-?\s*['\"]?([A-Za-z_][\w-]*)", line)  # not 1<<2
            end = m and m.group(1)
        elif line.lstrip("\t") == end:
            end = None
    return "\n".join(out)


def segments(command):
    command = re.sub(r">&|<&|&>", ">", command.replace("\\\n", " "))  # 2>&1 and a line continuation join
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
    rest = iter(args)
    for t in rest:
        if t[:1] == "-" and t[1:2] != "-":
            for c in t[1:]:
                if c == "n":
                    return True
                if c in "mFCcSut":  # the rest of the token is this flag's value
                    if t.endswith(c) and c in "mFCct":
                        next(rest, None)  # or the next word: `-m "- add"`
                    break
    return False


def command_word(seg):
    """(env prefix, words from the command word on), past VAR=x, nice/sh/bash and their flags."""
    i, wrapped = 0, False
    while i < len(seg):
        t = seg[i]
        if t.rsplit("/", 1)[-1] in ("nice", "sh", "bash"):
            wrapped = True
        elif not (re.match(r"\w+=", t) or wrapped and (t[:1] == "-" or t.isdigit())):
            break
        i += 1
    return seg[:i], seg[i:]


def npm_script(args):
    """The script `npm [opts] test|t|run <script>` runs, or None."""
    rest, pos = iter(args), []
    for a in rest:
        if a in ("--prefix", "-C", "-w", "--workspace"):
            next(rest, None)
        elif a[:1] != "-":
            pos.append(a)
    if pos[:1] in (["test"], ["t"], ["tst"]):
        return "test"
    return pos[1] if pos[:1] in (["run"], ["run-script"]) and len(pos) > 1 else None


def worktree_path(args):
    """The path of `git worktree add [opts] <path>`, or None."""
    rest = iter(args)
    for a in rest:
        if a in ("-b", "-B", "--reason"):
            next(rest, None)
        elif a[:1] != "-":
            return a
    return None


def refusal(seg):
    git = invoked(seg, "git")
    if git:
        i, sub = git
        args = seg[i + 1 :]
        skip = [a for a in args if len(a) > 8 and "--no-verify".startswith(a) or a.lower().startswith("core.hookspath=")]
        hooks_off = skip or (sub == "commit" and skips_hooks(args))
        if hooks_off and MARKER not in seg[:i]:
            return f"git hooks skipped without the owner's OK. Fix the cause; with the owner's OK, prefix {MARKER}."
    env, words = command_word(seg)  # the rules below match only the command word, so `echo br create` passes
    name, args = (words[0].rsplit("/", 1)[-1], words[1:]) if words else ("", [])
    if name == "br" and invoked(words, "br")[1] == "create":
        return "bare br create refused: use bin/br_create.sh (plain br create leaves a local source_repo_path)."
    sub = name == "git" and invoked(words, "git")[1]
    rest = args[args.index(sub) + 1 :] if sub else []
    if MARKER not in env:
        if sub == "rebase" and not {"--continue", "--abort", "--skip", "--quit"} & set(rest):
            return f"git rebase refused: merge, never rebase (docs/WORKFLOW.md). With the owner's OK, prefix {MARKER}."
        if sub == "push" and any(a.startswith(("--force", "+")) or re.fullmatch(r"-[a-z]*f[a-z]*", a) for a in rest):
            return f"force push refused: fix the cause with a new commit. With the owner's OK, prefix {MARKER}."
    if PM in env:
        return None
    path = sub == "worktree" and rest[:1] == ["add"] and worktree_path(rest[1:])
    if path and "worktrees.noindex" not in path and "$" not in path:
        return "git worktree add outside worktrees.noindex refused: create it under ../worktrees.noindex (docs/WORKFLOW.md, Every agent)."
    if name in ("pkill", "killall"):
        return f"{name} stops processes by name, other agents' too: stop only the PIDs you started (kill <PID>)."
    if name == "gh" and args[:2] in (["run", "watch"], ["workflow", "run"]):
        return f"gh {' '.join(args[:2])} refused: only the PM waits on CI (bin/wait_ci.sh); a push already starts the runs."
    if name == "check_all.sh" or name == "npm" and npm_script(args) in NPM_FULL:
        return "full suite refused on the M1: run the focused tests your diff touches (npm run test:files -- <files>); hosted CI runs the rest."
    return None


try:
    command = json.load(sys.stdin)["tool_input"]["command"]
    reasons = [r for r in map(refusal, segments(strip_heredocs(command))) if r]
except Exception:
    sys.exit(0)
if reasons:
    print(reasons[0], file=sys.stderr)
    sys.exit(2)
