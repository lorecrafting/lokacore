# E3 authoring navigation review

Source: `6f374d06d171135f07175c52a16e0e804bca7264` against published `main` `37a2af0c3f59465f36c0ec3a1d560c5fc3845741`.

**APPROVE**, no findings.

- `Loka.Content.Source.classify/1` recognizes the six root JSON files documented in the cartridge layout and the exact one-level definition directories listed there. The table describes the recognized authoring map without claiming that arbitrary JSON files load; unrecognized paths still produce `UNKNOWN_FIELD`.
- The Builder guide accurately distinguishes ordinary NPC definitions, which `runtime/fresh.ts` places, from `spawn_template` definitions, which fresh-world placement filters out and population/death handling consumes as templates.
- The Chapter 1 briefs index link resolves to the current 33-brief index. The liquid, transport and water schema links resolve and their descriptions match the schemas and adjacent protocol entries.
- The changes update current navigation and current-source wording only; they do not rewrite historical records or imply E3 acceptance/proof.
- `mise exec -- elixir bin/check_docs.exs`: pass, 784 docs, 0 broken links, 0 unreachable files.
- Ponytail/correctness review: documentation-only change; no added machinery or complexity. The current-source claims were checked against the classifier, fresh placement path, and installed schemas.

The task supplied a source hash that does not resolve (`6f374d06d171135f36c0ec3a1d560c5fc3845741`). The branch `docs/e3-authoring-navigation` resolves to the reviewed source hash above; its base matches the supplied published-main hash.
