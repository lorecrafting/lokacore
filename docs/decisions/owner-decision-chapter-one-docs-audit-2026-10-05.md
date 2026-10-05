# Owner decision: Chapter 1 documentation audit — 2026-10-05

Owner direction (paraphrased): schedule an Astra audit like the earlier documentation
audit so the project's current guidance is congruent, lean, navigable and free of
stale or corrupted material before Chapter 1 closes.

After the A–D Chapter 1 source slices and their reviews are integrated, and before
E3's final browser-content gate, run one Astra high documentation audit over the
active repository guidance: `AGENTS.md`, handoff entry points, roadmap and
completion plan, current `docs/system/`, protocol documentation, active briefs,
builder guidance and lessons. Compare claims to the implemented candidate and
its exact evidence. Identify contradictions, duplicated sources of truth, stale
WIP/status, broken navigation and active guidance that belongs in the archive.

The audit produces a findings list with exact document locations and a concrete
disposition for each. Fix current guidance in one or more focused docs work units,
with a fresh independent review and normal checks before the E3 gate closes.
Move obsolete guidance to `docs/archive/` only after checking inbound links and
replacing active references. Preserve decision, review and audit history; do not
rewrite it to make old claims look current. This is a one-time Chapter 1 closure
audit, not a per-slice or recurring gate. It supplements the existing slim code
audit and docs tidy pass without asserting that implementation proof has passed.
