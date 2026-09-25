# Owner decision: R5 setup practices — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

## What the PM proposed (summary)

1. **Lock agents down in R5 with lint rules** that make the right way the only way: rule
   modules only return deltas (never write state), use only their own capability's
   commands and events, and live in a fixed place such as
   `kernel/ts/src/rules/<capability>.ts` with their invariant checks beside them.
2. **An agent-drivable `loka play` CLI** over the TypeScript kernel on Node: load a
   compiled story, take typed or scripted commands, print GameView, narration, the
   canonical state hash and per-step timing; transcripts replay. It seeds the R5
   simulator, the R9 Lab and the Node-to-Hermes replay. Built in the first R5 slice.
3. **A generated, drift-checked feature map**, one row per capability (spec section,
   contracts, TypeScript module, fixtures, invariants, example transcript); a row's
   columns become required once that capability is implemented.

## Owner's words

> If you think those would all help yes please do it

Result: all three are folded into the R5 plan in [the roadmap](../ROADMAP.md).
