defmodule Loka do
  @moduledoc """
  Loka keeps the contexts that define your domain
  and business logic.

  Contexts are also responsible for managing your data, regardless
  if it comes from the database, an external API or others.

  ## Architecture Layers

  This application uses Boundary to enforce layer separation:

  - **Engine** (`Loka.Engine`) - Core entity system, hooks, scripting. No game logic.
  - **Framework** (`Loka.Framework`) - Game systems (combat, quests, inventory). Uses Engine.
  - **Utils** (`Loka.Utils`) - Shared utilities. Used by all layers.
  - **Accounts** (`Loka.Accounts`) - User auth. Separate from game logic.
  - **Testing** (`Loka.Testing`) - Test support modules.

  **Layer Rules:**
  - Engine MUST NOT depend on Framework (compile error if violated)
  - Framework CAN depend on Engine
  - Web (LokaWeb) CAN depend on both Engine and Framework

  Layer separation is enforced by `test/architecture_test.exs`.
  """
end
