# Sourced by every bin harness that runs git init or git add in a throwaway repo: a git hook
# exports GIT_DIR and friends, and without this the plants land in the real index and config.
unset $(env | sed -n 's/^\(GIT_[A-Z_]*\)=.*/\1/p')
