# Independent reviews

Each record is written by a fresh agent that authored none of the reviewed work (AGENTS.md).
One line per record: PR, commit reviewed, verdict, and the final round's commit and verdict
when there were fixes. Findings, dispositions and cross-vendor (Astra) reviews are in the records
(PR #1: dispositions in the PR).

## R0/R1

Reviews before R2 live in the [legacy repository](https://github.com/lorecrafting/lokacore-v2-legacy) (commit `997a7a8`, `docs/rewrite-v3/reviews/`).

## R2: foundation, delivery process, plan

- [R2 foundation](2026-09-24-r2-foundation-review.md): PR #1 at `acccda6`, APPROVE WITH NOTES.
- [Delivery workflow](2026-09-24-workflow-review.md): PR #2 at `7b2e7ab`, APPROVE WITH NOTES.
- [Docs budget](2026-09-24-docs-budget-review.md): PR #3 at `910b6a6`, APPROVE WITH NOTES.
- [Roadmap](2026-09-24-roadmap-review.md): PR #5 at `3638143`, APPROVE WITH NOTES.

## R3: contract slices and gate

- [R3 PR 1 portable ABI](2026-09-24-r3-pr1-portable-abi-review.md): PR #4 at `99b9b37`, APPROVE WITH NOTES; fixes `e258bff`, APPROVE WITH NOTES.
- [R3 PR 2 contracts](2026-09-24-r3-pr2-contracts-review.md): PR #9 at `324015c`, APPROVE WITH NOTES; final `bb4a7fb`, APPROVE.
- [R3 PR 4a capabilities](2026-09-24-r3-pr4a-capabilities-review.md): PR #12 at `0995551`, APPROVE WITH NOTES.
- [R3 PR 6a envelopes](2026-09-24-r3-pr6a-envelopes-review.md): PR #11 at `018ccbf`, CHANGES REQUIRED; fixes `b966814`, APPROVE.
- [R3 PR 3 commands](2026-09-24-r3-pr3-commands-review.md): PR #13 at `cfc6a14`, CHANGES REQUIRED; final `c2284ed`, APPROVE.
- [R3 PR 4b facts, relations, GameView, accounts](2026-09-24-r3-pr4b-facts-review.md): PR #14 at `bccc582`, APPROVE WITH NOTES; fixes `1f96346`, APPROVE.
- [R3 PR 5 composition](2026-09-24-r3-pr5-composition-review.md): PR #15 at `9131dbe`, APPROVE WITH NOTES; fixes `2812a71`, APPROVE.
- [R3 gate](2026-09-24-r3-gate-review.md): PR #16 at `5ee2aa7`, APPROVE WITH NOTES; fixes `94b15fb`, APPROVE; **Gate R3: PASS WITH NOTED GAPS**.

## R3: tooling and design

- [Local hooks](2026-09-24-local-hooks-review.md): PR #7 at `0673d90`, APPROVE WITH NOTES.
- [Lessons split](2026-09-24-lessons-split-review.md): PR #8 at `9bbd478`, APPROVE WITH NOTES; fixes `9ab9094`, APPROVE.
- [Size limits](2026-09-24-size-limits-review.md): PR #6 at `6c02aee`, CHANGES REQUIRED; final `24c72ea`, APPROVE WITH NOTES.
- [Prettier](2026-09-24-prettier-review.md): PR #10 at `7d8d7c8`, APPROVE WITH NOTES; fixes `7e05205`, APPROVE.
- [Room view prototype](2026-09-24-room-view-prototype-review.md): PR #17 at `ba5e572`, APPROVE WITH NOTES; fixes `9cc66f6`, APPROVE.

## Post-R3

- [ADR-074 TypeScript-first proposal](2026-09-24-adr-074-ts-first-review.md): PR #18 at `0f7c4f6`, CHANGES REQUIRED; fixes `1545b82`, APPROVE.
- [Maintenance cleanup](2026-09-24-maint-cleanup-review.md): PR #20 at `d387b93`, APPROVE WITH NOTES; fix `54688e7`, APPROVE.
- [Maintenance: ADR-074 amendments](2026-09-24-maint-adr074-amendments-review.md): PR #19 at `e7b1625`, CHANGES REQUIRED; fixes `7b5f5b0`, APPROVE.
- [Pre-R4 sweep: TypeScript + mobile](2026-09-25-sweep-ts-review.md): PR #21 at `08be6f5`, APPROVE.
- [Pre-R4 sweep: Elixir + scripts](2026-09-25-sweep-elixir-review.md): PR #23 at `c1e8b18`, APPROVE WITH NOTES.
- [Pre-R4 sweep: docs, protocol, CI](2026-09-25-sweep-docs-review.md): PR #22 at `8cd606c`, APPROVE WITH NOTES.
- [Type-check the TypeScript tests](2026-09-25-ts-test-types-review.md): PR #24 at `f3d83b7`, APPROVE WITH NOTES.
- [R4 S1: compiled-cartridge and diagnostic contracts](2026-09-25-r4-s1-review.md): PR #25 at `7015b00`, CHANGES REQUIRED; fixes `695473b`, APPROVE; Astra relay + `870d822`, APPROVE WITH NOTES.
- [R4 S2: Elixir cartridge compiler (R4 minimal)](2026-09-25-r4-s2-review.md): PR #27 at `cd27dea`, CHANGES REQUIRED; fixes `6c1360c` (head `b87388f`), APPROVE.
- [Observability design slice plan, Astra scope](2026-09-25-docs-observability-plan-review.md): PR #28 at `ac8d833`, APPROVE WITH NOTES; fixes `0af7b91`, APPROVE.
- [R4 S3: TypeScript cartridge loader](2026-09-25-r4-s3-review.md): PR #26 at `0bb540b`, APPROVE WITH NOTES; fixes, merge of main and test 4 at `d5a1102`, APPROVE WITH NOTES.
- [Observability design: ADR-075 and observation contracts](2026-09-25-observability-design-review.md): PR #29 at `fd0ab9f`, APPROVE WITH NOTES; Astra relay; fixes `59b55e2` (head `e2847af`), APPROVE WITH NOTES; final `dc44543`, APPROVE.
- [CI: native mobile builds only on native inputs](2026-09-25-ci-mobile-split-review.md): PR #30 at `2f34de8`, APPROVE WITH NOTES.
- [ADR-075 accepted; first dev-evidence entries](2026-09-25-adr-075-accept-review.md): PR #33 at `544b263`, APPROVE WITH NOTES; fixes `7311cf3`, APPROVE.
