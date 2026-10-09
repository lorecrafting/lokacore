#!/bin/sh
# Live polish session (docs/WORKFLOW.md, Live polish session); session worktree LOKA_SESSION_DIR
# (default ~/dev/lokacore-session), ports as in bin/lib/serve.sh.
#   start: new worktree on polish/session-<date>[-n] from origin/main (or the open one), npm ci
#          only on a lockfile change, the owner's Storybook served from it. Twice: no harm.
#   close: refuses uncommitted or untracked files; pushes through the pre-push hook, opens the PR
#          (or reuses it), then serves the preview checkout again (bin/preview_update.sh).
set -eu
me=polish_session
bin=$(cd "$(dirname "$0")" && pwd)
. "$bin/lib/serve.sh"
GH=${GH:-gh}
wt=${LOKA_SESSION_DIR:-$HOME/dev/lokacore-session}
case ${1-} in
start)
  if [ ! -d "$wt" ]; then
    git -C "$bin" fetch -q origin main || die 'fetch failed'
    b=polish/session-$(date +%F) n=1
    while git -C "$bin" rev-parse -q --verify "refs/heads/$b" > /dev/null \
      || git -C "$bin" ls-remote --exit-code --heads origin "$b" > /dev/null; do
      n=$((n + 1)); b=polish/session-$(date +%F)-$n
    done
    git -C "$bin" worktree add -q -b "$b" "$wt" origin/main
    (cd "$wt" && mise exec -- mix deps.get --check-locked) || die 'mix deps.get failed'
  fi
  wt=$(cd "$wt" && pwd -P)
  if [ "$(served_from "$SB_PORT")" = "$wt/mobile/app" ]; then
    echo "$me: already serving $(git -C "$wt" branch --show-current); nothing restarted"
  else
    stop_port "$SB_PORT"
    npm_ci "$wt"
    serve_storybook "$wt"
    echo "$me: serving $(git -C "$wt" branch --show-current)"
  fi
  urls ;;
close)
  [ -d "$wt" ] || die "no session worktree at $wt"
  [ -z "$(git -C "$wt" status --porcelain)" ] || die "uncommitted changes in $wt: commit or drop them; nothing changed"
  b=$(git -C "$wt" branch --show-current)
  git -C "$wt" fetch -q origin main || die 'fetch failed'
  if [ -z "$(git -C "$wt" rev-list origin/main..HEAD)" ]; then
    echo "$me: no commits on $b; no push, no PR"
  else
    git -C "$wt" push -q -u origin "$b" || die 'push failed (pre-push hook?); the session stays served'
    url=$(cd "$wt" && $GH pr view "$b" --json url --jq .url 2> /dev/null) \
      || url=$(cd "$wt" && $GH pr create --base main --head "$b" --fill) || die 'gh pr create failed'
    echo "$me: PR $url"
  fi
  "$bin/preview_update.sh" ;;
*) echo "usage: $0 start|close" >&2; exit 2 ;;
esac
