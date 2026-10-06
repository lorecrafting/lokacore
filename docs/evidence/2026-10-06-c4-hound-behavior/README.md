# C4 hound response — provisional source evidence

The review-fix source head is `251b0bff4f90b7e89cf327f11effe60282791574`. It builds from the independently reviewed C4 plan and published C3 main. Its `v029` / API `1.25` / 140-ID content pin is deliberately provisional while D1 is pending. The C4 successor pin, full gate, and integrated carryover review follow D1 publication; this head is for scoped primary, save, and foundation rechecks.

Deliberate Attack admits the selected living hound and bounded same-plan, co-present helpers. The repaired cursor picks one living member per round. An injured selected hound can take one legal exit, retain its injury and slot, and leave the fixed roster. On an even round, the player still gets the scheduled opportunity against a remaining hound. A flight stamp requires the selected member's actual same-group departure and the round's due time, even when elapsed advances farther. Final admission requires the complete group; partial prefix composition remains lawful. SQLite COMMIT failure leaves the old memory and disk state, and retry saves one flight and receipt.

`review-fixes-focused.log` retains the review-fix green commands and raw outputs: kernel and app TypeScript checks, 43 focused Node tests, 8 focused Elixir tests, strict Credo with zero findings, formatting, contracts, docs, and diff whitespace. All exited zero. `SHA256SUMS` lists every retained raw log and its adjacent `SHA256SUMS.verify` records a successful verification. Paths in logs are redacted; no device or owner-save data was used.

Retained red controls each failed on a planted source mutation that was restored:

| Raw log | Distinct break caught |
| --- | --- |
| `even-flight-red.log` | Fleeing selected helper skips the player's even-round attack. |
| `helper-identity-red.log` | The primary attacks in place of the selected helper despite cursor rotation. |
| `flight-commit-red.log` | Memory adopts a flight before a failed SQLite COMMIT; recovery/retry diverges. |
| `pack-shape-ts-red.log`, `pack-shape-ex-red.log` | An opted pack opens without its required roster. |
| `selected-flight-ts-red.log`, `selected-flight-ex-red.log` | A flight stamp names an unselected member. |
| `dead-cursor-ts-red.log`, `dead-cursor-ex-red.log` | A dead cursor still wins selection over the living flier. |
| `late-endpoint-ts-red.log`, `late-endpoint-ex-red.log` | A legal flight is compared to the later elapsed endpoint instead of its round due time. |

The literal proposal fixture also refuses a healthy/no-encounter stamp, a stationary transfer, a missing same-group exit, a wrong plan/roster/cursor, and a mismatched final stamp; it accepts a legal flight when the elapsed endpoint exceeds the round due time. The corresponding TypeScript and Elixir composers and independent invariants match these literal answers. Earlier provisional mutants and a 360/361 ExUnit full-gate run were observed but their raw output was **not captured**; they are not part of the retained evidence or a passing final gate. The one failing full-gate check was the known stale compiled content pin.

Ponytail Review and correctness self-review: the fix reuses the existing encounter roster, population slot, delta composition, round resolver, and SQLite transaction path. No new dependency, compatibility adapter, or metric suppression was added. The larger fixture addition pins complete literal row combinations for both kernels. Reviewed selected-ID repair over absent/dead members, same-group departure, occurrence time, even-round opportunity, final versus prefix admission, and failed-COMMIT retry. Remaining work is independent scoped recheck and D1 successor integration/re-pin/full gate; no native build, simulator, owner save, preview, push, or PR was used.
