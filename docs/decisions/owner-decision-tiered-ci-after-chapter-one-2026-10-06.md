# Owner decision: tier checks after Chapter 1 — 2026-10-06

The owner accepted a faster check cadence **after the Chapter 1 E3 gate closes**:
run fast, relevant checks during ordinary iteration; run the comprehensive gate
for PR publication; and run long browser, device/platform and simulation sweeps
at milestone or other explicit risk triggers. Keep save mismatch refusal,
data-loss and trust-boundary validation, and required release checks.

This is a future workflow change, not an exception for active Chapter 1 work.
The [current pre-production scope](owner-decision-preproduction-ci-scope-2026-10-06.md),
the [mobile pause](owner-decision-web-first-mobile-pause-2026-10-05.md),
the headless engine simulation and all D10/E1–E3 publication gates remain in force.
Do not remove a current check or treat a skipped job as a pass under this record.

After E3, make a separate reviewed workflow/checker change that names each fast,
PR and milestone lane, its trigger and conservative fallback. Demonstrate that
the classifier sends uncertain changes and save/protocol/content changes to the
necessary checks, with a failing control for any new guard. Preserve exact-head
publication evidence and the deferred native checkpoint until its owner resumes it.
