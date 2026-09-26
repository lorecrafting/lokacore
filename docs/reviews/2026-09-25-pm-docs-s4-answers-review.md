# Review: S4 owner answers, touch-link ruling, #38-#40 ledger (PR #41)

PR #41 (docs only), commit reviewed `943c44a`. Reviewer: Opus, fresh. Mutation testing
skipped (docs only). Owner quotes are unverifiable by design.

**Verdict: APPROVE WITH NOTES.**

## What must be true

1. The Q2 summary matches how fact@1, `fact.assign`, `admit()` and `unowned_event` work
   today, and host synthesis of `fact_changed` fits the event model (03 §7; 04 §5.2, §8).
2. The Q3 ruling fits the text and view contracts: `Text` is `{key, bindings}` with display
   strings in a one-locale `TextCatalog` (`protocol/text.schema.json`); GameView has no
   details (`docs/design/room-view/README.md` need #6); 00 §4.10 makes entities and details
   tappable "inline and as cards below".
3. Any compile rule it announces can be checked statically and accepts the existing S2/S3
   cartridges, or says what it changes.
4. The ROADMAP, the decisions index and the record say the same thing.
5. The seven ledger lines pass the dev-evidence check and match the PRs.

## Checks run

`mix test test/loka/core/registries_test.exs` (the dev-evidence check: canonical, schema-valid,
unique `agent.work` lines): 16 passed. `elixir bin/check_docs.exs`: 120 docs, 0 broken links.
`elixir bin/check_size.exs`: clean. PR CI: elixir, lint, typescript green. The seven lines
match the brief (#38 pm opus unknown, reviewer opus 112532; #39 pm opus unknown, reviewer
opus 128942; #40 pm opus unknown, developer opus 684814, reviewer fable 410353) and the
existing format. The `.;` removal in `docs/reviews/README.md` is correct.

Q2 is accurate as far as it goes: `CAPABILITY_OWNERS.event.fact_changed` is `fact@1`, fact@1
owns no command, and `admit()` (`kernel/ts/src/world.ts:159-165`) faults `unowned_event` for
any event the admitting capability does not own, so a take rule emitting it would fault.
Brief mode matches 00 §4.10 Settings ("brief prose").

## Findings

1. **should-fix**, `docs/decisions/owner-decisions-r5-s4-2026-09-25.md:36-37`. "synthesizes
   `fact_changed` from the composed fact changes" reads as after composition. 04 §5.2 steps 4-6
   put each emitted event in the FIFO queue at its causal position so subscribers run in the
   same decision, and 00a's reactions (`bell_floods_fen`, `mother_reacts`, ...) subscribe to
   `fact_changed`. Scenario: an S4 developer builds synthesis at step 7 from the composed
   delta; the bell rule sets `chapel.bell_rung` and the fen does not flood in that decision,
   or the event gets a position after everything else. Say the host appends `fact_changed`
   to the queue when each `fact.assign` executes (step 4/5), with that op's position. Also say
   whether an assign whose value equals `expected` emits one (03 §7: "Changing a fact").
2. **should-fix**, same file `:67-69`. "GameView carries the linked spans with the target ids
   the client already has" conflicts with the contracts. `Text` is `{key, bindings}` with
   `additionalProperties: false` and the display string lives in the catalog
   (`cartridges/ashmere_details/text.json`), so the markup the ruling describes sits in catalog
   strings, and spans over a key are locale-dependent offsets the server should not compute.
   And the client has no ids for details: GameView lists none (room-view need #6: "none").
   Scenario: the S4 developer adds a spans field to a frozen R3 contract, or ships links to
   `mooring_post` the client cannot turn into an invocation. Say: the link markup lives in the
   catalog string; GameView gains the targetable details (need #6) so the client can map a
   link target to an id; name that as a GameView contract change in S4, or defer the GameView
   side to GameView v2 (R6P, which already takes the needs table) and have S4 build only the
   compiler checks and markup stripping in `loka play`.
3. **should-fix**, same file `:66-67`. "a visible item or inspectable detail that has no link
   anywhere in the text the player sees" is not static and rejects today's content. Scenarios:
   (a) `ferry_landing`'s description mentions only the mooring post, so its `notice` and
   `tide_marks` details have no possible link and `ashmere_details` (and its frozen hash
   fixture `cartridge_details_hash.json`) stops compiling; (b) `reed_path` links `mud` in the
   base description but not in the `flooded` variant: "anywhere" passes, yet the mud is
   untappable once the bell rings. State the rule per text: each description variant of a
   room links every detail of that room (hidden or undiscovered details exempt), and each
   room-line variant of an item links the item; say S4 updates the S2/S3 cartridges and
   fixtures. Alternatively make it a warning, since 00 §4.10 also lists details as cards
   below the prose.
4. **nit**, same file `:64`. `Checks.expand/2` rewrites policy-node refs and exit `to` into
   DefinitionRefs (`lib/loka/content/checks.ex:59-70`); a detail key is room-local, not a
   DefinitionRef, and a target inside a catalog string is not walked. Say the compiler
   resolves a target against the room's details or the cartridge's items.
5. **nit**, `docs/ROADMAP.md:50` and `docs/decisions/README.md:59`. The ruling says "S4 builds
   it", but the S4 entry and the index line do not mention touch links. S4 and S7 both grow
   while the R5 row stays at 7 + 1; a word on whether the estimate holds would help (question).
6. **nit**, same record `:69`. "The link syntax name is `touch link`" reads oddly; "These are
   called touch links" is enough.
