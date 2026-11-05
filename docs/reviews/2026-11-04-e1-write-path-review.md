# Review: Editor E1 write path, PR #610 (loka-wfrgk.2, vduxr.51, vduxr.53 `/edit`)

- PR [#610](https://github.com/lorecrafting/lokacore/pull/610) `editor/e1-write-path` at `8f1f77dc417b90df98c8b8067d7b43fb87360c54`.
- Scope: a trust boundary (a local HTTP server writing the repo): `kernel/ts/play/{guard,editing,write,prose,author,live}.ts`, `mobile/app/preview-server.cjs`, `mix loka.compile --json`, the Book's dev-only text keys. The plan ([owner decision](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md)) is settled and not reopened.
- Governing: [design §11](../rnd/gui-editor-design-2026-11-04.md) (wins over G1), [cartridge.md Editor write path](../system/cartridge.md#author-preview), [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work. No subagents.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- `/code-review medium` is reported in the PR body. No diff under `protocol/`, `schemas/` or `kernel/ts/src/`; no kernel_api change.

## Must be true (written before the diff)

1. Host must be localhost/127.0.0.1 on every route (403), and a non-GET with a foreign Origin is 403; a simple `text/plain` POST cannot write.
2. One path guard: normalized, inside `root + sep`, no symlink on any existing parent, the file itself no symlink; a read is a listed regular file, a create a free place the compile reads. Traversal through `areas/` refused.
3. Every write carries whole-file `was`; a mismatch is 409 `{bytes, sha256}` with nothing written. Writes are tmp + rename.
4. Undo checks every file against its `after` before writing any; after a later write it is 409.
5. One journal entry per write, outside saves one per burst, byte-capped, `/journal` carries no bytes.
6. Hold parks structural compiles and text overlays; release writes the parked build and keeps a later failure visible.
7. `/new` journals from a snapshot diff; argv cannot carry a flag; writes during it are 409.
8. `/edit` refuses a tab, a key line, a choice label, a changed line; JSON, `.scene` and `.cut` lines of words are editable.
9. `--json` leaves the printed compile lines unchanged.
10. Every rendered Book line (bound, speaker-joined, scene/reverie) reaches the dev hook with its text key; nothing of it in a production build.

## Checks that held

- (1) Raw `node:http` probes: `evil.localhost`, `localhost.evil.com:19008`, `LOCALHOST:19008`, `127.0.0.1.evil`, `[::1]:19008` are 403 on GET; `Origin: null`, `http://localhost.evil:19009` and `https://evil.example` are 403 on `/hold`, `/open` and a checkpoint PUT. No `access-control-*` header anywhere in `kernel/ts/play`, so a cross-site GET cannot be read. Both proxies forward the browser's Host (`preview-server.cjs:51`; Vite without `changeOrigin`) and bind 127.0.0.1; no LAN or phone path is documented, so (c) breaks nothing.
- (2) `/source?file=areas/../../x` and a `%00` path are 400 before any read. Symlinked parent and symlinked file: `write.test.ts:93`. Dangling link at a create place is 409 (`guard.ts:77`), and `rename` over a planted link replaces the link, not its target.
- (3), (4), (5), (6), (7): `write.test.ts:123,:215,:236,:407,:348`, `author.test.ts:161-195`; read against the code, the logic matches.
- (9) `content_placeholders_test.exs` pins the printed line with and without `--json`.
- (10) `words.ts:213` notes `shown` after the speaker join; `panel.tsx:36,:120` fill `seen`/`said` only under `devClock`; `ScenePage.tsx:61` goes through `p.text`, the panel's wrapper, so reverie lines carry keys. `GET /schema/scenes` inlines `$defs` and holds the T1 `treatment`/`reverie` enum (probe).
- Mutants: `bin/mutate_diff.sh origin/main` here: red-narrow 26, NO-TESTS 30 (prose.ts and author.ts hold-branch lines: their tests import live.ts, not the module), NOT-UNIQUE 10, TIMEBOX 161, exit 3. By hand against `write.test.ts`, each red: `guard.ts:72` `root + sep` → `root` (the PR's claim holds); `prose.ts:33` stale check dropped; `prose.ts:19` key line edited instead of refused; `write.ts:158` undo 409 dropped; `editing.ts:21` Origin check dropped.
- PR claims rerun: `write.test.ts:56` red control holds; `editing.ts:18` cite holds.
- Survivors judged: `write.ts` `throw e` dropped is equivalent (the spread of `undefined` throws, still a 500); `panel.tsx:191` has no rig, accept.
- Open questions: (a) diagnostics over SSE plus `GET /journal`, (b) `/new` with an area 400 until S3, (d) server-wide Hold with release on unload in E5: all acceptable, E5 owns the page side.

## Findings

**should-fix** `kernel/ts/play/prose.ts:17-19` (worded): a `.cut` line is never editable. Design §11 row `POST /edit` names `.cut`; `cartridge.md:965` says a `.cut` line is plain words, with no `* ` prefix. Probe: `/edit {file: 'scenes/c.cut', line: 1, was: 'The rain falls on the yard.', words: 'x'}` → 400 `"a key line"`. E5's double-click on a modal scene's words would be refused. Fix: for `.cut`, the whole line is the words. No `.cut` exists in any cartridge today, so this may be deferred with the owner's say.

**nit** `kernel/ts/play/prose.ts:28` the tab refusal has no test: mutant `/[\n\r\t]/` → `/[\n\r]/` survives `write.test.ts`. Scenario: a tab reaches a `.scene` line and the compiler's line splitter reads it as a key separator.

**nit** `kernel/ts/play/guard.ts:75` when a parent on the way is a regular file (an `areas` file at the root), `realpath` throws ENOTDIR and the route answers 500 with the absolute path in the body, not 400. Author-side only.

**nit** `mobile/app/book/words.ts:203-205` lines answered by `emoteSentence`/`lineSentence` return before the hook, and `logs.ts:255` appends the item name after `lineWords` for `item.recovered`, so their rendered text has no key. Alt-click on those falls back to the words, as before this slice.

**nit** `kernel/ts/play/write.ts:123-127` `/delete` accepts `areas/<area>.json` (a root bundle not in the design §5.1 root list) because the root check is `!file.includes('/')`. Author-side.

Verdict: **APPROVE WITH NOTES**. The should-fix is small and may land in the fix round or with the owner's deferral.
