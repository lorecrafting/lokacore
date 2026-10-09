# Sourced: one heavy run (check_all.sh, the pre-push Storybook smoke) at a time across worktrees;
# a second run waits. Released when the sourcing shell (or subshell) exits.
lock=$(git rev-parse --path-format=absolute --git-common-dir)/loka-check.lock
until mkdir "$lock" 2>/dev/null; do
  pid=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -z "$pid" ] || kill -0 "$pid" 2>/dev/null; then
    [ "$pid" = "${said-x}" ] || { echo "check_all: waiting for ${pid:-a starting run} (another check run holds $lock)"; said=$pid; }
    sleep 2
  else
    rm -rf "$lock" # its holder died without cleanup
  fi
done
# ponytail: a run killed between mkdir and this write (or a reused pid) leaves a lock to remove by hand,
# and two waiters taking over one dead lock can race; use flock if that ever bites.
echo $$ > "$lock/pid"
trap 'rm -rf "$lock"' EXIT
trap 'exit 130' INT TERM
