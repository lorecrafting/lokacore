# M12-B headless validation

Developer-observed summary: [validation.json](validation.json). No device, Simulator or
owner-save operation was performed. This records summarized results rather than raw tool
output. The chapter hash and detail IDs come from the independent
[Python derivation](../../../test/loka/cartridge_missing_child_hash.py), checked against
the compiler and bundled loader; older release fixtures remain unchanged.

## Contract controls

The shared [literal shape cases](../../../protocol/fixtures/notice_board_contracts.json)
run through both validators. A scripted sweep removed each new `required` entry and each
new array bound individually in an in-memory copy of the contract definitions. All 19
mutants were caught independently by TypeScript and Elixir. The summary identifies every
removed constraint. Closed shapes and malformed IDs also have explicit fixture cases.

## Behavioral red controls

Each source mutant ran in an isolated worktree, then was restored. TypeScript controls used
the real loader, Book/presenter and SQLite authority; Elixir used `mix test --force`.
Exit 0 means the older controls missed the specific new behavior. Exit 1 (Node) or 2
(ExUnit) means an assertion failed. The cold-recovery mutant already fails the adapted
existing recovery test, so that test was reused rather than duplicated.

| Mutation | Older exit | Affected exit | Regression caught |
| --- | ---: | ---: | --- |
| `back-pop` | 0 | 1 | A child returns to World instead of its board. |
| `prune-new-route` | 0 | 1 | A notice route survives a real room change. |
| `child-target` | 0 | 1 | A child invokes Read against the board ID. |
| `unconfirmed-body` | 0 | 1 | A lost acknowledgement exposes an unconfirmed body. |
| `prefer-blocked-offer` | 0 | 1 | A blocked default masks an available authored alias. |
| `loader-membership` | 0 | 1 | The loader accepts an invalid sibling reference. |
| `compiler-membership` | 0 | 2 | The compiler accepts an invalid sibling reference. |
| `read-target-guard` | 0 | 1 | Cold recovery accepts a malformed stored Read target. |
| `cold-recovery-routing` | 1 | 1 | A restored Read body enters World rather than its notice. |

The actual Book flow additionally checks noun titles, immediate confirmed bodies, no
second Read control, Landing Leave, ordered board children, empty-log omission, exact
targets, navigation receipt counts and elapsed redraw. Existing canonical Read checks
retain stale, scene/combat admission and replay coverage. Separate lost-acknowledgement
and cold-reopen assertions prove one receipt and no duplicated message.

## Self-review

Ponytail Review removed duplicate board-title validation and a redundant board-reference
predicate: boards cannot also be readable, so the ordinary-readable membership guard
already rejects them. No new dependency or navigation authority was added.

Correctness review fixed selection of an available alias and refusal of malformed stored
Read targets. Receipt recovery reads the existing command column; it changes no save
writer, schema, proposal or portable foundation. No unresolved self-review finding.

`mise exec -- bin/check_all.sh` passed with exit 0, including both kernels, mobile
typechecking/tests and the repository's planted controls. The normal pre-push result is
recorded in the PR; independent review is required before merge.

## Fix round 1

The independent review found that cold recovery restored notice history without a visible
Book route. A new real-SQLite Book test closes and reopens both Landing and a board child,
continues past the chapter title, and requires the body once, the exact notice route, its
Leave or Back to board control, and unchanged complete receipt rows. Before the fix, the
cold-reopen test failed; the older Book controls still passed. The fix derives local pages
from already restored detail history and pops only the chapter page on Continue.

A second controlled test stores invalid JSON (`{broken`) in the existing Read command
column. Before the fix, opening lacked the typed corruption refusal. It now requires
`save_corrupt`, offered Start over, and repair using the same SQLite handle with an unrelated
table intact. The same controlled test proves a 0.0.3 pin remains `pinned_release_missing`
with unchanged pin bytes until explicit Start over to the unchanged 0.0.4 release. Existing
lock/I/O refusal tests remain in the focused run. The new tests and updated return-label
assertion produced three failures before the fixes; the 30-test focused run then passed.

Three isolated source red controls each failed only the intended new regression test:
removing restored notice pages, making chapter Continue clear those pages, and removing
JSON `SyntaxError` classification. All source mutations were restored. The full
`mise exec -- bin/check_all.sh` passed again with exit 0 for this fix round.

Ponytail/correctness recheck: reuse the existing histories, metadata and page stack; classify
the standard JSON `SyntaxError` at the existing session refusal boundary. No parser wrapper,
persisted route, save writer, content-pin change or native change was added.
