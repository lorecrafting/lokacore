Turn the picks waiting in the Loka picker queue into Beads issues (outside a live polish session;
docs/web-preview.md, Polish queue).

1. `bin/polish_status.sh dir` prints the served worktree's queue directory (by Storybook's port);
   read its `picks.jsonl` and `status.jsonl`. A pick is waiting when it has no `type` and no
   status line with its `id`.
2. For each waiting pick, create one issue with `bin/br_create.sh "<first line of the note>" -t task
   -l ui-feedback -d "<description>"`. The description holds, verbatim: the owner's note, then per
   element its chain (`EntityLine › Tap`), box (`382×28`), the story title, palette and viewport,
   and the crop path (`.polish/shots/<id>-<i>.png`, in that worktree). Nothing invented; a missing
   field is left out.
3. Mark it moved: `bin/polish_status.sh <pick id> moved <beads id>`.
4. Reply with one line per pick: `<pick id> -> <beads id> <title>`.
