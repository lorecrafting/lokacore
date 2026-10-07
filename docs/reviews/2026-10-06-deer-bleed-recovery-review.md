# Deer/bleed cold recovery — independent save/correctness review

- Reviewer: fresh independent Codex reviewer; authored none of the candidate.
- Source checkpoint: `96f6bab1`; integrated candidate: `dc6ab907e5beb48ab4e6a09d626ba5d4a5c79ee0`.
- Final evidence handoff: `0764e370bcf96ce10c1e46eb02b9f0c91e918b41`; no runtime delta from `dc6ab907`.
- Integrated base: published `main` at `10dd1374`; candidate branch: `fix/deer-recovery-bleed`.
- Verdict: **APPROVE**. No findings or open review items.

## Required behavior

Derived from [D7 deer recovery](../system/save.md#d7-deer-recovery-planning-contract),
[commit, fence, reconcile](../system/save.md#commit-fence-reconcile),
[D7 sight composition](../system/protocol.md#d7-sight-flight-composition-planning-contract)
and [C5 bleed composition](../system/protocol.md#c5-bleed-and-bandage-composition):

1. Every lawful committed prefix reopens, including a current round/bleed pair that
   resumes its group after independent population jobs.
2. Forged group assignments and false sight closure/successor cancellation remain
   typed `save_corrupt`, without rewriting saved bytes.
3. Exact sight occurrence, member, generation, transfer and producer checks remain;
   failed or uncertain COMMIT and retries expose complete prior or next state.
4. Release-pin refusal and explicit Start over remain; no save migration or deletion.

## Reachability and correctness

`store.ts:148` calls `receiptRecovery` on the hydrated pinned release. Reconciliation
adoption calls the same loader (`save.ts:121`). In `receipt-save.ts:27`, `liquidSave`
runs before the sight-gated `deerSave` call at line 34; an earlier validator can refuse,
but cannot return an open story while skipping this sequence.

`fresh.ts:88` installs `populationSpecs` from every cartridge population through
`fresh.ts:232`. Thus a supported world containing a sight plan has a nonempty spec
map. `liquid-save.ts:26` independently selects exact replay for that map, including
profiles without knowledge, water, vessels, services, transports or a consumed holder.
A controlled minimal profile confirmed that no-population recovery skips replay,
while adding only a population spec enters it and refuses missing accepted history.
This proof does not depend on newer v042 features. Missing old pins remain explicitly
refused; arbitrary caller-fabricated release Worlds are not a supported content path.

`receipt-history.ts:31` requires contiguous accepted revisions; line 37 compares the
complete replayed decision, including each writer group, and line 41 compares final
state and revision. Altered lower groups cannot survive through a coincidentally
identical state. The composing kernel still checks the sight member/current binding,
predecessor, successor, equal due time and intervening writes in `proposal_sight.ts`.
The deletion removes only the second, incomplete global writer-order inference;
`deer-save.ts` retains its sight schedule, slot, transfer and producer checks.

The integrated delta after `96f6bab1` was inspected: a typing correction in the new
test and the previously published E1 loader dependency check. Neither changes this
save validation path. No frozen fixture, release pin, save format or kernel rule changed.

## Independent verification

At `dc6ab907`, this command passed **14/14** after all temporary mutations were restored:

```sh
mise exec -- node --test --test-reporter=spec \
  mobile/authority/local-story/deer.test.ts \
  mobile/authority/local-story/deer_bleed_recovery.test.ts \
  mobile/authority/local-story/c5_bleed.test.ts
```

The real SQLite witness reopens the accepted 68400 receipt with groups
`5 round, 6 crow, 7 hounds, 8 deer, 5 bleed, 10 deer`, HP 8 and 11 receipts.
The four forged-group cases refuse in place with identical database bytes, including
sight closure/successor cancellation and mixed sight cancellation plus bleed.
Existing cases exercise genuine deferred-foreign-key failed COMMIT, unavailable
reconciliation reads, lost committed acknowledgement, cold reopen and exact retry for
deer flight/death and bleed tick/cure.

Independent temporary controls, confined to a detached review checkout:

- Restoring the old global detector makes the legal 68400 reopen test fail.
- Normalizing only `writer_group` before the existing canonical decision comparison
  makes all four new forgery assertions fail: **6 pass / 4 fail** in the two deer files.
  The lawful interleaving still passes under this mutation.
- With that same mutation, the prior deer file plus existing C5 suite pass **10/10**;
  the added cases detect a distinct gap in the prior focused tests.
- Restored candidate: **14/14 pass**, source diff clean.

Final handoff `0764e370` adds developer evidence and its spec link only. Independently
verified all 15 retained evidence hashes and inspected the merged focused/full-gate
logs. The developer reports the full gate exited 0; its retained log reaches the
final formatting success. The full gate was not independently rerun by this reviewer.

Ponytail Review: lean already. The existing exact replay replaces the removed
cross-mechanic inference; no new production helper, storage or dependency is added.
Correctness self-review found no remaining issue. Hosted gates and any browser
evidence remain the developer/PM publication gate; independent executions are
limited to the source and SQLite checks above.
