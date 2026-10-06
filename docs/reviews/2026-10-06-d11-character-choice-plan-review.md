# D11 character choice planning review — 2026-10-06

Reviewed local planning head `80ce3885` against [attributes/checks and D11](../system/mechanics.md#d11-character-choice-selected-contract), [chapter declarations](../system/cartridge.md#d11-ancestry-declarations-selected-contract), [save](../system/save.md#d11-character-choice-recovery), [Book](../system/book-ui.md#d11-character-choice-interaction), the published B2/B4/B6/C1/D6/D12 consumers and the [owner's fey ruling](../decisions/owner-decision-chapter-one-content-2026-10-02.md). Docs-only review; no implementation or mutation result is claimed.

## Requirements derived before disposition

- One explicit, character-owned choice precedes ordinary play and persists through death; six authored values and effects commit with one receipt and survive failed/uncertain COMMIT, replay and reopen.
- Existing checks read the chosen character's current value: C1/D12 qualification, B6 PER5 Seek, D6 acquired/qualified Swim, B4 visibility and B2 faction. CON/SPI have no Chapter 1 stat check. No fabricated PER11 gate, CON floor, spell, Crown or mining effect.
- Hill sight changes darkness visibility for that character without making a lamp lit, opening a barrier or revealing unrelated hidden facts; fey keeps SPI+1 and the selected Priory/Fen −2.

## Verdict: CHANGES REQUIRED

1. **Should-fix — B6's actual PER check is omitted from the wiring contract.** `docs/system/mechanics.md:274,278` describes B6 with `stat_compare`, but the installed `seek_wisp` recipe uses `attribute_threshold`; `kernel/ts/src/mechanics/action_recipe/rule.ts:123-124` reads the immutable `world.attributes` map directly. If source changes only `stat_compare`, fen-born's saved PER6 is ignored by Seek, while the proposed PER5 pass test stays green. Name this direct consumer in the selected clause and acceptance, with a source test that changes the actor's selected PER and observes the real B6 check result on controlled data.
2. **Should-fix — active attributes clause contradicts the selected writer.** `docs/system/mechanics.md:262-266` still says attributes have no state, every actor uses the start and ancestry is later. A source implementer following that active clause could legitimately omit D11's changed row and death-safe identity. Amend the existing clause alongside the new D11 section to state the selected character override and NPC start behavior; leave exact new row/op syntax to the source PR.
3. **Should-fix — distinguish sight from illumination at all B4 call sites.** `docs/system/mechanics.md:278` and `docs/briefs/chapter-one/d11-character-choice-brief-2026-10-05.md:36` cover a dark room but do not mention Scan into an adjacent dark room. The installed `sight()` independently checks `!illuminated` for that destination (`kernel/ts/src/mechanics/movement/rule.ts:50`), while `light_off` is used by B6 Seek. A hill-folk actor could see locally but get a blank adjacent Scan, or a shortcut that reports them illuminated could suppress Seek. Specify the intended adjacent-room sight result and require proof that dark-sight does not change physical light state or B6's `light_off` result.

Ponytail/correctness: the draft confines work to existing skill, faction, check and darkness paths and avoids a generic ancestry framework. The findings ask for exact existing consumers and one contradictory clause, not a new system. The chosen PER5, CON/SPI honesty, once-only receipt provenance and deferred effects otherwise align with the cited rules.

## Scoped fix recheck — `627853a0`: APPROVE

- **D11-P1 closed.** `mechanics.md` now names both `stat_compare` and B6's separate `attribute_threshold` arm. The brief requires a controlled difficulty6 case where saved PER5 fails and fen-born PER6 passes, after testing the stale-map mutant against existing focused tests. Production difficulty5 and no-RNG behavior remain intact.
- **D11-P2 closed.** The active `attributes@1` clause distinguishes installed pre-D11 start-only behavior from selected character-owned values, with NPC and other cartridge starts retained. Exact row/op syntax remains a source-PR obligation.
- **D11-P3 closed.** The B4 clause, brief and Book agree on current-room and legal adjacent dark Scan; barred passages and other perception checks still win. The effect leaves `illuminated` and B6 `light_off` physical-light tests unchanged, with a browser proof named.

This recheck covers only the fix and its direct clauses. It approves the planning contract, not source, generated contracts, save behavior, browser evidence or publication.
