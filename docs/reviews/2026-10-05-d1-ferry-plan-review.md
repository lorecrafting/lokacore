# D1 ferry and Sedge — independent planning review

**Verdict: CHANGES REQUIRED.** One should-fix finding; no substantive design finding.

Reviewed `docs/d1-ferry-source-plan` at exact
`323f9274dd50f3b3d7e7349a1155b534b908184a`, against published main
`ac9b22757a82c4b4c3d60ddf8f94e5c98014bae4`. Fresh independent Codex reviewer,
authored none of the plan. Review record only; source PR and successor pins remain null.

## Requirements independently derived

The [brief](../briefs/chapter-one/d1-ferry-isle-brief-2026-10-05.md),
[PM adoption](../decisions/pm-decision-d1-ferry-isle-2026-10-05.md), five active
[D1 mechanic](../system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract),
[wire](../system/protocol.md#d1-ferry-transport-composition),
[content](../system/cartridge.md#d1-ferry-and-isle-declarations),
[save](../system/save.md#d1-ferry-and-lesson-recovery) and
[Book](../system/book-ui.md#d1-ferry-and-sedge-details) clauses must preserve:

- Exact authored endpoint/quote and commanded actor admission; conserved 2p to
  Sedge outbound, free return, actual nonempty owned isle corpse waiver, one
  atomic body/eligible bound escort crossing and no ferry rescue credit.
- Six reciprocal rooms, no compass crossing or future mill edge, current Chapel
  Nave death return and actual gear-free recovery including the sole nested light
  in the dark Loft. Unsafe recovery blocks source until an active fallback adoption.
- Immediate co-located free once-only swim learning before S27, separate acquired
  and qualified state, and D6 admission/CON policy deferred to its real consumer.
- Changed rows and original accepted receipt committed before adoption; historical
  validation independent of later retrieval, death, payments or escort separation;
  real SQLite fault/replay proof separate from isolated browser interaction.

## Finding

**D1P-01 — should-fix**, `docs/decisions/README.md:35`, with the corresponding
D1 entry absent from `docs/system/owner-rules.md`. The PM adoption is added to the
decision index but not the active-rules index. The latter's source-of-truth process
rule explicitly requires new decision records to add a line there. An agent deriving
current adopted policy from that advertised index finds B3/B4/B8/D2 but misses D1's
new ferry/lesson selection. Add one short linked D1 rule without duplicating its
contract. No source change is needed. **Open.**

## Evidence and design checks

Read AGENTS, delivery/reviewer workflow, owner rules, relevant lessons, archived
chapter map/cast/skill intent, Legend recovery adoption and published B3/B4/B8/
PR190 review and evidence records. Published-main ancestry contains PR205, PR206,
PR215, PR190 and browser-preview PR194 merge commits. Historical evidence retains
its original pending-publication wording; it is not mistaken for D1 proof.

Inspected existing `resource.ts::transfer`, B8 provider binding and
`escort/shared.ts::travel`: positive payment uses two conserved adjustments;
B8 needs a present living NPC and cannot transport; escort travel verifies original
accepted binding, active quest, live NPC/body co-location and following status.
It refuses inconsistent following presence and leaves separated/completed relations
alone. Reusing it avoids teleporting Wren or granting arrival credit. The proposed
narrow `use_transport` seam fits this first consumer without a new delta operation,
ledger, generic service benefit or second Move command. Shared keyed admission and
bound confirmed Book history remain explicit implementation obligations.

The adopted Sedge recipient and corpse waiver are PM-selected additions under
mechanics delegation, not claimed archived implementation. The archive's Bram,
schedule, S27 and isle respawn differences are explicitly superseded. Vacuous D1
qualification does not certify D6 water access or invent an installed CON stat.

- `mise exec -- elixir bin/check_docs.exs`: exit 0, 602 docs, no broken links or
  unreachable files at the reviewed head; with this record/index, 603 docs also pass.
- `git diff --check ac9b2275 HEAD`: exit 0.
- Independent Python SHA-256 of the v025 canonical fixture matches the brief's
  `c8bc55ca6aa55af4b7579e570b3e6f85fce370b80ebda766df16780fa8f8933a`;
  retained ID fixture contains 111 entries. This checks existing pins, not D1 source.

Ponytail Review: **Lean already.** Existing payment, escort, skills, containment,
receipt transaction and Book patterns suffice; no speculative machinery found.
Docs-only review: no gameplay tests, mutants, full publication gate, source build,
preview, owner save, native work, push or merge claimed.
