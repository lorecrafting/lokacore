# Pre-production CI scope (owner decision, 2026-10-06)

The owner wants fast local and hosted feedback while Chapter 1 is under active development. Select checks by the changed area, keeping a full run when the dependency is uncertain.

- Markdown other than generated `*.gen.md`, and the Beads export `.beads/issues.jsonl`, are metadata. Run docs and tracker validation; skip Elixir, TypeScript, simulator and Book browser work only after a relevant green ancestor.
- Changes confined to `mobile/` outside `mobile/authority/local-story/`, plus metadata run the Book browser check, but skip the Elixir, TypeScript kernel and headless simulator jobs after a green code ancestor. Native/mobile build checks remain paused under the existing web-first decision.
- Any other file, an empty or malformed comparison, an unknown base, or a GitHub API failure runs the broad code jobs. Contract, cartridge, kernel, content, save and checker changes remain in this lane.
- A skipped browser job must remain visibly skipped, not report a passing browser test. A later metadata-only change may skip browser work only when an ancestor actually passed the browser job.
- Local pre-push uses the same file classification. The metadata/mobile app lane runs docs and tracker guards; code changes run the full local check line. Developers still run focused checks for their changed behavior and realistic red controls before review. Hosted checks on the exact published head remain the publication gate.

This changes the check cadence in [the local provisional workflow](owner-decision-local-provisional-integration-2026-10-05.md) and [the previous docs-only CI rule](../CHECKS.md). It does not remove chapter-gate full runs or the save, protocol and trust-boundary proof required by their own briefs.

Implementation clarification (2026-10-06): the mobile exception covers app work;
`mobile/authority/local-story/` contains story authority and save code and stays in
the broad code lane under the save rule above. Browser checks still run for both
mobile app and authority changes. This does not resume paused native checks.

Amendment (owner, 2026-10-08, paraphrased): the mobile exception narrows to Book views and
assets (`*.tsx`, fonts, `.sksl`, e2e specs, plugins, `app.json`); mobile `.ts` and package files,
including Book `model.ts` and `presenter.ts` that kernel tests import, run the code lane. Local
pre-push only: a push whose code changes are only `*.test.ts` files skips `mix test` and credo.
