# Review: showcase slice D fixes (PR #377, loka-y6yg.12, .13, .14)

- PR #377, branch `toolbox/showcase-d-fixes`, head `acd168b993880c72e94f88e255718c888aa83fd1`. Hosted ci, book-e2e and graph-diff succeed at this head.
- Governing: [cause-and-effect.md](../showcase/cause-and-effect.md) hard rules (:14-27); [hub-and-first-districts.md](../showcase/hub-and-first-districts.md) toll gate and `carry_letter`; [mechanics.md](../system/mechanics.md) quest@1 `current_state` (:370) and `barrier.set` (:2377); source: the blind playtest report and loka-y6yg.12-.14.
- Verdict: **CHANGES REQUIRED** (one blocker, two should-fix, one question, one nit).

## Must be true

1. A letter that is held counts at the accept, and Wat offers deliver or burn only while the quest is open and the letter is held.
2. Deliver and burn are mutually exclusive, and each happens only once.
3. The Warden's lift opens the gate once, and no text the player then sees calls the gate shut.
4. Nothing reopens the gate wrongly. A hostile Warden still walls the gate; the detour is the mill.
5. New text keeps the :14 rules: no score, no "because", no adjective for the player, consequences found and not told.
6. The hash fixture is the compiler's output.

## Proof

- Named runs at the head, all exit 0: showcase_consequence, social, world, fire and sim; `showcase_recap.test.ts`; `content_showcase_test.exs`; `npm run typecheck`.
- (6) `mix loka.compile` on the clean tree gives sha `e675c0bf…`, and `git diff --quiet protocol/` is clean.
- (2) Probe: after deliver, and separately after burn, Talk to Wat is rejected. The quest is resolved and the policy needs `active`.
- (5) The four rewritten "Word gets round." lines and the new signpost pass :14. The signpost names no score and neither pattern.
- Content mutants (recompiled; consequence and social run each time):
  - M2: `gate_lifted` `when` set to false. 11 tests fail, social 15-18 and 21 among them. This backs the PR's "delete gate_lifted" red control.
  - M3: objective always met. Social 10-12 fail.
  - M1: `has_item` dropped from `wat_letter`. **All tests pass** (finding 1).
- PR cite reruns: `quest_journal.ts:78` (ponytail: hints timed from activation) and `mechanics.md:370` match their claims.

## Findings

1. **blocker**, `dialogues/wat_letter.json:11-15` and `kernel/ts/test/showcase_consequence.test.ts:178`: no test pins the `has_item` conjunct (M1 survives). Scenario under M1: accept, leave the letter on the stone, walk to Wat. `wat_letter` opens, and burn is rejected `not_owned`: a dead dialogue. Fix: one assertion that Wat does not open `wat_letter` without the letter.
2. **should-fix (required by the brief)**, `text.json:150` and `dialogues/warden_talk.json:3-8`: the policy is `all([])`. After a successful reason, Talk reopens `warden_talk` with "Toll gate's shut." (probe; playtest report :63), which contradicts the open gate. Use a prompt that is true either way, or close the talk once he lets you pass.
3. **should-fix**, `text.json:522`: the mill text says the wooden door "opens into the tollhouse". From the mill it is shut and offers no verb, but `sign_hub` promises "the words in the room say why". loka-y6yg.13 asked for this text. Add one line, or file a Beads follow-up before .13 closes.
4. **question**, `reactions/gate_lifted.json`: a hostile Warden engages at the gate, and Flee then lands in the tollhouse past him (probe). On main, flee goes to the green unless the player opened the gate. The cause predates this PR (flee picks the open east exit, and does so on main after an explicit `open`), but the PR makes the open gate the default after any lift. This weakens the :24 wall. File it in Beads or accept it explicitly.
5. **nit**, `docs/showcase/cause-and-effect.md:26`: it still says "`sign_social` is not changed". Sync it with the deviation, as `hub-and-first-districts.md` was synced.

## Disposition

Fix 1 and 2 on the branch; 3 and 4 are a line or Beads; 5 is a doc line.
