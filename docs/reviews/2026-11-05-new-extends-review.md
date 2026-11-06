# Review: `bin/loka new --extends <key>` (PR #659, loka-wfrgk.45)

- PR: [#659](https://github.com/lorecrafting/lokacore/pull/659), branch `tools/new-extends`
- Reviewed commit: `9e4f202815c18d25d99651d14028e125a74a0467`
- Governing: [cartridge.md Source shortcuts](../system/cartridge.md) (`extends`, :365-415; borders, :347-355), [Builders' Guide cartridge layout](../BUILDERS-GUIDE.md#cartridge-layout) (:67-81), [author-side edge cases are nits](../system/owner-rules.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at the reviewed head (`gh run list --commit 9e4f2028...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.

## Verdict: CHANGES REQUIRED (one blocker, two should-fixes)

## Must be true (written before the diff)

1. Every refusal is a compiler refusal (unknown key :412, other kind :413, cycle, crossing :355, missing `with` param) or a sound author guard, and it fires before any file is written.
2. The crossing rule is `Areas.crossed/2` with the compiler's rooms exemption (`extends.ex:93`).
3. The child carries only the fields the chain lacks, judged by the compiler's merge (`extends.ex:164-167`: objects merge, everything else replaces), and the child compiles to the starter's intended artifact.
4. Fields the starter derives from the new name or its placement stay the child's own.

## Checks that held

- Refusals: unknown key and other kind match cartridge.md:412-413; crossing matches :355 and `extends.ex:93`; the params refusal matches the missing `with` (missing_property). An existing file and a bad key are author guards; the key check also keeps `../` out of the globs.
- Ruling, refusals in the starter: keep them. Only the starter can refuse before writing, which keeps "writes nothing".
- Ruling, concrete parents refused: the compiler accepts any same-kind parent (:365), but the bead scopes this to abstract parents and the refusal is documented. Sound; no finding.
- Root-to-area and area-to-root both pass `Areas.crossed`, as the compiler allows.
- `bin/mutate_diff.sh origin/main`: 15 mutants, 15 red, no TIMEBOX, exit 0. Matches the PR. The focused extends test passes 4/4.
- Hand mutant: drop `Map.drop(parent, @own)` (child.ex:86): red.
- loka-wfrgk.13 fit: `{:ok, paths} | {:error, line}`, the `before_write` hook, rollback, and one line with exit 1 suit the /new snapshot journal (gui-editor design §11). Open item for .13, not this PR: NPC and item children land in the entry room or the area's first room, because `--from` takes rooms only. .13 needs a room placement or a follow-up edit, and it should offer only the templates the drop room's area may extend.

## Findings

1. **Blocker**, `lib/loka/content/starters/child.ex:43`, `test/loka/content_starters_extends_test.exs:65`. The rooms exemption is untested. Removing `kind_dir != "rooms" &&` leaves the suite green (4/4), because the only room case is root to root. Failure: a regression refuses `rooms x --area b --extends <abstract room in area a>`, which the compiler accepts, and nothing fails. Fix: add that case and assert it succeeds.
2. **Should-fix**, `child.ex:78`. `deep/2` recurses whenever the parent value is a map, even when the child value is not. With `beast` (abstract, `description: {"prose": ...}`) and `wild` (abstract, extends beast, `description: "npc.wild"`), the valid cartridge makes `npcs deer --extends wild` raise BadMapError instead of printing one line. Fix: `if is_map(x) and is_map(y)`, matching `extends.ex:164-167`.
3. **Should-fix**, `child.ex:12` (`@own`), the answer to the open question. `@own` is room-centred. For statuses and structures it has no effect, because their starters have none of those keys. Populations: a parent `herd` that sets npc, home and area makes `populations deer --extends herd` drop the child's own `npc`, `home` and `area`. The starter still writes `npcs/deer_npc.json` and `rooms/deer_camp.json`, which nothing then uses. Transports have the same issue: `destination`, `reverse`, `detail`, `action` and `recovery_rooms` come from the name or the placement. Fix: give each kind its own derived keys (populations: npc, item, corpse, home, area; transports: the leg keys), or refuse `--extends` for those kinds.

Nits (author-side guards, per the owner rule):

4. `child.ex:22`: a child that extends itself from a bundle is caught later by the compiler as DUPLICATE_DEFINITION. Fine to leave.
5. `child.ex:50`: on a miss it globs every kind. This happens only on the error path, so the cost is negligible. Fine to leave.
6. `child.ex:39`: `params: []` is refused, though the compiler accepts it.
7. Test 1's room `start` equals the parent's room, so that test cannot tell the parent's value from the child's (the area test covers it).
