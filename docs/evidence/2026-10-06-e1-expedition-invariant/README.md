# C6 expedition invariant correction — E1 pending

Published-main baseline `f2cb3d103caac4e4c74441df75cf3b7834b11312`; code
source `3b14592d96347d157234b981109f63b30109ee3a`. The governing contract is
[C6 S27](../../system/mechanics.md#c6-s27-night-in-the-marsh-selected-contract).
The E1 proof route found that a legal `expedition.transition` Start committed and
reopened through the real authority, while the headless invariant checker read
`state.clock` as its prior row and reported `delta_preconditions_hold`.

The checker now compares the operation's `expected` attempt with the actual
`state.expeditions` row. Composition retains lifecycle validation, and the
simulator's adopted-state check retains final-row validation. No story rule,
save format, cartridge byte or owner save changed.

The focused test on the unchanged checker exited 1 at the legal Start. With the
correction, the [five-test simulator/C6 suite](focused-suite.log) passed. A deliberate bypass of the
expedition check made the new false-prior assertion fail (exit 1); its
[retained output](skip-check-mutant.log) proves the guard is sensitive. The
[restored single-test run](focused.log) exited 0. The full local
[`bin/check_all.sh` run](full-gate.log) on the clean code source exited 0;
its retained output includes the 402 ExUnit tests and TypeScript checks.
All retained raw outputs are redacted and [hash verified](hashes.verify).

Ponytail self-review: two bindings reuse the existing delta checker and its
sequential target tracking; no new checker module or test scaffold. Correctness
self-review checked missing initial row, repeated transitions, false prior,
composition fault and final adoption. The fresh independent review, normal
push, exact-head CI and E1 recertification remain pending. E1 still has 647
authored paths to bind; this correction does not grant any path credit.
