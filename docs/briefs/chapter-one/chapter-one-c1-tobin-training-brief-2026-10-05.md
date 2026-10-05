# C1 — Tobin training and the first armed/defense fight

**Adopted PM assignment; dependency re-pin required before source GO.** Suggested
source branch `chapter-1/c1-tobin-training`; developer uses its own isolated worktree.
Inspected base: provisional B3 integration `9c7e537942e13455a1f64b5afdb90b60faae27dd`,
chapter0.0.18/API1.16. This incorporates B3 IDs/examples fixes; scoped review
approval is pending.
Record the reviewed integrated dependency head before implementation.
C1 target release/API/hash/IDs, source head, PR and implementation verdicts: null.
This planning change certifies no runtime, browser or native proof.

## Goal and governing clauses

Deliver actual all-hours Tobin lessons, an exact usable sword grant and armed/dodge/
shield behavior in the real cellar fight. Follow the [PM adoption](../../decisions/pm-decision-c1-tobin-training-2026-10-05.md),
[C1 mechanics](../../system/mechanics.md#c1-training-and-armed-defense-selected-contract),
[production parameters](../../system/cartridge.md#c1-tobin-and-equipment),
[typed composition](../../system/protocol.md#c1-training-and-defense-composition),
[save/reopen](../../system/save.md#c1-learned-skill-and-lesson-recovery) and
[Book](../../system/book-ui.md#c1-teaching-and-defense-details). Installed
[equipment](../../system/mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets),
[attributes](../../system/mechanics.md#attributes1),
[dialogue receive](../../system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts),
[combat](../../system/mechanics.md#combat1--first-live-encounter-m6-a) and
[ActionSet](../../system/protocol.md#actionset-and-admission) still govern their
existing behaviors. Read [mechanics](../../lessons/mechanics.md),
[storage](../../lessons/storage.md), [contracts](../../lessons/contracts.md),
[mobile](../../lessons/mobile.md) and [evidence](../../lessons/evidence.md) lessons
before touching their areas. Apply Ponytail before source and Ponytail Review plus
actual-diff correctness review before handoff. Mobile/native verification stays paused.

## Real player path and affordability

The inspected source has ferry_landing north → well_lane north → village_green
north → north_gate. Add the passive original Tobin there. Talk/Choose swords,
then Talk/Choose dodge, then Wear the exact gifted rusty sword. Selected chapter
STR10/DEX10 meet both qualification floors; acquired and qualified are distinct projected
facts. Return south → Green south → Well east → Drowned Lantern down → cellar;
Attack the existing first rat. Maud's optional S1 acceptance can precede the descent.
There is no new fight location, unbuilt watch post or required shop purchase.

Literal path from a fresh chapter: player20p/Peg20p/Aldric10p/Tobin0p and no held
items. Swords gives player18/Tobin2 and one body-held rusty sword, load500g; dodge
then gives player16/Tobin4 and the same sword. Wear puts it in wield, retaining
load500g. Cold reopen retains those balances and acquired memberships. The five
passive rats and earned S1 key/storage remain usable; low or spent pennies never
block the main story or corpse recovery.

For the real shield consumer, detour from Well west → Chandler. Buy the new wooden
shield: player12/Peg24/Tobin4/Aldric10, total50; Wear off_hand, total carried900g,
below the authored12000g ceiling. Buying iron sword as well leaves player4/Peg32/
Tobin4/Aldric10, total50 and load1500g. Remove rusty, Wear iron through ordinary
custody transitions. Its actual damage profile differs. No S2 reward, sale, time
wait, replacement gift or fixture-only shield is needed to afford this route.
Other shopping is optional; the free-with-lesson rusty sword already enables the
first trained fight. These are hand-checked proposed-content answers, not executed
C1 proof. Existing route exits, starting funds and B3 stock were inspected;
the new masses are selected in the cartridge contract.

## Composition and implementation boundary

Follow [building mechanics by composition](../../system/architecture.md#building-mechanics-by-composition).
**Consumer:** real Tobin teaching and actual equipped combat against finite cellar rats.
**Reads:** actor/body, bound live teacher and item, current acquired fact and qualification
policy, balances, carrying/slots, HP/life/posture, current encounter/job and RNG.
**Writes:** reserved acquired fact; exact payer/teacher resources; optional exact gift
custody; existing choice/narration; combat HP/job/death consequences. **Ownership:**
skills owns idempotent typed acquisition/usable query; dialogue lowers lesson payment,
receive and acquisition into its existing group; equipment owns custody; combat owns
conditional attack/defense ordering; authority owns receipt/commit/adoption. Combat may
read the shared skills query; it must not invoke another mechanic's player verb.

**Reused primitives:** Boolean fact assignment, stat policy, exact conserved resource
transfer, bound dialogue receive, carrying predicate, equipment slots, round/sampler,
existing death/credit/recovery and changed-row save. **Missing invariant:** acquired
membership must be unique and reserved to the skill owner, separate from current use
qualification. Implement the smallest skills definition/query and typed acquisition
hook, fact-backed as selected; do not add a state section or foundation op. The lesson's
exact teacher payment is a small dialogue hook reusing B2/B3 payment. Preserve shared
query budgets, execution-time rechecks, writer conflicts and atomic rollback. No special
Tobin, swords or chapter branch in kernel code.

Likely files: actual chapter manifest/attributes/skills, Tobin/ordered dialogues, three
new item definitions and Peg offers/text; `kernel/ts/src/content/`, `lib/loka/content/`,
shared skills/payment helper and dialogue lowering, combat round/shared resolver,
policy/action/character/item projection, relevant `protocol/` schemas/registry/generated
contracts; `mobile/authority/local-story/` save receipt/balance validation and Book
Character/NPC/item/combat rendering. Use current forward-development contracts and
independently derive the new release/hash/fresh IDs. Keep B3's four existing shelf
definitions and within-save identities. Out: parry/critical/armor/multi-swing, stat
writers/modifiers, XP/practices/levels, percentages/learn-by-use, broader skill catalogs,
NPC defenses, trainer schedules, restock, server adapters, navigation redesign and native
build/device work. Changed portable foundation semantics would be a scope escalation.

## Controlled acceptance and red controls

Use real loader and public commands, not test-only production functions. Production
numbers live only in the cartridge contract; the following are independent controlled
vectors. Each new test must name a distinct plausible break. Apply its mutant to the
old focused same-layer suite first; add a test only if existing focused coverage misses it.
Actually observe the guarded behavior fail, then restore and rerun.

- **Acquisition does not equal qualification:** controlled STR/DEX9 with learned
  swords/dodge retains both memberships but usable false; at10 usable true. Missing
  membership at10 gives neither benefit. Teach in the9-start controlled cartridge
  through Choose, then fight: the lesson succeeds but does not grant the use benefit.
  Removing the learned guard and removing the qualification guard are separate red
  controls. No live mutable-stat claim is made; D11 owns later stat variation.
- **Atomic one-time lesson:** controlled player10/teacher0 and fee4 yields6/4,
  one acquired fact and one exact gifted sword. Exact receipt retry and a newly
  attempted repeated lesson leave6/4 and one sword. Remote/dead/substituted teacher,
  insufficient pennies, recipient overflow, unavailable original gift and positive
  carry overflow change none. Learning dodge binds no rusty item after its transfer.
  Plant omitted acquired check, omitted debit and omitted carry admission only where
  the prior focused suite does not already catch them.
- **Profile comes from usable wield custody:** S0, playerHP10/ratHP6, zero recovery,
  both accuracy100, fixed base1, fixed sword3, NPC fixed1, no defenses. Unlearned or
  learned-unqualified ends player9/rat5 at S2; qualified wielded sword ends9/3 at S2.
  Holding/nesting/removing it gives9/5. Attack itself changes no HP/RNG and first round
  waits for its actual due time. Plant held-item selection or bypassed qualification.
- **Defense order and strict boundary:** in that sword setup, player accuracy consumes
  raw11520; NPC accuracy raw0. Eligible dodge next consumes raw5927040 (roll40).
  Chance41 succeeds: player10/rat3, S3, no block/damage draw. Chance40 fails; eligible
  shield chance100 consumes raw70819200 (roll0): player10/rat3, S4. Without eligible
  defenses their draws are absent. Plant inclusive comparison, ineligible defense draw
  and continued block-after-dodge. Pin hit:false/loss0/prevented_by to the right stage.
- **Budget and death correctness:** retain existing no-defense A/B/C independent
  answers. A supplemental sleeping survivor cannot defend the waking hit and uses
  ordinary multiplier/recovery settlement; lethal armed damage closes before revival,
  emits one corpse/real credit and prevents retaliation. A controlled supplemental
  rejection-sampler case must exhaust the shared eight raw draws and leave all prior
  RNG/HP/jobs/custody. Reuse existing red tests if they already catch those breaks.
- **Actual content and view:** run the literal route above, show both skills acquired/
  qualified, exact sword/shield Wear and one committed defended rat strike. Complete
  S1's five-rat reward/storage and the main-story return paths with trained equipment;
  no skill or money gate enters them. Book and direct Choose agree on failures; combat
  still blocks Learn/equipment/raw aliases. Committed lines appear once after reopen,
  while pending/stale/refused/faulted results claim no success.

S0–S4 are the hand-checked raw/state literals in the
[first-encounter oracle](../../spec/conformance/first-encounter.md#frozen-input-sequence).
Tests compare to those answers independently of the resolver and the other kernel.
Do not retain obsolete development pins solely for backward compatibility; keep their
current-behavior safety/determinism checks or replace them with independent current answers.

## Persistence, checks, review and scope trigger

Use real SQLite cold reopen after each lesson, each equip transition, Attack, defended/
lethal round, and death/corpse recovery; the later due consumer must accept each lawful
saved intermediate state. Run lesson-before-Buy, Buy-before-lesson and S2 payout with
both in either order. Reconcile historical payments at their revision, with Tobin in
the existing balance replay. Reject forged grant/actor/skill/teacher/payment/gift evidence
and contradictory reserved facts as typed save_corrupt, without rewriting the file.
Current gift custody may lawfully differ after equip, trade, drop or death.

Real failed COMMIT, unknown-not-committed, unknown-committed and lost acknowledgement
must prove old-or-new membership/cost/custody/choice/HP/RNG/jobs/head/receipt. Receipt
retry pays/grants/draws nothing twice. Keep explicit release mismatch refusal and
confirmed Start over. No new snapshot, periodic checkpoint or save migration.

Run focused compiler/loader/short-reference/schema checks, skills/dialogue/payment,
combat/ActionSet/Book and real SQLite suites, plus applicable generated/shared checks.
Schema changes need their bound/required-field mutant sweep. The provisional lane
uses these focused results first; full active `mise exec -- bin/check_all.sh` and red
controls run once at accumulated-head publication under the normal hook. Report exact
commands, exit status and actual red failures. Fresh independent primary review plus
required protocol/save opinion applies; Astra audits `runtime/proposal.ts` if touched.
A source edit after approval needs its scoped recheck. Do not merge remote or run native
sessions under this assignment.

Stop/escalate an unresolved B3 dependency, spec conflict, needed portable foundation op,
new attribute writer or defense catalog, inability to reconcile a lawful saved lesson,
free-item replacement, main route/recovery gear gate, or a footprint too large for the
complete lesson→armed/defended fight outcome. Do not hand off an acquired flag with no
real combat effect. Planning self-review: reused installed ownership and storage; the
new primitive has a concrete consumer. Ponytail Review: lean; no framework/dependency
or second monetary/state ledger. This is author review, not independent approval.
