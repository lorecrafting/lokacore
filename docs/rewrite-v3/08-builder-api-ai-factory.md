# 08 — Builder API and AI Factory

## 1. Core decision

The canonical authoring surface is a **typed Builder API**.

MCP, terminal, CLI, CI, admin visualizations, Astra, Foundry, and other models are clients of that API.

No adapter owns separate mutation semantics.

```text
                       Builder API
             /             |             \
          MCP           Terminal          CLI/CI
       AI agents          human          automation
```

## 2. Builder targets: story, realm, promote

The Builder API has explicit build targets. An author/model does not work in an ambiguous “generic Loka world” mode.

### `story`

For Loka Stories.

Constraints:

- cartridge must compile against portable capabilities only;
- offline save/campaign semantics required;
- no realm/global service assumptions;
- default quest scope is player/campaign;
- certification profile is offline-first;
- economy/power remains local to the story/campaign lineage.

Typical command:

```text
workspace.create target=story cartridge=fox_spirit_of_yunmeng
```

### `realm`

For Loka Online native multiplayer content.

Allows:

- server-only capabilities;
- party/instance/realm scopes;
- persistent online economy;
- social/presence/guild dependencies;
- zone/shard deployment metadata;
- concurrency/abuse/load requirements.

Realm mode is not required to remain offline-portable.

### `promote`

For adapting an existing portable story cartridge into Loka Online.

The workflow starts from an immutable certified cartridge and creates a new online deployment/adaptation workspace.

It must explicitly resolve:

- player/party/realm state scopes;
- shared NPC multiplicity;
- death/respawn;
- loot/resource contention;
- economy integration;
- personal versus shared quest state;
- instance versus shared-area hosting;
- entry/exit mount ports;
- concurrency and griefing concerns.

Promotion does not mutate the original Stories cartridge.

This mode may produce:

- a private/party online deployment with little or no narrative change;
- an embedded instanced region;
- a genuinely shared-area adaptation.

### One API, target-specific capability surface

All targets use the same Builder API/diagnostic model. Capability discovery is filtered by target:

```text
capability.search(target=story, "shop")
capability.search(target=realm, "shop")
```

A story author cannot accidentally select server-only mechanics; a realm author is not constrained by offline portability where it provides no product value.

## 3. Workspace-first authoring

Normal authoring happens inside a workspace:

```elixir
%Workspace{
  id: uuid,
  cartridge_id: "fox_spirit_of_yunmeng",
  base_release: optional,
  source_revision: git_sha_or_workspace_rev,
  status: :draft,
  revision: 42
}
```

Every mutation command specifies workspace and expected revision.

No generic builder operation edits published cartridge content in place.

## 4. Builder operation envelope

```json
{
  "operation_id": "uuid",
  "workspace_id": "uuid",
  "expected_revision": 42,
  "operation": "npc.create",
  "input": {
    "key": "old_ferryman",
    "components": {}
  }
}
```

Response:

```json
{
  "ok": true,
  "workspace_revision": 43,
  "result": {...},
  "warnings": [],
  "changed_paths": ["npcs/old_ferryman.yaml"],
  "diagnostics": []
}
```

Errors use stable codes and field paths.

## 5. Operation families

### Workspace

```text
workspace.create
workspace.clone
workspace.status
workspace.diff
workspace.revert
workspace.commit
workspace.snapshot
```

### Capability discovery

```text
capability.search
capability.describe
capability.examples
capability.compatibility
capability.portability
```

### Content CRUD

```text
room.create/update/delete/get/list
npc.create/update/delete/get/list
item.*
quest.*
dialogue.*
script.*
zone.*
system.*
deployment.*
```

### Graph/query

```text
content.search
references.incoming
references.outgoing
world.path
world.component
quest.graph
dialogue.graph
dependency.graph
schedule.timeline
```

### Compile/validate

```text
cartridge.compile
cartridge.validate
content.validate
script.validate
protocol.compatibility
deployment.validate
offline.portability_check
```

### Lab

```text
lab.boot
lab.snapshot
lab.restore
lab.command
lab.advance_time
lab.run_bot
lab.run_scenario
lab.trace
lab.invariants
lab.compare_hosts
```

### Certification/publish

```text
certification.start
certification.status
certification.report
publish.stage
publish.promote
publish.rollback
```

Policy controls protect promotion operations.

## 6. Structured diagnostics

Diagnostics are first-class:

```json
{
  "severity": "error",
  "code": "QUEST_TARGET_UNREACHABLE",
  "path": "quests/missing_child.objectives[2].target",
  "message_key": "diagnostics.quest_target_unreachable",
  "data": {
    "target": "rooms/abandoned_shrine",
    "entry_room": "rooms/ferry_dock"
  },
  "suggested_capabilities": []
}
```

AI repair loops consume codes/data, not prose scraping.

## 7. Batch plans

Agents often need multi-step edits.

Support a batch plan:

```json
{
  "operations": [
    {...},
    {...}
  ],
  "mode": "atomic_if_possible"
}
```

Builder API may:

- validate entire plan before write;
- apply to temporary revision;
- return diff;
- reject if expected references break;
- optionally commit as one workspace revision.

For file-backed first-party source, implementation may use a staging tree and atomic Git/workspace commit.

## 8. Dry run

All destructive/high-impact operations SHOULD support dry-run:

- delete entity;
- rename definition key;
- change capability version;
- migrate quest;
- change deployment scope;
- publish.

Dry-run reports incoming refs, generated migrations, validation impact, and affected tests.

## 9. Rename/move must be semantic

Never make AI perform blind text replacement for definition IDs.

`content.rename`:

1. resolves exact definition;
2. enumerates typed references;
3. updates references;
4. validates;
5. returns diff.

## 10. Terminal adapter

Human terminal commands remain ergonomic:

```text
use fox_spirit
create npc old_ferryman
show npc old_ferryman
test quest missing_child
simulate --days 14
trace last
check offline
```

Parser converts commands to Builder API calls.

Terminal output can be pretty text, but underlying operation result stays structured.

## 11. MCP adapter

MCP exposes Builder API operations as tools.

Tool definitions SHOULD be generated from Builder operation schemas.

MCP adapter responsibilities:

- auth;
- schema conversion;
- request/response formatting;
- streaming long certification progress where supported.

MCP does not directly call low-level managers bypassing Builder API.

## 12. AI model independence

Lokacore currently contains model-provider-specific conversation plumbing.

V3 SHOULD NOT make the engine depend on one provider.

Possible clients:

- Astra;
- Foundry orchestration;
- Claude;
- OpenAI;
- local models.

Model selection is external orchestration configuration.

## 13. AI authoring workflow

Recommended pipeline:

```text
brief
  ↓
architect
  ↓
content plan
  ↓
capability lookup
  ↓
world builder
  ↓
quest/dialogue builder
  ↓
compile
  ↓
deterministic validation
  ↓
Lab simulations/bots
  ↓
semantic reviewer
  ↓
repair loop
  ↓
human editorial/mobile smoke
  ↓
certificate
```

Not every step requires a separate model process, but responsibilities should be separable.

## 14. Context minimization

An authoring agent SHOULD retrieve only:

- relevant schemas;
- capability docs/examples;
- local cartridge neighborhood;
- incoming/outgoing refs;
- failing traces;
- deployment profile being targeted.

Do not feed the entire engine documentation on every turn.

## 15. Primitive proposal workflow

If the builder cannot represent requested behavior:

```json
{
  "ok": false,
  "code": "MISSING_CAPABILITY",
  "requested_semantics": "...",
  "nearest_capabilities": [...]
}
```

Agent may produce a capability proposal containing:

- semantic contract;
- definition/runtime schema;
- portability classification;
- commands/events/effects;
- determinism requirements;
- tests;
- migration/version impact;
- example usage.

That proposal enters normal engine-development review. It does not auto-install into production.

## 16. AI semantic review contract

Semantic reviewer receives compact artifacts:

- world graph;
- quest/dialogue graphs;
- NPC schedule timelines;
- relevant definition summaries;
- simulation traces;
- coverage gaps;
- deterministic warnings;
- offline/shared deployment differences.

Reviewer returns structured findings:

```text
finding ID
severity
entities/definitions involved
evidence trace
semantic explanation
suggested correction
confidence
```

No “looks good” approval substitutes for mechanical gates.

## 17. Audit trail

Every Builder API write records:

- actor/model/session;
- operation ID;
- workspace/revision;
- input digest;
- output/diff digest;
- timestamp;
- policy result;
- linked certification/PR where applicable.

Secrets/prompts with sensitive data should not be retained blindly.

## 18. Visual tools

Visual UI is primarily read/debug oriented:

- map;
- dependency graph;
- quest graph;
- dialogue graph;
- timeline;
- event trace;
- certification dashboard;
- offline-vs-online conformance view;
- shared-deployment scope view.

Visual editing may be added later only when it demonstrably improves a specific workflow.

## 19. Git relationship

For first-party cartridges, Git SHOULD remain the durable collaborative source history.

The Builder API may manipulate a workspace abstraction backed by:

- checkout/worktree;
- database staging store;
- generated patch set.

Publication records exact source commit + compiled content hash.

AI should not need raw Git operations for normal content work.

## 20. Factory and runtime separation

The factory may be completely offline and gameplay must continue.

No released world may require:

- Astra;
- Foundry;
- MCP server;
- Builder API write services

to run ordinary game mechanics.

## 21. Builder API schema source

Builder operations SHOULD be declared from a machine-readable registry containing:

- operation name/version;
- input schema;
- output schema;
- error codes;
- required policy;
- workspace mutation classification;
- dry-run support;
- examples.

Generate MCP tool declarations, terminal help, API docs, and contract tests from the same registry.

## 22. Agent permissions

Agent roles SHOULD be capability-limited.

Examples:

- narrative author: content write, no publish;
- systems author: capabilities/content write, no engine merge;
- reviewer: read/simulate/comment, no mutation;
- release agent: stage exact certified hash only;
- engine developer: code change through Git workflow.

The Builder API must not expose “shell” or arbitrary filesystem execution as a normal authoring tool.

## 23. Foundry integration

Foundry MAY eventually orchestrate:

```text
objective
  → plan
  → specialized author agents
  → deterministic evidence
  → independent semantic review
  → correction
  → accepted artifact
```

But the Builder API and certification artifacts must remain independently useful without Foundry.

A future portability proof could use the Loka v3 repository as a materially different second project once Foundry's own repair gates are complete.
