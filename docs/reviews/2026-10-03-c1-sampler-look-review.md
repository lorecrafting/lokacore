# C1 sampler Look independent source review

PR #145, exact head `e3c4fddf2bb74c5e4ae4a0e79feda14e83beb434`; base `7845f9b1ab8924013d460b7dda29f21e148eb7e5`. Reviewer authored none of the change.

## Acceptance derived before diff

1. Sampler 0.0.2 in the existing source folder declares existing `description_variant@1`; no engine, App/session algorithm, schema, migration or release-retention machinery.
2. Only version/ref identity and capability manifest/lock semantic deltas; all story strings, bands, world numbers, geometry and rules unchanged.
3. All 19 older artifact/source/trace oracles byte-identical. Updated sampler expected bytes derive independently from the declared literals, with a genuine canonical hash check.
4. Production App consumes the updated fixture through its existing import; new saves have the new literal pin. Look is offered and accepts without a target as `looked`; Scene remains Continue-only.
5. Generator 14 declares offered-sequence change with unchanged seeds, pool count/order and no remap.
6. Existing typed missing-pin refusal and explicit Start over persist; no automatic deletion/migration. Old runtime sampler compatibility is waived by the current owner adoption.
7. Owner record/index/rules pointer and sampler spec precede implementation; historical review/evidence stays truthful.
8. Focused real SQLite behavioral checks and an actual missing-capability red control fail for the realistic regression, then restore green.

## Evidence boundaries

PM reports personally verified all six exact-head CI jobs completed success before delegation. This reviewer runs focused source checks only; composed native proof belongs to the independent UI reviewer and will be labeled reported, not personally observed.

## Source verdict: APPROVE

No open source findings at the reviewed head. This is a source verdict; composed Release Simulator proof for the final UI/content pair remains the independent UI reviewer's responsibility. No GUI, native build, heavy Mix compilation or full local pipeline was run by this reviewer.

## Personally run evidence

- `mise exec -- node --test --test-reporter=spec mobile/authority/local-story/sampler.test.ts mobile/app/sampler.test.ts`: 3 passed. Real SQLite walk offers no-target Look, accepts `looked`, retains literal room title/description, reaches all six rooms, restricts active Scene to Continue, persists/reopens line two and checks receipt/trace totals. Production App's existing import creates the new literal content pin and preserves Lantern save bytes.
- Removed `description_variant` from the artifact's manifest and lock, independently recanonicalized/rehashed the altered artifact, then reran the authority sampler tests: exit 1 at `mobile/authority/local-story/sampler.test.ts:109` (offered Look absent), with the other test passing. Restored original bytes and reran both focused files: 3 passed. This regression genuinely reaches capability admission; the loader did not fail early on a stale hash.
- `python3 test/loka/cartridge_sampler_hash.py`: exit 0; regenerated fixture byte-identical. The two oracle edits are literal version and capability amendments, independent of compiler/kernel output. Independently reapplied only these declared semantic transformations to the base expected artifact and compared the full new value/canonical string/hash: exact. SHA-256 `813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa`; 16,635-byte artifact envelope.
- Actual base/head byte comparison: all 19 older cartridge fixtures, 210 frozen older source/fixture/trace files, and the other 22 sampler source files are exact. Manifest differences are only `0.0.2` and `description_variant: 1`. All text, bands, numbers, geometry and rules remain exact. Simulation fixture inventory/order and seed objects are unchanged; generator changes only 13 to 14.
- `mise exec -- node --test --test-reporter=spec --test-name-pattern 'pin|unknown format|Start over' mobile/authority/local-story/saves.test.ts mobile/authority/local-story/start_over.test.ts`: 15 passed, including missing-pin untouched refusal, unsupported-format refusal and explicit recovery behavior.
- Additional controlled real SQLite previous-sampler check: created a save using the base 0.0.1 fixture, opened through the unchanged `localSession` with current 0.0.2, observed literal `pinned_release_missing`, offered Start over and byte-identical save before action. Only explicit `startOver()` installed literal version 0.0.2/hash in place; deletion callback was a failing assertion and was never called.
- `shasum -a 256 -c SHA256SUMS` in the author's sampler evidence directory: exit 0; all retained old/new evidence checksums verified.
- Tracked worktree status was clean after controls. Throwaway detached worktree removed before handoff; no author, PM or main checkout changed.

## Inspected and reported evidence

The PM reports direct verification that all six jobs on exact source head completed SUCCESS before this review. Author's retained hashed logs report compiler/cross-loader 3 passed, faults 19 passed and simulation 17 passed. Those were inspected and hash-verified, not personally rerun; avoiding duplicate heavy work preserves the reserved native lane. Native proof is not yet included in this source draft and is not personally observed. Historical 0.0.1 native/review evidence is labeled historical in this PR.

## Correctness and simplicity

The documentation/owner record commit precedes the content implementation commit. This follows the current bounded owner waiver without importing older superseded compatibility requirements. Production engine, loader/compiler algorithms, App binding, session/store algorithms and save format are unchanged. Existing trust-boundary validation remains intact. Expected values are independent literals/approved text, not computed from compiler or kernel. The added Look assertions detect capability omission and an accidental examine outcome with controlled normal invocations; no redundant new test harness or production hook was introduced.

Ponytail Review: Lean already. Ship. No new production machinery, dependencies, abstractions or release-retention scaffolding.

## Limits

The source approval does not claim fresh native/GUI behavior. The final canonical review record must separately cite the independent UI reviewer's composed Release Simulator proof and label it reported evidence. The canonical record/index publication is coordinated by the PM; this reviewer has not published an uncoordinated branch.

## Separate GPT-6.1 Sol source review

```text
VERDICT: APPROVE — separate read-only source review, PR #145.
HEAD: e3c4fddf2bb74c5e4ae4a0e79feda14e83beb434
BASE: 7845f9b1ab8924013d460b7dda29f21e148eb7e5
Authored none; acceptance derived before reading the diff.

FINDINGS: None.

Personally verified:
- Exact clean HEAD.
- Independent literal Python oracle and canonical SHA-256:
  813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa;
  16,635 artifact bytes.
- Exact permitted semantic delta; all 68 catalog entries unchanged.
- Byte comparison of 283 frozen files, including all 19 older cartridge
  fixtures, older sources/oracles and 22 unchanged sampler source files.
- All 31 retained evidence hashes.
- Real GameSession/in-memory SQLite: offered no-target Look, accepted
  looked, unchanged state/clock, authentic receipt, freshness enforcement,
  modal Look refusal, Continue-only actions and authority reopen at line two.
- Old pin: typed missing-pin refusal without writes or deletion; explicit
  Start over pins 0.0.2.
- Unmodified production App import consumes the new fixture automatically.
- Rehashed capability-omission input makes the offered-Look assertion fail.
- Existing leave-ending test and both simulator regression seeds pass;
  generator 14, pool/order and seed inputs preserved.

Reported, not personally run:
Coordinator’s exact-head green CI; author’s compiler 3, focused Node 3,
fault 19, simulator 17 and filesystem mutation/restored-GREEN proof.

Limits:
No personal disk close/reopen, Mix build, full pipeline or native observation.
Combined native proof and owner Gate C1 remain pending elsewhere.
No files, records or branches changed.

Ponytail Review: lean; no actionable complexity findings.
```
## PM publication

The source controls are retained in the [checksum manifest](../evidence/2026-10-03-c1-sampler-look-primary/SHA256SUMS). The separate Sol answer above is appended verbatim. Bounded content native evidence is now linked below. Full PR #144 UI native acceptance and owner Gate C1 remain pending.


## Bounded native content disposition

The [content reviewer’s scoped disposition](../evidence/2026-10-03-c1-sampler-look-primary/native-content-disposition.md) is reproduced below.

# PR145 bounded content native-evidence disposition

Source reviewed: `e3c4fddf2bb74c5e4ae4a0e79feda14e83beb434`. Existing source APPROVE unchanged; no new source review or author-history edit.

**Disposition: the content-specific combined native pin/Look requirement is satisfied by reported independent primary evidence.** No missing content-specific must-have remains. This does not approve PR144's full native walk, the subsequent readability repair, owner-phone feel or Gate C1.

Evidence inspected: `c1-dialogue-primary-native-partial.md` and `c1-dialogue-primary-native/` artifacts. This reviewer personally reran only the read-only SHA256SUMS verification: all 13 manifested artifacts match. No GUI/build/test was performed in this disposition. Native actions/build are the independent UI primary's reported personal execution, not mine.

The primary reports a clean composed Release Simulator build at `665b3ff6c0fbed1109a8aa13576bad710a623d11`, the sampler fixture byte-identical to reviewed PR145, installation/launch in an isolated Simulator, and personal invocation of the offered `Look, Ferry Landing` title action. Retained fresh save metadata names literal `ashmere_sampler@0.0.2`, content hash `813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa`, `description_variant: 1`, and clean `loka-kernel@665b3ff6c0fbed1109a8aa13576bad710a623d11` stamp. Ordered World AX evidence offers the title Look and authored room description. Before/after metadata shows revision/receipts 0/0 to 1/1 with identical pin, clock, RNG and state-row hash, consistent with the personally reported accepted no-change Look. The retained metadata does not expose the literal receipt decision outcome (`command_kinds` is null); I do not claim to have inspected native `looked` directly. That exact outcome was personally asserted in my approved source/real-SQLite control.

This bounded PR changes only the content version/reference identity and declaration of the already installed capability. My existing source checks independently proved no-target `looked`, Scene Continue-only restriction, SQLite scene persistence, missing-pin refusal without writes, explicit Start over, and immutable story/rule/number data. The native requirement adds actual consumption of this artifact through the composed app and an actual offered-title Look dispatch; the reported clean build, exact pin/stamp, AX offer and revision/receipt transition supply that proof. Repeating the unchanged six-room/scene walk natively is part of the broader UI acceptance already pending, not a new content-specific blocker for this manifest repair.

Unattributed concurrent play is excluded from proof. The primary's outstanding UI routes, dialogue/scene relaunch and scroll stability remain pending. The observed body readability concern belongs to the subsequent UI repair and is not waived here. No native/full-UI APPROVE or owner acceptance is inferred.


The independent UI primary's [partial native report](../evidence/2026-10-03-c1-sampler-look-primary/native-primary-partial-report.md), [actual clean Release build status](../evidence/2026-10-03-c1-sampler-look-primary/native-release-build-status.json), [fresh pin/trace](../evidence/2026-10-03-c1-sampler-look-primary/native-world-fresh.json) and [after-Look metadata](../evidence/2026-10-03-c1-sampler-look-primary/native-after-look.json) are copied byte-for-byte from the independently captured, checksum-verified proof. The content reviewer inspected and verified them; they are reported native evidence, not that reviewer's own GUI actions. The composed kernel stamp is `665b3ff6c0fbed1109a8aa13576bad710a623d11`; sampler bytes match this PR's reviewed source. A body-readability concern and the remaining UI-native walk are explicitly open in the report and are not waived here.
