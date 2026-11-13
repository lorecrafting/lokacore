# Review: W3 lines sheet

Written 2026-11-13 18:40 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017 (role reviewer)

Verdict: **APPROVE WITH NOTES** — `bin/loka lines` prints key, words, speaker/owning node, source
file:line, gate sentence, `~` flag and byte length for every compiled text key, JSON and `--csv`;
the six tests plant a gated and an ungated line plus a lowered `.scene` key, and each header names
a break that fails. Checked on the showcase: 1734 rows, all unique and located; 153 gated with real
sentences; the `~` flag agrees with `bin/loka todo` on diku_sampler, ambient_emote_sampler and
water_sampler (37/37, 18/18, 23/23); breaking the `~` rule fails a test.

Notes (no blockers):
1. `lines.ts:index()` (`said`, `kernel/ts/play/lines.ts:104-109`): when two `.scene`/`.cut` files
   share a line's first words, the alphabetically earlier file wins and the row reports a
   plausible but wrong `file:line`, exit 0 — silent, and untested. A key with no matching prose
   line is likewise a silent `''` rather than a diagnostic.
2. `lines.ts:owners()` first-wins is stable for one artifact (same JSON key order) but which owner
   wins is fixed by the artifact's map order, not by a rule; recompiling after a section grows can
   change the speaker/gate pick with no test pinning the expectation. The choice-`policy`-before-
   dialogue-`policy` precedence in the comment is untested (no test choice carries its own policy).
3. `written()` (`lines.ts:38-45`) re-implements `todo.ts:75`'s `words` with the same rule (drop
   lines trimming to `~`, split `/\s+/`, drop empties); the two agree today but can drift.
4. `lines.test.ts:CSV` asserts `sheet.length === rows.length + 2`, an expectation taken from
   `lines()`'s own output; the independent count (16 keys) is never pinned.
