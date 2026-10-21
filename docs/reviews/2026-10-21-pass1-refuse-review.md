# Review: pass-1 GE3 named refusals (loka-y6yg.46)

- Local branch `showcase/pass1-refuse`, exact head `78f9ee05127674122b2b1d92cf0bd1331a9a3b23`; slice commits `daa0a66ed..78f9ee05`; merges into `showcase/pass1` (no PR).
- Governing: [book-ui.md](../system/book-ui.md) (batch amendment); triage rows R1, E8, R3; [cartridge.md theft declarations](../system/cartridge.md#theft-declarations) and kernel_api floors (`:153`, `:202`, `:667`); [contracts lessons](../lessons/contracts.md); [forward development](../decisions/owner-decision-forward-development-2026-10-05.md); AGENTS.md "Writing tests".
- Hosted CI at the head: `ci` run 39673677911 **failure**, `book-e2e` success.
- Written 2026-10-21 by anthropic/claude-opus-5-5.

**Verdict: CHANGES REQUIRED** (two mechanical blockers; the design holds).

## Must be true (written before the diff)

1. R1: an insufficient_resource refusal names the unpaid resource and amount; an authored refusal still wins.
2. R3: too_heavy keeps "the item alone exceeds the ceiling"; over_load is "the load plus the item exceeds it", in the rule and the view alike.
3. E8: a locked Take is projected unavailable with permission_denied, and the Book reads it "not yours".
4. The fence line is the cartridge's text; both loaders refuse a fence without it, at matching places.
5. Old saves reopen: a stored too_heavy rejection stays valid.

Holds: 1-5.

## Findings

1. **Blocker**: `kernel/ts/test/trial.test.ts:268-273`. The pin was not updated: the jailer's `pay` choice now carries `message {resource.short, pennies, 5}`. Hosted `ci` fails, and so does a local rerun. Fix: repin the literal message, with 5 being the fine that test authors.
2. **Blocker**: `mobile/app/stories/views/npc-choice.json` is stale (`stories.test.ts:20`, hosted `mobile` job; local rerun also red). Fix: run `npm run stories:views` and commit.
3. **Nit**: `mobile/app/book/model.test.ts:249-252`. The `NOTED` literal deepEqual only fails on a wording change, so it is a change detector. The trunk-detail test already covers `notes()` (my M8 mutant goes red there). Fix: delete it.
4. **Nit**: the handback has no `/code-review` result. F4, F6 and F10 are not recorded in Beads or on the branch. Fix: list them with a disposition in the fix round.
5. **Question**: `kernel/ts/src/view/action_lists.ts:233`. `unpaid` keys on `admitted`, not on `code`. A talk or flee refusal (`invalid_state`) on an unaffordable recipe would therefore carry `resource.short`, and `why` (`model.ts:146`) would print "need N x". Can a talk or flee action carry recipe costs?

## Brief questions

- **over_load**: an additive protocol enum value plus a registry row. It is not a save-format change, because replay re-decides accepted receipts only and stored rejections keep their code. No kernel_api bump: floors gate authored fields, and over_load has none (precedent: `507a21fba` duplicate_items).
- **shop.not_stolen at the existing 1.94 floor**: allowed under forward development. The only fences are the two in-repo samplers, and both carry the key. The documented diagnostic paths follow each kernel's convention: `theft.test.ts:283` and `content_theft_test.exs:52`, both green locally.
- **SHOWN.take with permission_denied**: no. My probe went red in `sim.test.ts` because `sim.ts:468` sends a NIL-id command that `world.ts:186` refuses with permission_denied, and no view can show that refusal. The lock projection itself is tested: `access_locks.test.ts` goes red when the view's get-chain check (`action_lists.ts:136`) is dropped.
- **e1-certification.md:216**: justified, since a load at the maximum plus an item that fits alone is over_load under R3.
- **Jailer repin** (`showcase_economy.test.ts`): 3 is the authored fine, so the value is independent.
- **Schema sweep**: nothing to sweep. Neither schema change adds a `required` entry or a bound.
- **F5** (`Menu.tsx:39`): every item-page permission_denied (Take, or Put into a locked container) reads "not yours". The designer accepted this.

## Test the tests

Throwaway worktree, focused files; all of these went red: `over` boundary `>`→`>=`, too_heavy/over_load swap, `shortfall` slice off-by-one, `unpaid` code check dropped, fence `not_stolen` branch dropped, over_load dropped from `REFUSED`, `NOTED.permission_denied` dropped, `notes()` limited to too_heavy. Baseline focused kernel, Book and Elixir runs: green.

Claims rerun: "mutants red" holds. "E8 no kernel change" holds (see SHOWN.take above).
