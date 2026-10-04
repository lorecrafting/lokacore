# Owner decision: TypeScript kernel layout (2026-10-03)

Owner messages, verbatim:

> I like your file reorganization.  Can we just do it while we polish the ui? that way if ui breaks and its due to the new reorganization we can also fix it.  Also what do you mean by a plugin architecture? Will that be easier for an LLM to create mechanic 'plugins'? And would that clearly define boundaries better, which can be enforced deterministically?

> Okay yes go with your plan and restructure the kernel stuff as long as it makes for longterm stability, extensibility and maintainbility and more correctness etc

PM adoption: mechanically group the existing TypeScript kernel into foundation, runtime,
content, mechanics, commands and view, with each mechanic's rule and shared lifecycle or
queries together. The authoritative layout and its existing couplings are in
[architecture.md](../system/architecture.md#typescript-kernel).

Preserve public exports, generated contract paths, the pure Rule ABI, capability ownership,
admission and invariants, structural sharing, host save boundaries, frozen fixtures and
simulator answers. Retarget the existing deterministic guards and prove their planted controls
at the new paths; use the same lint framework for the foundation import boundary. UI polish
runs independently with the renderer files outside this slice. No mechanic or runtime loading
framework is added by this reorganization.

PM closes the already triggered red-control existing-file safety carry in the same slice:
preflight occupied paths, create plants exclusively and preserve local bytes on refusal.
The [regression test](../../test/loka/red_controls_test.exs) exercises the actual script.
