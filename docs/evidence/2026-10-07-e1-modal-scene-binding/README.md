# E1 modal scene acknowledgement binding

Source change `5304ca16` binds the current v042 modal scene definition and
narrated step only when the displayed line receives an accepted Continue. The
last accepted acknowledgement also binds the structural `await_ack` and `end`
steps when the scene closes. A scene merely shown after a recipe or reaction
does not earn a witness; presentation-only dream branches remain separate.
The source was merged with the current recorder at clean `77733cfed72b254f8650c653541ba1d29046ef7d` before capture.

The new real SQLite focused case checked the three Bell Rung acknowledgements:
first Continue earned the scene and step 0, second earned step 1, and closing
Continue earned steps 2–4. Semantic replay confirmed the same exact paths.
Prematurely crediting the scene on display passed the three older focused tests
and failed the new one; the mutation was removed. The merged focused E1 suite
passed 16/16, TypeScript typecheck passed, and docs links passed.

The clean-head recorder exited 2 as required for incomplete E1 coverage. All
16 real SQLite cases and semantic replays passed. Its modal binding discharged
41 exact scene paths, leaving ten presentation-only dream paths and 568 total
authored obligations pending. The [report](report.json) names every gap; the
five ending traces retain the modal acknowledgements. The complete isolated
case output was verified against [case-SHA256SUMS](case-SHA256SUMS) with
[verification](case-SHA256SUMS.verify). Retained files and redacted command
outputs verify against [SHA256SUMS](SHA256SUMS) and its [check](SHA256SUMS.verify).

The actual diff's Ponytail Review found no new framework or dependency; the
simple Continue branch reuses the Book's shown scene and existing replay.
This is a bounded binder checkpoint. Night, Maud registration, the remaining
authored paths, final 10,000 simulator sequences and E1 review remain pending.
