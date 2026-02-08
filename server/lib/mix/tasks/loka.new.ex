defmodule Mix.Tasks.Loka.New do
  @moduledoc """
  Generates scaffold YAML files for game content.

  Creates valid, pre-validated YAML templates for quests, NPCs, rooms, and storylines.
  All scaffolds pass validation out of the box.

  ## Usage

      # Create a new quest
      mix loka.new quest rescue_villagers --giver=elder_npc

      # Create a new NPC
      mix loka.new npc village_elder --type=friendly

      # Create a new room
      mix loka.new room village_square --connects=north:town_gate,south:marketplace

      # Create a new storyline
      mix loka.new storyline village_arc

  ## Options

  ### Quest options
    * `--giver` - NPC prototype key who offers this quest (default: "system")
    * `--type` - Quest type: main, side, repeatable (default: "side")

  ### NPC options
    * `--type` - NPC type: friendly, hostile, vendor, quest_giver (default: "friendly")
    * `--parent` - Parent prototype (default: "base_npc")

  ### Room options
    * `--connects` - Comma-separated exits (format: direction:room_key)
    * `--parent` - Parent prototype (default: "base_room")

  ## Examples

      mix loka.new quest find_artifact --giver=archaeologist_npc --type=side
      mix loka.new npc blacksmith_tom --type=vendor
      mix loka.new room forge --connects=east:marketplace
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @shortdoc "Generate scaffold YAML files for game content"

  @switches [
    giver: :string,
    type: :string,
    parent: :string,
    connects: :string,
    force: :boolean
  ]

  @impl Mix.Task
  def run(args) do
    case OptionParser.parse(args, switches: @switches) do
      {opts, [content_type, name], _} ->
        generate(content_type, name, opts)

      {_opts, [content_type], _} ->
        Mix.shell().error("Error: Missing name argument")
        Mix.shell().info("Usage: mix loka.new #{content_type} <name> [options]")
        System.halt(1)

      _ ->
        Mix.shell().error("Usage: mix loka.new <type> <name> [options]")
        Mix.shell().info("")
        Mix.shell().info("Types: quest, npc, room, storyline")
        Mix.shell().info("Run `mix help loka.new` for more information")
        System.halt(1)
    end
  end

  defp generate("quest", name, opts) do
    giver = Keyword.get(opts, :giver, "system")
    type = Keyword.get(opts, :type, "side")

    content = """
    id: #{name}
    name: "#{humanize(name)}"
    description: |
      TODO: Write a compelling quest description here.
      Explain what the player needs to do and why it matters.
    giver: #{giver}
    type: #{type}
    level_requirement: 1
    objectives:
      - id: first_objective
        type: talk
        target_id: TODO_npc_key
        description: "TODO: Describe what the player must do"
        # Optional: dialogue_topic: node_name
    rewards:
      xp: 50
      # Optional: items, gold, unlocks, reputation
    journal_entries:
      start: "TODO: Journal entry when quest is accepted"
      completed: "TODO: Journal entry when quest is completed"
    """

    write_file("priv/world/quests/#{name}.yml", content, opts)
    Mix.shell().info("Created quest: priv/world/quests/#{name}.yml")
    Mix.shell().info("")
    Mix.shell().info("Next steps:")
    Mix.shell().info("  1. Update TODO fields with real content")
    Mix.shell().info("  2. Add this quest to a storyline in priv/world/storylines/")
    Mix.shell().info("  3. Run `mix loka.test.validate --only quest` to verify")
  end

  defp generate("npc", name, opts) do
    type = Keyword.get(opts, :type, "friendly")
    parent = Keyword.get(opts, :parent, "base_npc")

    tags =
      case type do
        "hostile" -> ["hostile", "monster"]
        "vendor" -> ["friendly", "vendor"]
        "quest_giver" -> ["friendly", "quest_giver"]
        _ -> ["friendly"]
      end

    content = """
    key: #{name}
    type: npc
    parent: #{parent}
    short_desc: "#{humanize(name)}"
    long_desc: "TODO: A description of #{humanize(name)} standing here."
    extra_desc: |
      TODO: Extended description when player examines this NPC.
    keywords:
      - #{String.split(name, "_") |> List.first()}
    primary_keyword: #{String.split(name, "_") |> List.first()}
    tags:
    #{Enum.map(tags, &"  - #{&1}") |> Enum.join("\n")}
    components:
      combatant:
        health:
          current: 100
          max: 100
        stats:
          str: 10
          dex: 10
          sta: 10
        level: 1
    #{if type in ["vendor", "quest_giver", "friendly"] do
      """
      dialogue_tree:
        start:
          text: "Greetings, traveler. TODO: Add dialogue here."
          choices:
            - text: "Who are you?"
              next: introduction
            - text: "Goodbye."
              next: null
        introduction:
          text: "I am #{humanize(name)}. TODO: Add more dialogue."
          choices:
            - text: "Interesting."
              next: null
      """
    else
      ""
    end}
    """

    write_file("priv/world/prototypes/npcs/#{name}.yml", content, opts)
    Mix.shell().info("Created NPC: priv/world/prototypes/npcs/#{name}.yml")
    Mix.shell().info("")
    Mix.shell().info("Next steps:")
    Mix.shell().info("  1. Update TODO fields with real content")
    Mix.shell().info("  2. Add NPC to a room's spawns list")
    Mix.shell().info("  3. Run `mix loka.test.validate --only prototype` to verify")
  end

  defp generate("room", name, opts) do
    parent = Keyword.get(opts, :parent, "base_room")
    connects = Keyword.get(opts, :connects, "")

    exits =
      if connects == "" do
        "exits:\n  # TODO: Add exits (e.g., north: other_room)"
      else
        exit_lines =
          connects
          |> String.split(",")
          |> Enum.map(fn pair ->
            case String.split(pair, ":") do
              [dir, room] -> "  #{dir}: #{room}"
              _ -> nil
            end
          end)
          |> Enum.reject(&is_nil/1)
          |> Enum.join("\n")

        "exits:\n#{exit_lines}"
      end

    content = """
    key: #{name}
    type: room
    parent: #{parent}
    short_desc: "#{humanize(name)}"
    long_desc: "TODO: What the player sees when entering this room."
    extra_desc: |
      TODO: Extended description when player looks around carefully.
    keywords: []
    #{exits}
    spawns: []
      # - prototype: npc_key
    tags:
      - outdoor
    """

    write_file("priv/world/prototypes/rooms/#{name}.yml", content, opts)
    Mix.shell().info("Created room: priv/world/prototypes/rooms/#{name}.yml")
    Mix.shell().info("")
    Mix.shell().info("Next steps:")
    Mix.shell().info("  1. Update TODO fields with real descriptions")
    Mix.shell().info("  2. Add exits to connect to other rooms")
    Mix.shell().info("  3. Add NPCs or items to the spawns list")
    Mix.shell().info("  4. Run `mix loka.test.validate --only world` to verify")
  end

  defp generate("storyline", name, opts) do
    content = """
    key: #{name}
    name: "#{humanize(name)}"
    description: |
      TODO: Write an overview of this storyline arc.
      What is the main conflict? What will the player experience?
    starting_room: TODO_starting_room_key
    tags:
      - main
    acts:
      - id: act_1
        name: "Act One"
        description: |
          TODO: What happens in this act?
        quests:
          - TODO_first_quest_id
      - id: act_2
        name: "Act Two"
        description: |
          TODO: What happens in this act?
        quests:
          - TODO_second_quest_id
        requires:
          - act_1
    side_quests:
      # - optional_quest_id
    """

    write_file("priv/world/storylines/#{name}.yml", content, opts)
    Mix.shell().info("Created storyline: priv/world/storylines/#{name}.yml")
    Mix.shell().info("")
    Mix.shell().info("Next steps:")
    Mix.shell().info("  1. Update TODO fields with real content")
    Mix.shell().info("  2. Create the quests referenced in acts")
    Mix.shell().info("  3. Run `mix loka.test.validate --only storyline` to verify")
  end

  defp generate(unknown, _name, _opts) do
    Mix.shell().error("Unknown content type: #{unknown}")
    Mix.shell().info("Valid types: quest, npc, room, storyline")
    System.halt(1)
  end

  defp write_file(path, content, opts) do
    full_path = Path.join(File.cwd!(), path)

    if File.exists?(full_path) and not Keyword.get(opts, :force, false) do
      Mix.shell().error("File already exists: #{path}")
      Mix.shell().info("Use --force to overwrite")
      System.halt(1)
    end

    # Ensure directory exists
    full_path |> Path.dirname() |> File.mkdir_p!()

    File.write!(full_path, content)
  end

  defp humanize(name) do
    name
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end
end
