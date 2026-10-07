# E1 reviewed-route registration independent review

Source checkpoint: `e5a9d6958a954edfa9b3395045a0d0716533acf3` on `proof/e1-route-registration`, based on recorder `32ef7816`. Evidence checkpoint: `fa151bb55aa184f2cd09450df9a14b9ed3aa8777`.

**APPROVE** the bounded registration checkpoint, no findings. This does not certify E1; the retained report remains `pending` with 609 authored obligations open.

## Review

- The delta registers the three previously reviewed Watch, Wisp ward and infirmary herb recipes as named fresh cases. Their literal route assertions stay in the recipes; replay dispatch recognizes exactly those case IDs. Removing the old empty-obligation assertions is appropriate because the recorder now observes routes that can emit witnesses.
- The source receipt's explicit digest inventory includes `e1_watch_rounds.ts` and `e1_wisp_herbs.ts`. The retained committed-byte mutation control changes `check_hash` when a Wisp recipe byte changes; the production recipe remains untouched.
- `replayCase` reconstructs each fresh state, checks source/content/artifact identity, validates each committed decision and invariant result against the authority, verifies clock/RNG and state hashes, and checks the final command digest. `caseHost` supplies real Node SQLite commits and cold reopens. The fixed-head run retained all 16 cases and their semantic replays as passing, with exit 2 and `certification_verdict: null` as required for incomplete coverage.
- The exact report has source SHA `e5a9d695…`, check hash `3d72f5c3…`, and candidate content hash `5d8b0e3a…`. It leaves 2 quest definitions, 36 dialogues, 49 choices and 609 authored obligations pending; rooms and scene families have no gaps. The brief adds a link to the evidence and states the remaining obligation count. The architecture clause is confined to the current E1 policy section; no archived history was edited.
- Retained evidence and complete-case hash lists verify. The three newly published traces correspond to the registered case names. Evidence-path and identifier scan found no local or scratch paths or restricted device, team or provisioning identifiers.
- Independent checks on the exact head: `git diff --check` passed; focused route/recorder tests passed 10/10; `mise exec -- npm run typecheck` passed; `mise exec -- elixir bin/check_docs.exs` reported 814 docs, 0 broken links and 0 unreachable files.
- Ponytail review: minimal. The two digest inputs and three run registrations close actual coverage gaps; no new framework, dependency or abstraction was introduced.

## Limits

This approves only registration and retained replay for these routes. The selected 10,000-sequence proof, remaining authored-path receipts, final candidate review and E2/E3 browser receipts remain pending. Native mobile remains paused. E1 certification is not granted.
