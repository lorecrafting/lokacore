# Independent review: local Book web preview (PR #194)

- Reviewed commit: `6a878fa28b833494828ddd7851877fe90d228e27`
- Verdict: **CHANGES REQUIRED**

## Requirements

The preview must run the actual App, Book, bundled Missing Child chapter and local Story authority in a browser, with a current-build OPFS save surviving reload and tab reopen. A damaged or mismatched save retains the existing refusal and confirmed Start over path. Browser startup may await SQLite's first open, while synchronous authority decisions remain on one connection. Fast Refresh should show Book edits and retain an open session; changed rules require reload. The proxy must stay local, supply isolation headers, and release its ports. The owner has paused native builds, simulators and native verification, while allowing this separate browser slice.

## Evidence

At the exact reviewed head, `npm ci` and app `tsc --noEmit` passed. In a fresh, isolated headless Chromium profile against the preview process at that same head, the Book opened, accepted Elspeth's search, and showed the committed result after reload and a closed/reopened tab; there were no page errors. The existing process was left running and its browser save was untouched. Both proxy ports listened on loopback, and the page response carried COOP and COEP headers. `git diff --check` passed. The focused `mobile/app` test run had 381 pass, one skip and four fail as below. No native session ran. A separate web worker mutation was not useful while the focused suite was already red; the worker's old one-byte write and the corrected four-byte write are visible at the exact guarded source, and the install guard was exercised by a second install.

## Findings

- **R194-1, should-fix — `mobile/app/chapter.test.ts:250`:** The controlled React Native host for the actual App has no `Platform` export. The new module-level `Platform.OS` read in `mobile/app/App.tsx:68` throws before the four existing chapter/elapsed App tests can exercise their save and wakeup assertions. `mise exec -- npm test` fails 4 of 386 tests at this head. Supply the host's platform value and rerun those behavior checks; this review cannot certify those paths while they are skipped by a setup exception.
- **R194-2, should-fix — `mobile/app/patch-sqlite-web.cjs:12`:** The source guard rejects its own successful patch on a later `npm install` in the same checkout. After `npm ci` passed and patched the worker, an immediate ordinary `npm install --no-audit --no-fund` exited 1 with “Review the SQLite web length write upstream.” This prevents normal dependency updates or repeated install commands until `node_modules` is deleted. Accept exactly the known patched form as an idempotent success while continuing to reject an unknown version/source.

Ponytail Review: **Lean already. Ship.** No unnecessary abstraction or dependency found; the two findings concern correctness and workflow, not excess code.
