# E1 Maud cellar route checkpoint

Source `7e647c9cf08ba877a627f8d43c97e311794aa53d` adds a fixed fresh
v042 route through Maud's offer, five separately credited cellar rat deaths and
the original key/trust turn-in. Real SQLite commits and cold reopens preserve
each death credit, the Maud-held key until choice selection, and the final
resolved `done` quest, player-held key, trust 5 and cleared flag. Recovery between
fights uses the authored HP schedule through trusted elapsed input. No state is
written outside the authority.

The focused test ran the route twice with identical digests and replayed all
commands through `AUTHORITY_KERNEL`; one test passed. A clean-source capture
retained 55 committed commands and the exact [case trace](case.jsonl) and
[summary](summary.json). The old ten-test E1 route suite passed when a temporary
mutant omitted the fifth kill. The new test failed at Maud's turn-in with the
literal `quest_requirement` refusal. The mutant was removed; TypeScript
typecheck and docs links passed. Ponytail Review removed an unnecessary recovery
after the fifth kill; no dependency or general route framework was added.

The retained outputs verify against [SHA256SUMS](SHA256SUMS) and its
[verification log](SHA256SUMS.verify). The source route is not yet registered in
the E1 recorder and has not had an independent review. Night, authored path
obligations, the final 10,000-sequence simulator and E1 certification remain
pending.
