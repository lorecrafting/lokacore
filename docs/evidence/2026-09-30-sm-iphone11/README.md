# R6 SM phone smoke screen on the iPhone 11, 2026-09-30

Result: the smoke screen ran on the iPhone 11 and kept its save across an app kill and relaunch,
as the owner reported. This is **not** R6P gate evidence ([roadmap R6 SM](../../ROADMAP.md#proposed-r6-slices),
[owner decision](../../decisions/owner-decision-r6-smoke-2026-09-30.md)). No raw files were kept.

Facts, by source:
- **Owner-reported (paraphrased):** the owner ran the tap script. Everything looked as described;
  they tapped take and go north, closed the app and reopened it, and it kept the position and the
  satchel; go south then returned to Ferry Landing.
- **Inspected (build and launch):** a Release (Hermes) build of PR #70 at `865755d` with the real
  app code (no dev wiring), free personal team, automatic signing, installed with `devicectl`; the
  phone was unlocked (`passcodeRequired: false`); the app launched and its process was still alive
  after 10 s. The phone reported iOS 26.6.2 in the device listing.
- **Inspected (save, before the owner's run):** `Documents/SQLite/loka-save.db` copied from the app
  container had `head.revision` 0 and 5 `state_row` rows, so expo-sqlite opened and `openStory`
  saved the fresh world on the device.
- **Not checked:** the screen was not captured by me; I could not tap it. The database after the
  owner's run was not copied, so the persisted revision after their moves is not recorded here.
  No red control was run on the device. The app-container, device and team identifiers are withheld.
