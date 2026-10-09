# Owner decision: hosted CI gates toolbox branches — 2026-10-09

After the PM proposed it, the owner said (paraphrased) to go ahead with the CI changes.

## Effect

1. A push of only `toolbox/*` branches skips the local pre-push checks (`bin/check_all.sh`, Storybook smoke, dirty-tree refusal) and prints one line naming hosted CI as the gate. A push that also carries any other branch runs the full hook as before.
2. Once per batch head the PM runs `gh workflow run ci.yml --ref <branch>` (plus `book-e2e.yml` when the batch touches the Book) and merges only on a green run for that exact head (`--match-head-commit`), after the reviewer verdict.
3. Every other rule of the [2026-10-08 pre-production gate](owner-decision-preproduction-gate-2026-10-08.md) stands.
