# Code search

Detail for [AGENTS.md, Searching code](../../AGENTS.md#searching-code-use-precise-tools-first).

## TypeScript

The `LSP` tool comes from the `typescript-lsp@claude-plugins-official` plugin, enabled in
[`.claude/settings.json`](../../.claude/settings.json). It needs two global installs:
`npm install -g typescript-language-server typescript@6.0.3` (the version `kernel/ts` pins). TypeScript 7 ships
no `tsserver`, so with only TS 7 installed the server fails with "Could not find a valid TypeScript installation".
It runs in terminal sessions only, not cloud sessions. Without it (cloud, missing installs), use
`ast-grep --lang tsx -p 'name($$$A)'` for call sites (`sgconfig.yml` parses `.ts` as `tsx`, so `--lang typescript` finds nothing), or plain text search on the symbol name in a read-only agent.

- `incomingCalls` (callers), `goToDefinition`, `hover`, `workspaceSymbol` and `documentSymbol` work at once.
- `findReferences` can return only the queried file until the project has loaded. Run `incomingCalls`
  first, or repeat the query, before trusting a one-file answer.

## Generated answers

`bin/regen.sh` rewrites these from their inputs, and the pre-push check and CI fail on a stale one, so they
match the checked-out tree. Query the large ones (`system-graph.gen.json` is about 580 KB) with `jq` (JSON)
or text search plus a heading range (Markdown); never read them whole.

| File | Answers |
|---|---|
| [system-graph.gen.json](../system-graph.gen.json) | `capabilities`: each capability's commands, events, definitions, policies and residency. `nodes`: every protocol type with its file and line. `edges`: which type refers to which. `files`, `layers`, `saveTables`. |
| [contracts.gen.md](../contracts.gen.md) | The protocol contracts, from `protocol/`. |
| [features.gen.md](../features.gen.md) | Whether each capability is implemented, and where. |
| [TOOLBOX.gen.md](../TOOLBOX.gen.md), [toolbox.gen.json](../toolbox.gen.json) | The builder's toolbox, before requesting a mechanic; the JSON has each row's `id`, `section`, `state`, `status` and `depends`. |
| [checks.gen.json](../checks.gen.json) | Each named check and its rule. |
| [residency.gen.json](../residency.gen.json) | Which capabilities sit in which residency class. |
| [state-sections.gen.json](../state-sections.gen.json) | The state sections each kind and op touches. |
| [source kinds](../reference/source-kinds.gen.md), [vocabulary](../reference/vocabulary.gen.md) | Authoring source kinds and steps, from `schemas/source/`. |

Examples:

```sh
jq '.capabilities[] | select(.commands | index("unlock")) | .id' docs/system-graph.gen.json
jq '.nodes[] | select(.name == "AccountId") | {file, line}' docs/system-graph.gen.json
jq '[.edges[] | select(.to == "AccountId") | .from] | unique' docs/system-graph.gen.json
```
