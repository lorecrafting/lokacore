# E1 selected knowledge effect witnesses — author checkpoint

Source: `0e07767c3e39ead7e357586c917d180d79b9b7e6`, based on
`24e752bec256ce45300aeefaa0aa7f27cd4eee58`. Governing clause:
[E1 exact candidate proof policy](../../system/architecture.md#e1-exact-candidate-proof-policy).
The bundled v042 artifact and current authority are unchanged.

The two real SQLite tests exercise the legal Swim lesson and Wisp riddle routes,
cold reopen their saves, and replay their committed commands. Independent expected
answers are false → true for `skill_swim` and `topic_ward_known`, credited once at:

- `/dialogues/ashmere_missing_child@0.0.42:dialogue/sedge_swim/choices/learn/sequence/0`
- `/dialogues/ashmere_missing_child@0.0.42:dialogue/b_wisp_riddle/choices/answer/sequence/1`

Unresolved or unselected choices, unchanged facts, missing receipt events and
mismatched fact/actor/world/scope/cause/correlation receive no new effect credit.
Removing the explicit path from the retained step keeps it pending in replay.
Unit replay uses synthetic source identity fields; these logs are author checks,
not an exact-source scenario certificate.

## Checks and controls

All commands used `mise exec --` with the pinned toolchain. Old focused suites:
`node --test kernel/ts/test/e1_cases.test.ts kernel/ts/test/e1_obligations.test.ts`.
New suite: `node --test kernel/ts/test/e1_knowledge_effects.test.ts`.

| Run | Result |
| --- | --- |
| Remove new binding: [mutant](missing-binding.diff), [old suites](missing-binding-old.log), [new suite](missing-binding-new.log) | old 12 pass / exit 0; new 2 fail / exit 1 |
| Bypass receipt validation: [mutant](missing-receipt.diff), [old suites](missing-receipt-old.log), [new suite](missing-receipt-new.log) | old 12 pass / exit 0; new 2 fail / exit 1 |
| [Restored focused suites](restored.log) | 14 pass / exit 0 |
| `npm run typecheck --prefix kernel/ts` | [exit 0](typecheck.log) |
| `node bin/check_ts_size.mjs` with the five affected/host test paths | [exit 0](size.log); host remains 325 lines |
| `elixir bin/check_docs.exs` | [exit 0](docs.log) |

Ponytail Review: lean already; existing fact, skill and reference helpers reused,
no dependency or runtime changes. Correctness self-review checked selected
continuations, exact effects and receipt linkage; no open author findings.

**E1 remains pending.** No full recorder, complete candidate run, browser/native
receipt, final gate, push or independent review is claimed. `lantern_room`, skill
and topic definition obligations and other authored paths remain pending. The PM
will integrate this source and capture the full recorder on its combined source.
Raw logs are redacted and covered by [SHA256SUMS](SHA256SUMS), with
[verification](SHA256SUMS.verify).

## Independent review correction

[E1-K1 facts-only negative inputs and red control](round1/README.md) correct the original membership guard test gap; independent scoped recheck is required.
