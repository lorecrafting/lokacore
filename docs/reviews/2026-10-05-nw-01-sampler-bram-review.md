# NW-01: always-available sampler Bram — independent review

PR: [#175](https://github.com/lorecrafting/lokacore/pull/175)  
Source reviewed: `9e7e2a0efb488bcc0fd44858670ad36b8be59e43`  
Reviewer: fresh Codex agent; authored none of the source change.  
Verdict: **APPROVE** — no findings or open items.

## Requirements derived before reading the diff

Governing sources: [no-wait opening decision](../decisions/owner-decision-no-wait-opening-2026-10-05.md), [cartridge source/current sampler](../system/cartridge.md#source-layout), [Maud’s Cellar content](../system/cartridge.md#mauds-cellar-content-m20-b2), [opening a story](../system/save.md#opening-a-story).

- Bram remains reachable at Ferry Landing for the current sampler offer and lantern hand-over after 19:00 and on the next day; no player time skip or idle wait is introduced.
- Real-elapsed time and the schedule capability retain their behavior and independent frozen schedule coverage. The content change removes Bram’s authored schedule, without changing engine mechanics or protocol contracts.
- The bundled release has a new version and independently derived canonical artifact/hash/IdSource answers. Prior release bytes remain historical evidence; unrelated content, prose, mechanics and quest/storage behavior remain intact.
- Saves pinned to the absent previous release are refused without automatic deletion or migration; only explicit Start over creates the new release’s save.
- Headless SQLite evidence covers the late-hour/next-day errand and unchanged Maud/elapsed behavior. Historical native evidence remains labeled with its actual release; no owner preview operation is claimed.

## Findings and validation

The diff satisfies the requirements. Production content changes only the manifest version and removal of Bram’s `daily_schedule`. No engine, host, presenter, protocol schema or save format changes. The schedule lock and real-elapsed policy remain. Existing Maud quest/reward, storage, combat, movement costs, resource recovery, geometry and prose remain unchanged.

The new Book regression uses controlled host clocks and real rollback-journal SQLite: offer/Close/offer/accept at 19:00, north movement, next-day 19:00, lantern Take, south return and `leave_it` resolution. Its final assertion checks the original lantern’s persisted custodian against Bram’s independent literal EntityId. It detects both an unavailable speaker and a successful-looking quest completion that loses the hand-over.

Departure/refusal cases now consume the independent ferry fixture; the Book boundary/history and delayed-completion cases consume frozen 0.0.10. Their assertions still exercise speaker departure, continuation retention and delayed receipts. The controlled reward/storage compiler source explicitly restores its historical schedule, retaining its existing frozen answer. Removing the sampler’s former departure assertions from the resource test preserves its distinct fare/rate/band/cap checks; separate schedule and reopen suites retain movement coverage.

Composes-with: the existing elapsed clock advances independently of authored NPC jobs; dialogue/quest admission sees Bram’s ordinary room placement; containment transfers the original lantern; SQLite persists changed rows and the receipt. No mechanic names this NPC or cartridge.

Ponytail Review: **Lean already. Ship.** The runtime behavior is achieved by deleting authored content, with no new abstraction, dependency or compatibility machinery. The historical fixture and small bundle parameters preserve necessary independent coverage.

## Independent validation

All commands used the pinned mise toolchain in isolated detached worktrees.

- `bin/check_all.sh`: exit 0, including 291 Elixir tests, compiler/loader known-answer checks, full kernel/mobile suites, typechecks, structural checks and planted red controls. The PM independently verified all six CI checks green at the exact reviewed source head.
- Focused changed Book/authority/recovery/App suites: exit 0, 36 tests passed.
- Python stdlib oracle reproduced the current fixture byte-for-byte and hash `c731cbac9b9228399a0d485749d7ef4fe781628d589a2ef3db000cbdd977cb84`. All 27 independently derived initial IDs match `newWorld`; initial sampler jobs are empty. Removing the old scheduled job changes only the cloak holder’s ordinal from 27 to 26; earlier entity IDs remain unchanged.
- Historical `sampler_v010_hash.json` is byte-identical to the base’s sampler fixture. Normalizing version references and removing only the old Bram schedule makes the old and new semantic values equal, including the full text catalog.
- A controlled real 0.0.10 SQLite save refused the sole 0.0.11 bundle with `pinned_release_missing`. Its closed-file SHA-256 and old pin remained unchanged before explicit Start over. Calling the existing session’s Start over then opened a save pinned to 0.0.11 and the literal current hash, without deleting the database.

Distinct independent mutant: deleted `leave_it.hand_over` from actual Bram source in a separate disposable detached worktree, compiled the valid artifact, and supplied it to the new late-hour test. The test exited 1 at `mobile/app/book/live_actions.test.ts:114`: the persisted lantern stayed with the player body rather than Bram. Byte-exact source/fixture restoration passed the same test, exit 0. This complements the developer’s documented restored-schedule red control. No custom checker or schema constraint was added, so no additional schema mutation sweep is required.

`git diff --quiet` over cartridges, kernel, mobile, protocol and tests confirmed no surviving reviewer source mutations. Only this record and its index are committed.

## Native scope and limits

Historical Maud evidence is explicitly identified as release 0.0.10. This reviewer operated no Simulator and did not inspect or alter an owner save.

PM-reported native smoke, kept separate from independent reviewer observations: the PM built exact source `9e7e2a0` as a Release app on a new isolated Simulator, leaving the owner’s previous preview untouched. Through visible controls, the PM observed Bram at Ferry Landing at 19:00 and 21:00, offer/accept, north movement, Maud acceptance then Leave/west movement, lantern Take, south return and Bram’s hand-over choice. The PM checked the current content and app/bundle hashes privately. This report supports the scoped UI path; it is not a reviewer-operated reproduction or approval of the unfinished Missing Child chapter.
