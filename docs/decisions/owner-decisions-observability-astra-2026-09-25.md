# Owner decisions: observability design slice, Astra scope — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

## 1. Observability as a first-class design slice between R4 and R5

The owner asked:

> Also i do have a general concern about observability and errors and stuff now that you mentioned making a new error state.  I wanted all our tooling and the game itself and stuff to have extremely good observability so that eventually LLMs can use that information to self improve.  Do we have that in place or a plan for that or should we defer that to another ticket?  This stuff should be a first class citizen since we are in the age of LLMs and self repair and self improvement will be enabled upon that foundation.  They should all be piped to a universal plane to be easy to observe everything if it makes sense.  maybe sometimes it wont since we have disparate systems.  Like developing tools, ai builder, the actual mobile app, the server etc.  How many disparate systems do we have where it would make sense to have different log buckets? Or does it make sense to have one giant bucket?

> also anythign we can learn from Foundry's observabiity/telemetry?

What the PM proposed (summary): spec 11 §11–15, 08 §6 and 09 already plan structured logs,
telemetry, tracing and a separate game trace store, but nothing is built and server
observability sits in R14. Five systems now (dev tooling and CI; compiler, Builder and
Lab; the rules kernel; the mobile host; the server from R14), commerce later. One shared
record format and event-name registry, a few stores by purpose (game traces, diagnostics,
operations, dev evidence) joined by shared ids (cartridge hash, kernel version, seed,
command id), not one bucket. Lessons from Foundry (`~/dev/foundry/docs/OBSERVABILITY.md`,
`REPAIR-PLAN.md` FR-18): its early telemetry drifted from its validators and was deleted;
so every producer is validated against its schema in CI; observation is never authority
(fixes are proven by deterministic replay); unknown is not zero and unavailable is not
empty; self-improvement needs an evaluator outside the candidate; measure accepted outcomes,
not tokens; export (OpenTelemetry) and cross-store search come after the records are right.
One docs/contract slice between R4 and R5, so `loka play` and the simulator emit the format
from their first slice.

Corrections to that summary (PR #28 review): Foundry's early telemetry was deleted with
its daemon stack in the clean-room batch A1; its producer/validator drift is a separate
FR-18B finding. Foundry keeps token usage as a required measure and ties it to accepted
outcomes; it does not measure outcomes instead of tokens. The game trace records decisions,
including rejected ones and failed commits, not only committed state.

The owner answered:

> yes add the observability design piece between R4 and R5

## 2. Astra cross-vendor reviews only for foundational pieces

> also only use astra reviews for important PRs or important work,  no need for things that we are generally sure an opus or fable review can handle, maybe astra extra reviews for foundational super critical pieces that other things down line depend on, or something.  I leave it up to you

Applied in [the workflow](../WORKFLOW.md): the PM sends Astra only foundational freezes
that later work builds on.
