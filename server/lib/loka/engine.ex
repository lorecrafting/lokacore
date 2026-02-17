defmodule Loka.Engine do
  @moduledoc """
  Core entity system, hooks, scripting, and prototypes.

  This is the foundational layer of the Loka game engine. It provides:

  - Entity lifecycle (EntityServer, EntityRegistry, EntitySupervisor)
  - Prototype system (YAML templates, inheritance, spawning)
  - EntitySeeder (boot-time YAML → DB content loading)
  - Hook system for extensibility
  - Lock-based access control
  - Scripting engine (sandboxed Elixir)
  - Event bus (Phoenix.PubSub)
  - World graph and zone management

  ## Boundary Rules

  Engine has NO dependencies on other Loka layers. It is the bottom of the
  dependency graph. Framework, Content, Session, and Web all depend on Engine,
  but Engine must never call into those layers.

  Known soft dependency: Engine uses `Application.get_env` to read Framework
  configuration at runtime (e.g., plugin registration). This is not a compile-time
  dependency and is intentional.
  """

  use Boundary, top_level?: true, exports: :all, check: [out: false]
end
