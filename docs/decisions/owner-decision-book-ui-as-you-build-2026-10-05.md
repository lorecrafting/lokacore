# Owner decision: Book UI rules evolve with mechanics — 2026-10-05

Owner direction (paraphrased): keep the Book UI consistent and reusable as new
mechanics land. Update `docs/system/book-ui.md` in the same work slice whenever
the mechanic changes player interaction rules. Fix obvious navigation or UI
correctness defects immediately rather than carrying them to a later polish pass.

Each mechanic brief names the existing Book page/action pattern it uses, its
detail-local result and return route, and the browser interaction that proves it.
The developer reuses current Book components when they fit; a real new consumer
may justify the smallest new component and an amended Book rule. The component
inventory lives in [the Book component guide](../BOOK-UI-COMPONENTS.md), while
`docs/system/book-ui.md` remains the normative presentation specification.

At the Chapter 1 browser gate, compare complete journeys and make a focused
reviewed pass over visual consistency, spacing, labels, touch/keyboard access,
logs and repeated controls. That pass does not defer a broken action, misleading
result, dead-end page or incorrect return route found during an earlier slice.
Repeat a smaller consistency pass at later chapter gates. The mobile pause and
deferred blur work remain in force.
