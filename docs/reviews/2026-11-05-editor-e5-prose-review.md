# Review: Editor E5, prose in the Book (PR #617, loka-vduxr.53)

- PR: [#617](https://github.com/lorecrafting/lokacore/pull/617), branch `editor/e5-prose`
- Reviewed commit: `5da2d0d2217f71a92d38487ffceb3ae48d25a961`
- Governing: [WORKFLOW review stance](../WORKFLOW.md), [prose-in-the-book rulings](../design/prose-in-the-book-rulings.md), [book-ui Author mode](../system/book-ui.md#author-mode-dev-only), [BOOK-UI-COMPONENTS Author-mode marks](../BOOK-UI-COMPONENTS.md) (line 272), [gui-editor design ruling 13, section 11](../rnd/gui-editor-design-2026-11-04.md), [cartridge.md author preview](../system/cartridge.md#author-preview)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 5da2d0d2217f...`): graph-diff success, ci success, book-e2e success.
- `/code-review medium`: reported in the PR body (run before the fix commits, not rerun; this review covers them).

## Must be true (written before the diff)

1. One compile at a time, in save order; a save during a compile compiles next and the older words never overwrite its push.
2. An `/edit` shows its words at once with no mark; a refused compile marks them `unconfirmed`; a good compile clears the mark.
3. Cmd-Z outside a field puts back only this page's edits, newest first, and the line shows the old words at once; 409 when the file changed since.
4. A field whose line changed on disk gets the notice with theirs' words; Keep mine writes the draft, Take theirs closes.
5. The pagehide beacon releases the Hold and passes E1's Host and Origin check; a cross-site POST or a rebinding Host still gets 403; no CORS header lets a foreign page read a GET.
6. No author code in the production bundle; Book keys do nothing inside a text field; `[` and `]` wrap over the page's `~` lines.
7. Tests use expected values the code under test does not compute; the `git grep` guard fails on a planted second import.

## Checks that held

- Security probes (real watcher behind the Metro proxy and direct): hostile-Origin POST `/hold` 403 "not from the author page"; foreign Host 403; same-origin text/plain beacon body 200 `{"held":false}`; GET `/line` with a foreign Origin answers but carries no `access-control-*` header.
- Production export (`npx expo export --platform web`): 0 files hold the inbook sentinel; `prose_rules.test.ts:99` guard lists only `panel.tsx`'s gated require.
- Real Chrome (Playwright `channel: 'chrome'`, `?dev=1`, diku_sampler, 1200x900), screenshots `e5-review-00..11` in the reviewer's scratchpad: double-click on `room.hall.description` opens an outlined field with caption `text.json:37  Enter saves · Esc cancels`; Enter closes it in 26 ms, the words show with no mark, disk is written at once; `]` lands the title `~` then the description `~` and wraps; second Cmd-Z note goes to the panel feed; 409 flow: an outside write under an open field shows the warning-ink notice with theirs' words in 227 ms, draft kept; Keep mine writes the draft to disk and Book; Take theirs closes and shows theirs. Marks match book-ui: `warning` margin bar for `~`, outlined field and landed line.
- PR claims rerun: `queue = Promise.resolve()` turns `author.test.ts` red (1 fail); a JSON-only content-type guard in `editing.ts` turns `told.test.ts` red (2 fails). Both hold.
- Tests follow AGENTS.md "Writing tests": each has a break comment, expected values are hand-written, the harness stubs only `/__author` routes.

## Mutants

`bin/mutate_diff.sh origin/main` (MUTATE_MINUTES=30, detached worktree at the head, run beside another agent's sweep): 197 mutants, red-narrow 23 + 3 timeout, SURVIVED 0, NO-TESTS 23, NOT-UNIQUE 6, TIMEBOX 142, exit 3. The handback's table (at `cc4e848ed`) reached 56 rows with 9 survivors; this run reached fewer, none survived. NO-TESTS: `author.ts` (8, exercised through the spawned process in `author.test.ts`, which mutate_diff cannot map), `panel.tsx` and `tools/author-panel` (15, the panel has no harness, stated in the PR). The unrun rows are covered by the hand mutants below.

Hand mutants, each against the tests that import the module, all red: `told.ts` clear on `compiled` alone (told.test 1 fail); `prose.ts` `if (other)` to `if (false)` (told.test 1 fail; live.test does not reach `/line`, green as expected); `prose_rules.ts` `step` wrap (1 fail); `author.ts` `saves !== read` to `===` (author.test 3 fails); `author.ts` queue reset (1 fail); `editing.ts` content-type guard (told.test 2 fails).

## Findings

- Should-fix (logic): `kernel/ts/play/prose.ts:56-64` with `:72-73`. For a line whose key has no `"key":` definition (an inline `~` in a `.scene`, `.cut` or room JSON), `sourcesOf` adds every JSON `"~"` literal in the cartridge to the candidates, and `located` answers 400 at two or more. diku_sampler holds 37 `"~"` text values, so every inline `~` scene line there is refused and the Book says `Not a line of words. Alt-click opens its source.` Any cartridge with one `"~"` placeholder in `text.json` loses double-click writing of its scene `~` lines; the prologue's scenes are the owner's next work. Proven with a scratch cartridge (`* ~` in a scene plus one JSON `"~"`): 400 "more than one source line holds". A JSON line that defines some other key (`"x.y": "~"`) cannot be this key's source and should not count.
- Should-fix (logic): `kernel/ts/play/told.ts:9-12`. After `/undo` 200 the optimistic words stay in `words` until the next good compile; the ruling (Put it back) says "The line shows the old words at once". Measured in Chrome: disk reverted at once, the Book still showed the new words at +254 ms and reverted at +638 ms on a warm 0.5 s compile; a cold compile is about 7 s, and a second Cmd-Z in that window undoes a second edit with no redo. The `ponytail:` comment on line 9 names this limit and its trigger ("if it shows"); it shows. Drop the key's words on `/undo` 200 (editing.ts knows the answer).
- Nit: `kernel/ts/play/author.ts:219` the startup `await build()` runs outside `queue`; a save landing during it starts a second compile concurrently. Harmless: `saves !== read` drops the stale one.
- Nit: `mobile/app/author/inbook.ts:201-203` `edits.pop()` before `/undo`; a 409 drops the entry, so the next Cmd-Z walks past it. The ruling's 409 text is shown; acceptable.
- Nit (wording): `mobile/app/author/inbook.ts:195` the 409 note runs theirs' words straight into the buttons ("...outside.Keep mine" in `e5-review-09`); a separator or line break.

## Survivor rulings (PR body table)

- `inbook.ts:160` Shift-Enter and `:162` multi-line typing: nits. The ruling makes Shift-Enter a no-op and the browser's `insertParagraph` is blocked on `:160`; a test would need a contenteditable, which the harness has (real Chrome), so either is one `keyboard.press` away if a later slice touches the field.
- `inbook.ts:235-236` double-click on a child element: the parent walk is the only way a `<span>` inside a line reaches the field; nit, covered by the real-Chrome flow above (the double-click landed on a text node).
- `inbook.ts:260` another file changing under an open field: only the field's own file matters for the 409; the mutant (dropping the file filter) makes extra `/line` reads, no wrong result. Nit.

## Verdict

CHANGES REQUIRED: the two should-fixes are logic changes (a fix round); no blocker. Security held on every probe; the export holds no author code; the queue and optimistic path match the rulings.

## Re-check: `bbe815ba9f49d1fc6c9ef40f9cdd0fdaa7dff442` (fix commits `654b393e5`, `bbe815ba9`)

CI at the head: `ci` success, `book-e2e` success. Fresh detached worktree; `told.test.ts` + `author.test.ts` 8/8, `inbook.test.ts` 17/17 (real Chrome), `content_placeholders_test.exs` + `red_controls_test.exs` 17/17.

Dispositions:

- Should-fix 1 (scene `~` refused as 400): fixed. `mix loka.compile --placeholders <path>` (`lib/loka/content.ex:78` `placeholder_lines/2`, `lib/mix/tasks/loka.compile.ex:54`) writes each `~` key's own `file:line`; `author.ts` pushes it with the diagnostics; `told.ts` keeps `places`; `prose.ts:80` `located` uses the map before scanning. `test/loka/content_placeholders_test.exs` covers `.scene` (top and nested `* ~`), `.cut`, room `{"prose": "~"}` and `text.json`, expected lines hand-written. Red controls hold: `located` forced to always scan, told.test 1 fail; the `prose` field mapping dropped, the Elixir test fails (`village_green.json:3` vs `:4`).
- Should-fix 2 (undo words linger): fixed. `editing.ts:65` tells on `/undo` 200 too, from the undo body's `key`/`words`; `inbook.ts` posts the whole edit entry. Red control: `/^\/edit$/` alone turns `told.test` 1 fail. `write.ts:154` `undo` destructures only `id`, so the extra fields are harmless.
- Nits: button spacing (`inbook.ts` padding on the button's left), 409 `edits.push(last)`, startup `queue = first.catch(() => {})` then awaited: all as stated.
- CI fix `bbe815ba9`: `compiled(...)`'s result is returned after the placeholders write, so the task's exit status is the compile's again.

Attacks on the map:

- Area folder: `SourceFiles.paths` globs `**/*.{json,scene,cut}`, so an area's scene or room is indexed.
- Duplicate key: `into: %{}` keeps the last `{key, place}`; the index already lets a JSON half win over its scene. Author-side; no finding.
- Failed compile: no placeholders file is written, `parsed` yields `{}`, `located` falls back to the scan. Fine.
- Release and fixtures: the flag parses only in the five-argument form after `--allow-placeholders --json`; `options/1` raises usage otherwise; the artifact bytes are unchanged, so the hash fixtures stand.
- Stale map (an outside edit moves a line): should-fix below.

Finding:

- Should-fix (logic, 2 lines): `kernel/ts/play/prose.ts:80-86`. `located` trusts `places[key]` without checking that the line there still reads `~`. `places` refreshes only on a good compile, so between an outside save that inserts a line above a `* ~` and that compile (debounce plus 0.5-7 s) a double-click on the `~` opens the moved-in line's words. Proven with a scratch call (`places = {key: 'scenes/s.scene:2'}`, line 2 now `* Inserted words.`): 200 `{line: 2, was: '* Inserted words.', words: 'Inserted words.'}`. Enter then posts `/edit` with that `was`, which matches disk, so the wrong line is overwritten (Cmd-Z restores it; the words are visible in the field before Enter). Guard: when the mapped line's own words are not `~`, fall back to `sourcesOf` or refuse 409. A logic change, so not fixed in place; a narrow race on the owner's own saves, so it may be filed in Beads rather than hold the PR.

Known gap (PM filing): an edited scene line in an already open conversation keeps its old words until Leave and Talk. Scope confirmed: `panel.tsx:124` applies the overlay inside `text(key)`, so only lines whose words were copied into game state when spoken miss it; room, text.json and not-yet-spoken lines redraw at once. `/edit` writes disk before the compile and the journal holds the undo, so nothing is lost on disk.

Verdict: APPROVE WITH NOTES. One should-fix (the stale-map guard) to file or take in a two-line follow-up at the PM's call; no blocker.
