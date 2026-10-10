#!/bin/sh
# List orphaned busy processes (ppid 1, running over 1 h, cpu over 20%) left by old agent tasks.
# Read-only: it prints "pid etime cpu command" and never kills; stop one by its PID after you check it.
# Skips system paths and the owner's servers. With a file argument it reads `ps -axo pid=,ppid=,etime=,pcpu=,args=` lines from it (the self-test).
if [ $# -gt 0 ]; then cat "$1"; else ps -axo pid=,ppid=,etime=,pcpu=,args=; fi | awk '
  $2 == 1 && $4 + 0 > 20 && ($3 ~ /-/ || ($3 ~ /:.*:/ && $3 !~ /^00:/)) &&
  $5 !~ /^\/(System|usr|sbin|bin|Library|Applications|opt\/homebrew\/Cellar)\// &&
  $0 !~ /(storybook dev|expo start|metro|vite |beam\.smp|phx\.server|\.hermes|lifeops|ollama|preview-server)/ {
    c = $5; for (i = 6; i <= NF; i++) c = c " " $i
    print $1, $3, $4 "%", substr(c, 1, 100)
  }'
