# E1 selected dialogue policy witness review

Source `783faeeb659604780f216106feb589e9aee80303`; retained evidence head `04370383f68f2389c5c651f9f2aee9a366a4201e`.

**APPROVE.** No findings in this bounded binder proof. The architecture clause states the accepted-talk/root rule and scopes recursive child credit to `all`; the helper leaves `any`/`not` children uncredited. On the pinned v042 cartridge, the selected Elspeth report has an `all` root with exactly the active `first_lead` quest and held `fox_drawing` children. The test observes exactly the dialogue, root and two child paths, then semantic replay derives and retains those paths from the committed command/state receipt. Rejected talks remain excluded by the accepted-decision guard, and pending-choice detection excludes already existing choices.

The source-bound retained trace contains 13 committed steps and pins source, check and policy hashes; its summary has the exact four expected paths and reports semantic replay pass. The file-backed SQLite focused case passes. The exact test file passes 4/4; TypeScript typecheck passes; docs check is 818/0/0; diff check is clean. Retained hashes verify 8/8. The old three-test suite passes with the policy-child claims removed, while the new Elspeth test fails; the mutation is absent from the source. The evidence directory has no private paths or device/signing identifiers.

Ponytail Review: lean already; recursion is limited to the authored `all` tree and introduces no policy evaluator or dependency. This approves the bounded selected-dialogue witness only. Other dialogue branches, remaining authored obligations and E1 certification remain pending.
