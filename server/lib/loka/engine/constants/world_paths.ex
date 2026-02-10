defmodule Loka.Engine.Constants.WorldPaths do
  @moduledoc """
  Single source of truth for all game world directory and file paths.

  All modules that reference `priv/world/` paths should use this module
  instead of defining their own path strings.

  ## Directory Structure

      priv/world/
      ├── prototypes/          # Entity prototypes
      │   ├── _base/           # Base prototypes (parents)
      │   ├── rooms/
      │   ├── items/
      │   └── npcs/
      ├── quests/              # Quest definitions
      │   └── _chains/         # Quest chain definitions
      ├── zones/               # Zone definitions
      ├── dialogues/           # Dialogue trees
      ├── scripts/             # Elixir scripts
      ├── storylines/          # Storyline arcs
      ├── cutscenes/           # Cutscene sequences
      ├── skills/              # Skill definitions
      ├── statuses/            # Status effect definitions
      ├── resources/           # Resource type definitions
      ├── recipes/             # Crafting recipes
      ├── nodes/               # Gathering node definitions
      ├── config/              # World configuration files
      │   ├── ambient_messages.yml
      │   ├── damage_messages.yml
      │   ├── day_night.yml
      │   ├── sound_mappings.yml
      │   ├── weather.yml
      │   └── damage_types.yml (in combat/)
      ├── drafts/              # Builder-created, not yet published
      │   └── (mirrors content dirs above)
      └── socials.yml          # Social/emote definitions

  ## Usage

      alias Loka.Engine.Constants.WorldPaths

      # Get a content directory
      WorldPaths.quests_dir()       #=> "priv/world/quests"
      WorldPaths.prototypes_dir()   #=> "priv/world/prototypes"

      # Get a config file path
      WorldPaths.socials_file()     #=> "priv/world/socials.yml"

      # Get draft directories
      WorldPaths.drafts_dir("quests")  #=> "priv/world/drafts/quests"

      # Get all loader paths (for TypedObject.Loader)
      WorldPaths.all_loader_paths()
  """

  # =============================================================================
  # Root
  # =============================================================================

  @doc "Returns the root world directory path."
  @spec world_dir() :: String.t()
  def world_dir, do: "priv/world"

  # =============================================================================
  # Entity Prototype Directories
  # =============================================================================

  @doc "Returns the prototypes root directory."
  @spec prototypes_dir() :: String.t()
  def prototypes_dir, do: Path.join(world_dir(), "prototypes")

  @doc "Returns the rooms prototype directory."
  @spec rooms_dir() :: String.t()
  def rooms_dir, do: Path.join(prototypes_dir(), "rooms")

  @doc "Returns the NPCs prototype directory."
  @spec npcs_dir() :: String.t()
  def npcs_dir, do: Path.join(prototypes_dir(), "npcs")

  @doc "Returns the items prototype directory."
  @spec items_dir() :: String.t()
  def items_dir, do: Path.join(prototypes_dir(), "items")

  # =============================================================================
  # Content Directories
  # =============================================================================

  @doc "Returns the quests directory."
  @spec quests_dir() :: String.t()
  def quests_dir, do: Path.join(world_dir(), "quests")

  @doc "Returns the quest chains directory."
  @spec quest_chains_dir() :: String.t()
  def quest_chains_dir, do: Path.join(quests_dir(), "_chains")

  @doc "Returns the zones directory."
  @spec zones_dir() :: String.t()
  def zones_dir, do: Path.join(world_dir(), "zones")

  @doc "Returns the dialogues directory."
  @spec dialogues_dir() :: String.t()
  def dialogues_dir, do: Path.join(world_dir(), "dialogues")

  @doc "Returns the scripts directory."
  @spec scripts_dir() :: String.t()
  def scripts_dir, do: Path.join(world_dir(), "scripts")

  @doc "Returns the storylines directory."
  @spec storylines_dir() :: String.t()
  def storylines_dir, do: Path.join(world_dir(), "storylines")

  @doc "Returns the cutscenes directory."
  @spec cutscenes_dir() :: String.t()
  def cutscenes_dir, do: Path.join(world_dir(), "cutscenes")

  @doc "Returns the skills directory."
  @spec skills_dir() :: String.t()
  def skills_dir, do: Path.join(world_dir(), "skills")

  @doc "Returns the statuses directory."
  @spec statuses_dir() :: String.t()
  def statuses_dir, do: Path.join(world_dir(), "statuses")

  @doc "Returns the resources directory."
  @spec resources_dir() :: String.t()
  def resources_dir, do: Path.join(world_dir(), "resources")

  @doc "Returns the recipes directory."
  @spec recipes_dir() :: String.t()
  def recipes_dir, do: Path.join(world_dir(), "recipes")

  @doc "Returns the gathering nodes directory."
  @spec gathering_nodes_dir() :: String.t()
  def gathering_nodes_dir, do: Path.join(world_dir(), "nodes")

  # =============================================================================
  # Config Files and Directories
  # =============================================================================

  @doc "Returns the config directory."
  @spec config_dir() :: String.t()
  def config_dir, do: Path.join(world_dir(), "config")

  @doc "Returns the socials YAML file path."
  @spec socials_file() :: String.t()
  def socials_file, do: Path.join(world_dir(), "socials.yml")

  @doc "Returns the ambient messages config file path."
  @spec ambient_messages_file() :: String.t()
  def ambient_messages_file, do: Path.join(config_dir(), "ambient_messages.yml")

  @doc "Returns the day/night config file path."
  @spec day_night_file() :: String.t()
  def day_night_file, do: Path.join(config_dir(), "day_night.yml")

  @doc "Returns the sound mappings config file path."
  @spec sound_mappings_file() :: String.t()
  def sound_mappings_file, do: Path.join(config_dir(), "sound_mappings.yml")

  @doc "Returns the weather config file path."
  @spec weather_file() :: String.t()
  def weather_file, do: Path.join(config_dir(), "weather.yml")

  @doc "Returns the damage types config file path."
  @spec damage_types_file() :: String.t()
  def damage_types_file, do: Path.join(world_dir(), "combat/damage_types.yml")

  @doc "Returns the damage messages config file path."
  @spec damage_messages_file() :: String.t()
  def damage_messages_file, do: Path.join(config_dir(), "damage_messages.yml")

  # =============================================================================
  # Draft Directories
  # =============================================================================

  @doc "Returns the root drafts directory."
  @spec drafts_dir() :: String.t()
  def drafts_dir, do: Path.join(world_dir(), "drafts")

  @doc "Returns a drafts subdirectory for the given subpath."
  @spec drafts_dir(String.t()) :: String.t()
  def drafts_dir(subpath), do: Path.join(drafts_dir(), subpath)

  # =============================================================================
  # Aggregate Path Lists
  # =============================================================================

  @doc """
  Returns all content directory paths for TypedObject.Loader.

  Includes both published and draft directories.
  """
  @spec all_loader_paths() :: [String.t()]
  def all_loader_paths do
    published = content_dirs()
    draft = Enum.map(content_dirs(), fn dir -> drafts_dir(relative_to_world(dir)) end)
    published ++ draft
  end

  @doc """
  Returns all published content directory paths.
  """
  @spec content_dirs() :: [String.t()]
  def content_dirs do
    [
      prototypes_dir(),
      quests_dir(),
      zones_dir(),
      dialogues_dir(),
      scripts_dir(),
      storylines_dir(),
      cutscenes_dir(),
      skills_dir(),
      statuses_dir(),
      resources_dir(),
      recipes_dir(),
      gathering_nodes_dir()
    ]
  end

  @doc """
  Returns directory paths used for YAML validation.
  """
  @spec validation_dirs() :: [String.t()]
  def validation_dirs do
    [
      prototypes_dir(),
      quests_dir(),
      zones_dir(),
      dialogues_dir(),
      scripts_dir(),
      cutscenes_dir()
    ]
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  # Returns the path relative to the world directory.
  defp relative_to_world(path) do
    String.replace_prefix(path, world_dir() <> "/", "")
  end
end
