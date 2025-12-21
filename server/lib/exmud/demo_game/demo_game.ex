defmodule Exmud.DemoGame do
  @moduledoc """
  Demo game layer for ExMUD engine.

  This module provides the game-specific implementation on top of the ExMUD engine,
  including:

  - Player game state management (inventory, equipment, quests, stats)
  - Game systems (inventory, equipment, combat, quests)
  - Game-specific components (combatant, container, equipable, etc.)
  - Game behaviors (NPC AI, quest logic, dialogue)
  - Content definitions (items, NPCs, quests, dialogue trees)

  ## Architecture

  The demo game follows the Entity-Component-Behavior pattern:

  - **Components** - Data structures that can be attached to entities
  - **Behaviors** - Logic modules that operate on entities with specific components
  - **Systems** - Higher-level game mechanics (inventory, combat, quests)
  - **Content** - Static data definitions for game objects

  ## Directory Structure

      demo_game/
      ├── systems/        # Game systems (inventory, equipment, quest, combat)
      ├── components/     # Component structs (combatant, container, etc.)
      ├── behaviors/      # Behavior implementations
      └── content/        # Static content definitions
  """
end
