# Owner decision: no custom authoring language; JSON with shortcuts, then an AI-assisted builder — 2026-10-23

Written 2026-10-23 in Claude Code (PM design session). The owner's words are paraphrased.

Owner, 2026-10-23 (paraphrased): areas will rarely be written by hand; when they are, it will be
with LLM help or through a builder tool built on top of the engine, such as an AI-assisted visual
builder. Asked whether to build our own ACTS-style language, the owner accepted the
recommendation: no custom language for now ("yes please").

## Effect

1. No custom text authoring language or runtime script interpreter. The runtime stays
   declarative.
2. Cartridge source stays JSON, with compile-time shortcuts lowered by the Elixir compiler into
   today's cartridge: area files with inline prose, `extends` for prototypes, parameterised
   behaviours, zones, `signal` and `wait`. Protocol, save and kernel_api do not change; a
   re-expressed sampler must compile to a byte-identical artifact. YAML source stays the next
   format ([future](../system/future.md#authoring-and-certification)).
3. An AI-assisted visual builder is built on top of that source, in the reserved `Loka.Builder`
   and `LokaWeb` boundaries ([architecture](../system/architecture.md)): describe in prose, the AI
   proposes a diff, the compiler and transcript replay check it, the web Book previews it.
4. Order and gates: [design audit 2026-10-23](../rnd/design-audit-abilities-authoring-2026-10-23.md)
   §4, phases 1 to 4 before the builder (phase 8).
