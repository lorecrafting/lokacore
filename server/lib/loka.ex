defmodule Loka do
  use Boundary, check: [in: false, out: false]

  @moduledoc """
  Loka keeps the contexts that define your domain
  and business logic.

  Contexts are also responsible for managing your data, regardless
  if it comes from the database, an external API or others.

  ## Architecture Layers

  This application uses the `boundary` hex package (compile-time) to enforce
  layer separation. Boundaries are defined as follows:

  | Boundary | Mode | Deps | Description |
  |----------|------|------|-------------|
  | `Loka` | relaxed (catch-all) | -- | Accounts, Admin, Utils, Game, WorldBuilder, etc. |
  | `Loka.Engine` | check inbound | none | Core entity system, hooks, scripting. No game logic. |
  | `Loka.Framework` | check inbound | Engine | Game systems (combat, quests, inventory). |
  | `Loka.Content` | strict | Engine, Framework | Content modules wrapping TypedObject. |
  | `Loka.Session` | strict | Engine | Player session management. |
  | `LokaWeb` | strict outbound | Engine, Framework, Content, Session | Web layer (LiveView, channels, controllers). |

  **Strict boundaries** (`Content`, `Session`, `LokaWeb`) will produce compile
  warnings if they reference a boundary not listed in their deps.

  **Inbound-checked boundaries** (`Engine`, `Framework`) enforce that callers
  declare them as deps, but their own outbound calls are not checked yet.
  This is because Engine and Framework currently have architectural violations
  (e.g., Engine calls Content.Script, Framework calls Session) that need
  refactoring before strict outbound checking can be enabled.

  **Relaxed boundary** (`Loka`) absorbs all modules not in a named boundary
  (Accounts, Admin, Behaviors, Game, Utils, WorldBuilder, etc.) and does not
  enforce any call restrictions. This is a transitional state.

  ## Known Violations (suppressed via check: [out: false])

  Engine outbound violations (13):
  - `Engine.EntityRegistry` -> `Session.Registry` (2 refs)
  - `Engine.Script.Executor` -> `Content.Script` (5 refs)
  - `Engine.ZoneRegistry` -> `Content.Zone` (6 refs)

  Framework outbound violations (14):
  - `Framework.Broadcast` -> `Session` (4 refs)
  - `Framework.Dialogue` -> `Content.Dialogue` (4 refs)
  - `Framework.Quest.Definitions` -> `Content.Quest` (1 ref)
  - `Framework.Scripting.BehaviorRegistry` -> `Content.Script` (2 refs)
  - `Framework.World.NpcAmbient` -> `Session.Registry` (1+ refs)
  - `Framework.World.RoomAmbient` -> `Session.Registry` (1+ refs)

  ## Soft Dependencies (runtime, not compile-time)

  Engine uses `Application.get_env` to read Framework configuration at runtime
  (e.g., plugin registration). This is intentional and not caught by Boundary.

  Layer separation is also enforced by `test/architecture_test.exs`.
  """
end
