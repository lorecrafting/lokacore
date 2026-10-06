# D3 Western Ashmere — independent predecessor re-pin review

Reviewed planning head: `fc2a3e9d5afd96dd1bc7951f99741c2d58de19a0`, parent
`309c5623`, against published base `815f66f9039ca22f80d44112a1ff966eadb8381e`.
Verdict: **APPROVE**. No findings. This scoped review covers only the three
changed paragraphs in the [brief](../briefs/chapter-one/d3-western-ashmere-brief-2026-10-05.md)
at lines 3, 13 and 33; the [original independent plan approval](2026-10-06-d3-western-ashmere-plan-review.md)
remains distinct. It permits provisional source assignment, not implementation approval.

Requirements: the predecessor must be actually published and its manifest, canonical
hash and allocation fixture must support the stated pins; D3 must retain the
[D1 ferry declarations](../system/cartridge.md#d1-ferry-and-isle-declarations)
and mainland return edge; final successor pins and source proof must wait for shared
predecessor integration. Active clauses must precede source implementation under
[AGENTS.md](../../AGENTS.md) and the [delivery workflow](../WORKFLOW.md).

- [PR #231](https://github.com/lorecrafting/lokacore/pull/231) is merged; its merge
  `c20addb09431f1ab75b56402d422cc9a29cb8360` is an ancestor of the stated base.
  At that base, the source manifest and v030 fixture both declare chapter 0.0.30
  and minimum kernel API1.26. Independently sorting and encoding the fixture value
  reproduces its canonical bytes and SHA-256
  `dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9`.
  The v030 ID fixture contains 149 distinct starting IDs. Source and protocol files
  are unchanged between the published base and reviewed planning head.
- Actual chapter `boathouse.json` has exactly an east exit to `ferry_landing`
  and one `ferry` detail bound to `fen_outbound`; that endpoint goes to
  `fen_isle_landing`. Lines 3 and 13 preserve these declarations while adding the
  selected south connection, so source assignment does not substitute a free
  island compass route or remove the mainland return.
- Lines 3 and 33 allow provisional development from D1, require incorporation of
  the earlier D4/C4 source merges before final proof, and retain null D3
  source/release/API/hash/ID/PR answers. They require active cartridge/Book clauses
  before code and preserve the source-unbuilt status. There is no premature final
  pin, completed proof or source approval.

Ponytail Review and correctness pass: lean already; the re-pin adds no framework,
dependency, writer or test machinery. No open items.

Verification: `git diff --check fc2a3e9d^ fc2a3e9d` and
`mise exec -- elixir bin/check_docs.exs` pass (646 docs, zero broken links or
unreachable documents). The review-record commit runs the normal documentation
hook. Docs-only review: no source tests or mutations required. No preview, device,
simulator or owner-save operation was performed.
