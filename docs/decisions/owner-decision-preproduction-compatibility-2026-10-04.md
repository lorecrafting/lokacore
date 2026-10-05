# Owner decision: pre-production compatibility, 2026-10-04

Owner direction, verbatim:

> are we doing api version compatibility? Please dont if so because we are not even in production yet.

> Actually we need a general note for all LLMs that work on this project to dont worry about api backward compatibility for now since we are not in production yet and we want to speed up development

Pre-production development need not preserve backward API, release or save compatibility,
or add adapters or migrations for older development versions. Advance the current bundled
release and independently re-pin its known answers. Preserve frozen conformance fixtures,
current-release save integrity, exact release-pin refusal and explicit recovery; never silently
delete or retarget a save. The owner's save remains untouched.

This broadens the [earlier development-save direction](owner-decision-sampler-development-look-2026-10-03.md)
and supersedes M20-B1's per-feature API1.7 gate and compatibility test requirement in the
[PM adoption](pm-decision-m20-b1-reward-storage-2026-10-04.md).

PM scope: remove only B1's receive/fact.adjust/Put minimum-version detector and its focused
compatibility tests. Preserve existing generic manifest range/schema validation and exact
release-pin refusal. B1's controlled fixture and B2's production release still declare current
API1.7. Existing frozen fixtures and unrelated historical validators are not deleted here.
Review finding M20B1-R1 is superseded by this policy/spec change; broad contract re-review is required.
