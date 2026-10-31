# Writing the game

The owner's loop for writing a cartridge by hand. Rules: [owner decision](../decisions/owner-decision-handwritten-prose-2026-10-31.md);
tool behaviour: [author preview](../system/cartridge.md#author-preview).

## Start the tools

Two terminals, from the repository root:

```sh
mise exec -- bin/loka dev cartridges/<name> --watch
cd mobile/app && npm run author
```

Open http://localhost:19006/?dev=1. The Book is the left two columns; the author column is the third.

## Write a scene

Edit `text.json` for any line the Book shows: the page updates as you save, no reload. Add a room,
NPC, item or quest as JSON ([Builders' Guide](../BUILDERS-GUIDE.md)); the page reloads and replays
what you had done. Write a conversation as `scenes/<key>.scene`:

```
npc: maud
when: met_maud

maud: line one
- choice one
  maud: line two
  gives: bowl
```

Leave a line as `~` to come back to it; the column's Still to write lists every `~` by file.

## Jump to a beat

Play to the moment you want to work on, then in the column type a name under Checkpoints and
Save. Later, pick it from the list: the game starts over and replays to that point. Checkpoints
are files in `cartridges/<name>/checkpoints/`, committed with the cartridge.

## Read an error

A broken edit keeps the last good page; the column's first line says what broke, as
`error: rooms/cellar.json:12 unknown exit target "well"`. If a replay stops, the column names the
step (`step 4 refused: talk Maud`) and the Book stays where the replay got to. Alt-click (Option-click) any
Book line to open its source in your editor (`LOKA_EDITOR`, default `code --goto`). The column's
"Why" takes an action or dialogue key and explains the last recorded step: which rules fired and
why the action was missing or refused.

## Before release

`mise exec -- mix loka.compile cartridges/<name> out.json` refuses placeholders; the preview allows them.
