# Owner development-save direction and sampler Look repair — 2026-10-03

Owner direction, verbatim:

> no need to save old save versions as i've never went back to play older saves yet because we are going forward with new builds at a very high velocity as we are in the building phase, so no need to save those things

This supersedes the proposed retention of the previous sampler runtime release. The
[pre-player-release policy](../archive/decisions/owner-decision-playtest-2026-09-25.md)
already permits development cartridges to change with independently rederived known
answers listed in the PR. This implementation applies that exception only to the
current unreleased sampler; it does not thaw other protocol fixtures or change save
format compatibility.

## PM implementation adoption

Inspection found that `ashmere_sampler@0.0.1` omits `description_variant@1`, the
already installed capability owning authentic engine Look. Its GameView therefore
correctly omits Look; no-target Look is rejected before a command exists. This is a
content declaration gap, not an engine or presenter defect.

- Replace the current development sampler in its existing source folder and known-answer
  fixture with `ashmere_sampler@0.0.2`, adding `description_variant: 1`.
- Independently amend the Python oracle's literal version and capability. Permitted
  artifact changes are the version, sampler reference/key versions and manifest/lock
  capability declarations. All 57 adopted story strings, eleven reused UI labels,
  numbers, geometry and authored rules remain unchanged. All nineteen older cartridge
  sources, fixtures and trace answers remain frozen.
- The existing App binding and save filename stay. Carry no duplicate source or old
  sampler runtime artifact and add no release catalog or session adapter. An existing
  old sampler pin receives the existing typed `pinned_release_missing` refusal and
  explicit Start over offer ([save contract](../system/save.md#opening-a-story)); no
  automatic deletion or migration is introduced.
- Preserve the old artifact, oracle, reviews and native proof in Git/history. They do
  not prove this new hash. Fresh source review and combined Release Simulator proof
  must establish the new artifact's authentic Look behavior.
- The simulation pool and seed inputs stay unchanged. Generator 14 records that the
  sampler's offered actions change; no seed remap is adopted.

These are PM execution choices under the owner's development direction, not additional
owner quotations. The old compatibility plan was never implemented or adopted.
