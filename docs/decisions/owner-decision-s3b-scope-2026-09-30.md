# Owner decision: R6 S3b builds only installed bundled releases and typed refusals — 2026-09-30

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No
checker can verify it against the chat.

Question: [R6 S3b](../ROADMAP.md#proposed-r6-slices) was planned as full local package
management: release garbage collection, migration staging with a pre-migration recovery copy,
and checks for active downloads and pending validated restores
([10 §§16, 31–32](../spec/10-mobile-commerce-release.md#16-local-package-management);
[OFF-11, OFF-12](../spec/15-acceptance-scenarios.md#b-offline-lifecycle)). Under
[PREP-03](owner-decision-prep-03-2026-09-24.md) the app bundles one chapter and downloads
nothing, so most of that has no consumer yet. What lands now?

PM recommendation: build only what is real now.

- (a) The app may carry several bundled releases. An app update that adds a newer one still
  reopens a save on the release it is pinned to (OFF-11).
- (b) A save whose pinned release is not installed, or whose save format is unknown or too
  new, gets a typed result (`pinned_release_missing`, `unsupported_save_format`). The save is
  untouched and never half-loaded.

Owner (paraphrased): yes, approved the recommendation.

Carried until the first content update or downloadable story needs them:

- release deletion and garbage collection (10 §16);
- migration staging and the pre-migration recovery copy (10 §§31–32 "Save schema migration");
- active downloads and pending validated restores as garbage-collection roots (10 §16).

OFF-12 ("deleting a release a save needs is blocked") becomes a release-process obligation
until then: an app update may not drop a bundled release that a shipped save may pin unless it
ships a tested migration for it (10 §32, rows "Breaking capability version" and "Missing
required package"). The app has no deletion path, so nothing in code can pass or fail OFF-12
yet; the R6 gate reports it as carried.
