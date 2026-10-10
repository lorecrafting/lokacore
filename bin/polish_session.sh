#!/bin/sh
# Live polish session (docs/WORKFLOW.md, Live polish session); session worktree LOKA_SESSION_DIR
# (default ~/dev/lokacore-session), ports as in bin/lib/serve.sh.
#   start: new worktree on polish/session-<date>[-n] from origin/main (or the open one), npm ci
#          only on a lockfile change, the owner's Storybook served from it. Twice: no harm.
#          A pushed (closed) session is refused (also by update) until its PR merges and after_merge removes it.
#   update: fetch and merge origin/main into the session worktree (a fast-forward when it holds no commits); when the pull adds or renames
#          a *.stories.tsx or *.mdx file, restart the session's Storybook (its index goes stale).
#   close: refuses uncommitted or untracked files; pushes (hosted CI runs on the head), opens the PR
#          (or reuses the open one), then serves the preview checkout again (bin/preview_update.sh).
set -eu
me=polish_session
bin=$(cd "$(dirname "$0")" && pwd)
. "$bin/lib/serve.sh"
GH=${GH:-gh}
wt=$session
# A pushed branch is a closed session: a local change would never reach its PR, and after_merge would refuse the worktree.
closed() { b=$(git -C "$wt" branch --show-current); [ -n "$b" ] && git -C "$wt" ls-remote --exit-code origin "refs/heads/$b" > /dev/null; }
closed_msg="$wt holds a closed session (its branch is pushed); merge its PR first (bin/after_merge.sh removes the worktree)"
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
  elif closed; then
    die "$closed_msg"
  fi
  wt=$(cd "$wt" && pwd -P)
  if [ "$(served_from "$SB_PORT")" = "$wt/mobile/app" ]; then
    echo "$me: already serving $(git -C "$wt" branch --show-current); nothing restarted"
  else
    npm_ci "$wt"
    stop_port "$SB_PORT"
    serve_storybook "$wt"
    echo "$me: serving $(git -C "$wt" branch --show-current)"
  fi
  urls ;;
update)
  [ -d "$wt" ] || die "no session worktree at $wt"
  ! closed || die "$closed_msg"
  wt=$(cd "$wt" && pwd -P)
  git -C "$wt" fetch -q origin main || die 'fetch failed'
  old=$(git -C "$wt" rev-parse HEAD)
  # A session that holds tweak commits cannot fast-forward: merge, as bin/sync_pr.sh does for a PR branch.
  git -C "$wt" merge -q --no-edit origin/main || { git -C "$wt" merge --abort 2> /dev/null || true; die "merge of origin/main failed (conflict or uncommitted work in the way); nothing restarted"; }
  new=$(git -C "$wt" diff -M --name-only --diff-filter=AR "$old" HEAD | grep -E '\.(stories\.tsx|mdx)$' || true)
  if [ -n "$new" ] && [ "$(served_from "$SB_PORT")" = "$wt/mobile/app" ]; then
    npm_ci "$wt"
    stop_port "$SB_PORT"
    serve_storybook "$wt"
    echo "$me: updated; Storybook restarted for new story or MDX files"
  else
    echo "$me: updated; Storybook left running"
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
    git -C "$wt" push -q -u origin "$b" || die 'push failed; the session stays served'
    url=$(cd "$wt" && $GH pr list --head "$b" --state open --json url --jq '.[0].url // empty') || die 'gh pr list failed'
    [ -n "$url" ] || url=$(cd "$wt" && $GH pr create --base main --head "$b" --fill) || die 'gh pr create failed'
    echo "$me: PR $url"
  fi
  "$bin/preview_update.sh" --end-session ;;
*) echo "usage: $0 start|update|close" >&2; exit 2 ;;
esac
