# Item review: toolbox row 26, order and dial puzzles (loka-kgd.75, batch M8)

- Branch `toolbox/m8-puzzles`, head `08492b026c23f16251b5192ea7c40ea0d1ad70b3`, diff against `origin/toolbox/batch-m8` (30 files: one sampler, one test, docs). No PR yet. Content only by PM decision; record kept on the PM's request.
- Governing: [toolbox row 26](../MECHANICS-TOOLBOX.md#ranked-toolbox) (three levers in order open a door; A,C,B does not; dial of three digits); [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts) (`mechanics.md:580` rule-key order); archived [04 §5.2 steps 5-6 (guard on the current overlay; registry order by stable id), §5.3](../archive/spec/04-command-event-effect-protocol.md#52-initial-immediate-composition-profile).
- Hosted CI on the head: ci and book-e2e, both success.
- Verdict: **APPROVE WITH NOTES** (one should-fix for a PM or owner ruling; two nits). "Content only" is honest for the levers, which rest on spec guarantees. The dial is content only on today's kernel, which composes two writes the archived spec forbids (finding 1).

## Must be true

1. A, B, C reaches the solved state and the door opens; A, C, B and any lever out of turn do not.
2. Three wheels hold one digit each; 9 turns to 0; the door opens on the code only.
3. Every order the content relies on is a spec guarantee, not map or file order.
4. No engine or schema change; the floor (1.47, reaction `fact.adjust`) is the lowest the content needs.
5. No committed state or player view holds a wheel at 10.

## Proof

- (1, 2) `kernel/ts/test/puzzles_sampler.test.ts` green at the head (2 tests). Expected values are literals.
- (3) Levers: per event only one of reset/step fires (their `when`s are complementary on the overlay), keyed `_reset` < `_step`; order is `mechanics.md:580` and `reaction.ts:78-86` sort; guard on the overlay is 04 §5.2 step 5 and `proposal.ts:233-236` (`now(p)` per rule). Cites in the developer summary check out. Rerun of the docs' red control (`mechanics.md:1975`): `lever_b_reset` renamed `lever_b_zreset` (after the step) fails with stage 0, expected 3. Wheels: see finding 1.
- (4) Diff touches only `cartridges/puzzles_sampler`, the test and docs. With `at_least` 1.46, `mix loka.compile` refuses the sampler with KERNEL_API_RANGE_INVALID, so 1.47 is the lowest floor.
- (5) No view or `mobile/` reader of `fact_changed` (`git grep fact_changed -- kernel/ts/src mobile`: content loaders only); the test reads 0 after the tenth turn. Only a `fact_changed` rule sees the 10, as the docs say (`mechanics.md:1977`).
- Red controls (mine, focused file): `wheel_2_wrap` renamed `wheel_2_awrap` (keyed before the turn) fails "9 wraps to 0" with `[0, 10, 0]`; `lever_c_reset` guard `equals 2` to `equals 1` fails "C out of order resets" (actual 1). Both reverted.
- Re-lock after solve (`mechanics.md:1977`): accepted for a sampler. It is documented, plausible as a mechanism, and not in the row's acceptance. A guard (`not stage == 3` in each reset and in `pull_a`'s policy) would change the "A always restarts" rule for no row requirement.

## Findings

1. should-fix (docs), `docs/system/mechanics.md:1974`/`:1976`: the dial's wrap writes one fact from two independent reaction deliveries (turn's `fact.adjust`, then wrap's `fact.assign`). Archived 04 §5.3 says "repeated independent assignments conflict" and "an unrelated subscriber's deterministic execution order is not permission to win a conflicting write". The live kernel composes them in order (`mechanics.md:2210`, loka-j2mo, stated there for `spoken` only), and `DIFFERENCES.md` has no row. "Content only" is therefore true of today's kernel, but it rests on a behavior the cited spec forbids. Failure: a kernel that enforces §5.3 rejects every tenth turn as a conflict. System and archive disagree, so this goes to the PM or owner for a ruling (AGENTS.md:14). Then either state the cross-delivery composition as a reaction@1 rule or add a DIFFERENCES row, and cite it from "Why no engine state". A content-only workaround with one writer is not cheap: recipes have no `fact.adjust` (only `reaction.schema.json:473` and `dialogue.schema.json:238` admit it), so it would need one recipe per digit.
2. nit, `cartridges/puzzles_sampler/text.json:11-13`: no wheel shows its digit. A player who loses count must turn ten more times to know where a wheel is. The docs leave this to the author (`mechanics.md:1978`); one sentence in the hall text, or W6 variants, would make the sampler playable as a dial.
3. nit: the developer's `/code-review` result is not reported (no PR body, not in the commit messages). Run it in the fix round.
