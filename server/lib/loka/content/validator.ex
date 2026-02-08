defmodule Loka.Content.Validator do
  @moduledoc """
  Content validation for quests, NPCs, rooms, and storylines.

  This module provides validation that can be used by:
  - API endpoints (`/api/validate/*`)
  - LiveView admin panel (world designer)
  - Mix tasks (`mix loka.test.validate`)

  ## Usage

      # Validate parsed data
      {:ok, data} = YamlElixir.read_from_string(yaml_content)
      result = Loka.Content.Validator.validate(:quest, data)

      case result do
        %{valid: true, warnings: warnings} ->
          # Content is valid, but check warnings
        %{valid: false, errors: errors, warnings: warnings} ->
          # Content has errors
      end

      # Validate YAML string directly
      result = Loka.Content.Validator.validate_yaml(:quest, yaml_string)

  ## Result Format

      %{
        valid: boolean,
        errors: [%{field: string, message: string, suggestion: string | nil}],
        warnings: [%{field: string, message: string, suggestion: string | nil}]
      }

  ## Quest Validations

  ### Required Fields (Errors)
  - `id` - Unique quest identifier (lowercase with underscores)
  - `name` - Display name for players
  - `description` - Quest description
  - `objectives` - At least one objective required

  ### Objective Validations (Errors)
  - Each objective must have `id`, `type`, `description`
  - Valid types: `talk`, `kill`, `get_item`, `go_to`
  - `target_id` required for all objective types
  - Target must exist and be correct type:
    - `go_to` → target must be a room
    - `talk` → target must be an NPC with dialogue tree
    - `kill` → target must be an NPC with combatant component
    - `get_item` → target must be an item

  ### Objective Validations (Warnings)
  - `kill` objectives on friendly NPCs
  - NPCs that don't spawn in any room (`kill`, `talk`)
  - Rooms not connected to the world (`go_to`)
  - Items with no obtainability source (`get_item`)
  - Missing `dialogue_topic` node in NPC's dialogue tree

  ### Quest Giver Validations
  - Giver NPC must exist
  - Giver must have a dialogue tree
  - Warning if no `accept_quest` action for this quest

  ### Rewards Validations
  - Reward items must exist as prototypes

  ## Item Obtainability Sources

  The `get_item` validator checks these sources:
  1. **Loot drops** - NPC `components.loot.drops` arrays
  2. **Shops** - NPC `components.shop.sells` or `components.merchant.stock`
  3. **Crafting** - Output of recipes in `RecipeRegistry`
  4. **Quest rewards** - `rewards.items` arrays in quests
  5. **Dialogue** - `give_item` actions in NPC dialogue trees
  6. **Room spawns** - Direct spawns in room prototypes

  ## NPC Validations

  - `key` - Required, lowercase with underscores
  - `short_desc` - Required
  - `type` - Must be "npc"
  - Parent prototype existence warning

  ## Room Validations

  - `key` - Required, lowercase with underscores
  - `short_desc` - Required
  - `type` - Must be "room"
  - Exit directions: north, south, east, west, up, down
  - Exit target rooms existence warnings
  - Parent prototype existence warning

  ## Storyline Validations

  - `key` - Required, lowercase with underscores
  - `name` - Required
  - `acts` - At least one act required
  - Each act needs `id`, `name`, `quests` (at least one)
  - Quest existence warnings
  """

  @type validation_message :: %{
          field: String.t() | nil,
          message: String.t(),
          suggestion: String.t() | nil
        }

  @type validation_result :: %{
          valid: boolean,
          errors: [validation_message],
          warnings: [validation_message]
        }

  alias Loka.Engine.TypedObject

  @type content_type :: :quest | :npc | :room | :storyline

  @doc """
  Validates YAML content string.

  Parses the YAML and then validates the content.
  Returns parse errors if YAML is invalid.
  """
  @spec validate_yaml(content_type, String.t()) :: validation_result
  def validate_yaml(type, yaml_content) do
    case parse_yaml(yaml_content) do
      {:ok, data} ->
        validate(type, data)

      {:error, reason} ->
        %{
          valid: false,
          errors: [
            %{
              field: nil,
              message: "YAML parse error: #{reason}",
              suggestion: "Check YAML syntax - ensure proper indentation and quoting"
            }
          ],
          warnings: []
        }
    end
  end

  @doc """
  Validates parsed content data.
  """
  @spec validate(content_type, map) :: validation_result
  def validate(type, data) when is_map(data) do
    {errors, warnings} = do_validate(type, data)

    %{
      valid: Enum.empty?(errors),
      errors: format_messages(errors),
      warnings: format_messages(warnings)
    }
  end

  def validate(_type, _data) do
    %{
      valid: false,
      errors: [%{field: nil, message: "Content must be a map/object", suggestion: nil}],
      warnings: []
    }
  end

  # Parse YAML content
  defp parse_yaml(content) do
    case YamlElixir.read_from_string(content) do
      {:ok, data} -> {:ok, data}
      {:error, %{message: msg}} -> {:error, msg}
      {:error, msg} when is_binary(msg) -> {:error, msg}
      {:error, msg} -> {:error, inspect(msg)}
    end
  end

  # Dispatch to type-specific validator
  defp do_validate(:quest, data), do: validate_quest(data)
  defp do_validate(:npc, data), do: validate_npc(data)
  defp do_validate(:room, data), do: validate_room(data)
  defp do_validate(:storyline, data), do: validate_storyline(data)

  # ===========================================================================
  # Quest Validation
  # ===========================================================================

  defp validate_quest(data) do
    errors = []
    warnings = []

    # Required fields
    errors = check_required(errors, data, "id", "Unique quest identifier")
    errors = check_required(errors, data, "name", "Display name for players")
    errors = check_required(errors, data, "description", "Quest description")
    errors = check_required(errors, data, "objectives", "List of objectives")

    # ID format
    errors =
      if data["id"] && !Regex.match?(~r/^[a-z][a-z0-9_]*$/, to_string(data["id"])) do
        [{"id", "Must be lowercase with underscores (e.g., 'my_quest')", nil} | errors]
      else
        errors
      end

    # Objectives validation
    objectives = data["objectives"] || []

    errors =
      if is_list(objectives) && Enum.empty?(objectives) do
        [
          {"objectives", "At least one objective is required",
           "Add an objective with type: talk, kill, get_item, or go_to"}
          | errors
        ]
      else
        errors
      end

    {errors, warnings} =
      if is_list(objectives) do
        objectives
        |> Enum.with_index()
        |> Enum.reduce({errors, warnings}, fn {obj, idx}, {errs, warns} ->
          {obj_errors, obj_warnings} = validate_objective(obj, idx)
          {obj_errors ++ errs, obj_warnings ++ warns}
        end)
      else
        {[{"objectives", "Must be a list", nil} | errors], warnings}
      end

    # Check giver exists and has proper dialogue setup
    {giver_errors, giver_warnings} = validate_quest_giver(data["giver"], data["id"])
    errors = giver_errors ++ errors
    warnings = giver_warnings ++ warnings

    # Type validation
    valid_types = ["main", "side", "repeatable"]

    errors =
      if data["type"] && data["type"] not in valid_types do
        [
          {"type", "Invalid quest type '#{data["type"]}'",
           "Use one of: #{Enum.join(valid_types, ", ")}"}
          | errors
        ]
      else
        errors
      end

    # Rewards validation
    errors = validate_rewards(data["rewards"], errors)

    {Enum.reverse(errors), Enum.reverse(warnings)}
  end

  defp validate_objective(obj, idx) when is_map(obj) do
    prefix = "objectives[#{idx}]"
    errors = []
    warnings = []

    errors = check_required(errors, obj, "id", "Objective ID", prefix)
    errors = check_required(errors, obj, "type", "Objective type", prefix)
    errors = check_required(errors, obj, "description", "Objective description", prefix)

    valid_types = ["talk", "kill", "get_item", "go_to"]

    errors =
      if obj["type"] && obj["type"] not in valid_types do
        [
          {"#{prefix}.type", "Invalid type '#{obj["type"]}'",
           "Use one of: #{Enum.join(valid_types, ", ")}"}
          | errors
        ]
      else
        errors
      end

    errors =
      if obj["type"] in valid_types && !obj["target_id"] do
        [{"#{prefix}.target_id", "Required for #{obj["type"]} objectives", nil} | errors]
      else
        errors
      end

    # Validate target exists and is correct type (returns {errors, warnings})
    {target_errors, target_warnings} = validate_objective_target(obj, prefix)
    errors = target_errors ++ errors
    warnings = target_warnings ++ warnings

    # Validate dialogue_topic for talk objectives
    errors = validate_dialogue_topic(obj, prefix, errors)

    {errors, warnings}
  end

  defp validate_objective(_obj, idx) do
    {[{"objectives[#{idx}]", "Must be an object", nil}], []}
  end

  # Validate objective target exists and is the correct type
  # Returns {errors, warnings}
  defp validate_objective_target(obj, prefix) do
    target_id = obj["target_id"]
    obj_type = obj["type"]

    if is_nil(target_id) or target_id == "" do
      {[], []}
    else
      case {obj_type, TypedObject.Loader.get(target_id)} do
        {_, {:error, :not_found}} ->
          {[
             {"#{prefix}.target_id", "Target '#{target_id}' not found",
              "Create the prototype first or fix the target_id"}
           ], []}

        {"go_to", {:ok, proto}} ->
          validate_go_to_target(proto, target_id, prefix)

        {"talk", {:ok, proto}} ->
          validate_talk_target(proto, target_id, prefix)

        {"kill", {:ok, proto}} ->
          validate_kill_target(proto, target_id, prefix)

        {"get_item", {:ok, proto}} ->
          validate_get_item_target(proto, target_id, prefix)

        _ ->
          {[], []}
      end
    end
  end

  defp validate_go_to_target(proto, target_id, prefix) do
    if proto.subtype == :room do
      # Check if room is reachable (warning)
      warnings =
        if room_is_reachable?(target_id) do
          []
        else
          [
            {"#{prefix}.target_id", "Room '#{target_id}' may not be reachable from start",
             "Verify room is connected to the world via exits"}
          ]
        end

      {[], warnings}
    else
      {[
         {"#{prefix}.target_id", "'#{target_id}' is not a room (type: #{proto.subtype})",
          "go_to objectives require a room target"}
       ], []}
    end
  end

  defp validate_talk_target(proto, target_id, prefix) do
    if proto.subtype == :npc do
      errors =
        if has_dialogue_tree?(proto) do
          []
        else
          [
            {"#{prefix}.target_id", "NPC '#{target_id}' has no dialogue tree",
             "Add a dialogue_tree component to the NPC"}
          ]
        end

      # Check if NPC spawns somewhere (warning)
      warnings =
        if npc_spawns_somewhere?(target_id) do
          []
        else
          [
            {"#{prefix}.target_id", "NPC '#{target_id}' doesn't spawn in any room",
             "Add the NPC to a room's spawns list"}
          ]
        end

      {errors, warnings}
    else
      {[
         {"#{prefix}.target_id", "'#{target_id}' is not an NPC (type: #{proto.subtype})",
          "talk objectives require an NPC target"}
       ], []}
    end
  end

  defp validate_kill_target(proto, target_id, prefix) do
    if proto.subtype == :npc do
      # Check NPC has combatant component (error)
      errors =
        if has_combatant_component?(proto) do
          []
        else
          [
            {"#{prefix}.target_id", "NPC '#{target_id}' has no combatant component",
             "Add a combatant component with health/stats to make the NPC killable"}
          ]
        end

      warnings = []

      # Check if NPC is tagged friendly (warning)
      warnings =
        if is_tagged_friendly?(proto) do
          [
            {"#{prefix}.target_id", "NPC '#{target_id}' is tagged as friendly",
             "Kill objectives typically target hostile NPCs - verify this is intentional"}
            | warnings
          ]
        else
          warnings
        end

      # Check if NPC spawns somewhere (warning)
      warnings =
        if npc_spawns_somewhere?(target_id) do
          warnings
        else
          [
            {"#{prefix}.target_id", "NPC '#{target_id}' doesn't spawn in any room",
             "Add the NPC to a room's spawns list so players can find and kill it"}
            | warnings
          ]
        end

      {errors, warnings}
    else
      {[
         {"#{prefix}.target_id", "'#{target_id}' is not an NPC (type: #{proto.subtype})",
          "kill objectives require an NPC target"}
       ], []}
    end
  end

  defp validate_get_item_target(proto, target_id, prefix) do
    if proto.subtype == :item do
      # Check if item is obtainable (warning)
      warnings =
        if item_is_obtainable?(target_id) do
          []
        else
          [
            {"#{prefix}.target_id", "Item '#{target_id}' has no known source",
             "Add item to: loot drops, shop, crafting recipe, quest reward, or dialogue give_item"}
          ]
        end

      {[], warnings}
    else
      {[
         {"#{prefix}.target_id", "'#{target_id}' is not an item (type: #{proto.subtype})",
          "get_item objectives require an item target"}
       ], []}
    end
  end

  # Validate dialogue_topic exists in target NPC's dialogue tree
  defp validate_dialogue_topic(obj, prefix, errors) do
    obj_type = obj["type"]
    target_id = obj["target_id"]
    topic = obj["dialogue_topic"]

    if obj_type == "talk" and not is_nil(topic) and topic != "" do
      case TypedObject.Loader.get(target_id) do
        {:error, :not_found} ->
          # Target doesn't exist - already caught by validate_objective_target
          errors

        {:ok, proto} ->
          dialogue_tree = get_prototype_dialogue_tree(proto)

          if has_dialogue_node?(dialogue_tree, topic) do
            errors
          else
            [
              {"#{prefix}.dialogue_topic",
               "Dialogue node '#{topic}' not found in '#{target_id}'s dialogue tree",
               "Add a '#{topic}' node to the NPC's dialogue_tree or fix the topic name"}
              | errors
            ]
          end
      end
    else
      errors
    end
  end

  # Check if prototype has a dialogue tree
  defp has_dialogue_tree?(proto) do
    tree = get_prototype_dialogue_tree(proto)
    is_map(tree) and map_size(tree) > 0
  end

  # Check if prototype has combatant component (can be killed)
  defp has_combatant_component?(proto) do
    components = proto.components || %{}

    combatant =
      Map.get(components, "combatant") ||
        Map.get(components, :combatant)

    is_map(combatant) and map_size(combatant) > 0
  end

  # Check if NPC is tagged as friendly
  defp is_tagged_friendly?(proto) do
    tags = proto.tags || []
    "friendly" in tags or :friendly in tags
  end

  # Check if NPC spawns in any room
  defp npc_spawns_somewhere?(npc_key) do
    # Get all room prototypes and check their spawns
    TypedObject.Loader.list_by_type(:entity, :room)
    |> Enum.any?(fn room ->
      spawns = room.data["spawns"] || []

      Enum.any?(spawns, fn spawn ->
        spawn_key =
          Map.get(spawn, "prototype") ||
            Map.get(spawn, :prototype)

        spawn_key == npc_key
      end)
    end)
  end

  # Check if room is reachable from the starting room
  defp room_is_reachable?(room_key) do
    # Use WorldGraph if available, otherwise assume reachable
    case Process.whereis(Loka.Engine.WorldGraph) do
      nil ->
        # WorldGraph not running, assume reachable
        true

      _pid ->
        # If room has coordinates, it's connected to the world
        case Loka.Engine.WorldGraph.get_coordinates(room_key) do
          nil -> false
          {_x, _y, _z} -> true
          _ -> true
        end
    end
  end

  # Check if item can be obtained from any source
  defp item_is_obtainable?(item_key) do
    # Check all sources: loot, shops, crafting, quests, dialogue, room spawns
    item_from_loot?(item_key) or
      item_from_shop?(item_key) or
      item_from_crafting?(item_key) or
      item_from_quest_rewards?(item_key) or
      item_from_dialogue?(item_key) or
      item_from_room_spawns?(item_key)
  end

  # Check if item drops from any NPC
  defp item_from_loot?(item_key) do
    TypedObject.Loader.list_by_type(:entity, :npc)
    |> Enum.any?(fn npc ->
      loot =
        get_in(npc.components || %{}, [:loot, :drops]) ||
          get_in(npc.components || %{}, ["loot", "drops"]) || []

      Enum.any?(loot, fn drop ->
        drop_item = Map.get(drop, "item") || Map.get(drop, :item)
        drop_item == item_key
      end)
    end)
  end

  # Check if item is sold in any shop
  defp item_from_shop?(item_key) do
    TypedObject.Loader.list_by_type(:entity, :npc)
    |> Enum.any?(fn npc ->
      components = npc.components || %{}

      # Check shop.sells format
      shop_sells =
        get_in(components, [:shop, :sells]) ||
          get_in(components, ["shop", "sells"]) || []

      # Check merchant.stock format
      merchant_stock =
        get_in(components, [:merchant, :stock]) ||
          get_in(components, ["merchant", "stock"]) || []

      item_key in shop_sells or
        Enum.any?(merchant_stock, fn stock ->
          stock_item = Map.get(stock, "item") || Map.get(stock, :item)
          stock_item == item_key
        end)
    end)
  end

  # Check if item is output of any crafting recipe
  defp item_from_crafting?(item_key) do
    # Check if CraftingRegistry exists and has recipes
    # Use apply/3 to avoid compile-time warnings about undefined module
    registry = Loka.Framework.Crafting.RecipeRegistry

    if Code.ensure_loaded?(registry) do
      case Process.whereis(registry) do
        nil ->
          false

        _pid ->
          apply(registry, :all, [])
          |> Enum.any?(fn recipe ->
            outputs = recipe.output || []

            Enum.any?(outputs, fn out ->
              out_item = Map.get(out, "item") || Map.get(out, :item)
              out_item == item_key
            end)
          end)
      end
    else
      false
    end
  rescue
    _ -> false
  end

  # Check if item is a quest reward
  defp item_from_quest_rewards?(item_key) do
    case Process.whereis(Loka.Framework.Quest.QuestRegistry) do
      nil ->
        false

      _pid ->
        Loka.Framework.Quest.QuestRegistry.all()
        |> Enum.any?(fn quest ->
          rewards = quest.rewards || %{}
          items = Map.get(rewards, "items") || Map.get(rewards, :items) || []
          item_key in items
        end)
    end
  rescue
    _ -> false
  end

  # Check if item is given via dialogue action
  defp item_from_dialogue?(item_key) do
    TypedObject.Loader.list_by_type(:entity, :npc)
    |> Enum.any?(fn npc ->
      dialogue_tree = get_prototype_dialogue_tree(npc)
      dialogue_gives_item?(dialogue_tree, item_key)
    end)
  end

  defp dialogue_gives_item?(dialogue_tree, item_key) when is_map(dialogue_tree) do
    Enum.any?(dialogue_tree, fn {_node_id, node} when is_map(node) ->
      choices = Map.get(node, "choices") || Map.get(node, :choices) || []

      Enum.any?(choices, fn choice ->
        action = Map.get(choice, "action") || Map.get(choice, :action)

        case action do
          ["give_item", ^item_key] -> true
          [:give_item, ^item_key] -> true
          _ -> false
        end
      end)
    end)
  end

  defp dialogue_gives_item?(_, _), do: false

  # Check if item spawns in any room
  defp item_from_room_spawns?(item_key) do
    TypedObject.Loader.list_by_type(:entity, :room)
    |> Enum.any?(fn room ->
      spawns = room.data["spawns"] || []

      Enum.any?(spawns, fn spawn ->
        spawn_proto = Map.get(spawn, "prototype") || Map.get(spawn, :prototype)
        spawn_proto == item_key
      end)
    end)
  end

  # Extract dialogue tree from prototype components
  # Only checks for dialogue_tree component - old dialogue format is deprecated
  defp get_prototype_dialogue_tree(proto) do
    components = proto.components || %{}

    # dialogue_tree is the only supported format
    Map.get(components, "dialogue_tree") ||
      Map.get(components, :dialogue_tree) ||
      %{}
  end

  # Check if dialogue tree contains a specific node
  defp has_dialogue_node?(dialogue_tree, node_id) when is_map(dialogue_tree) do
    Map.has_key?(dialogue_tree, node_id) or
      Map.has_key?(dialogue_tree, String.to_existing_atom(node_id))
  rescue
    ArgumentError -> false
  end

  defp has_dialogue_node?(_, _), do: false

  # Validate quest giver has dialogue and accept_quest action
  # System quests are auto-granted, no validation needed
  defp validate_quest_giver("system", _quest_id), do: {[], []}
  defp validate_quest_giver(:system, _quest_id), do: {[], []}

  # Warn if quest has no giver (no activation method)
  defp validate_quest_giver(nil, quest_id) do
    {[],
     [
       {"giver", "Quest '#{quest_id}' has no activation method",
        "Add giver: \"npc_key\" (requires talking to NPC) or giver: \"system\" (auto-granted)"}
     ]}
  end

  defp validate_quest_giver("", quest_id), do: validate_quest_giver(nil, quest_id)

  defp validate_quest_giver(giver_key, quest_id) do
    case TypedObject.Loader.get(giver_key) do
      {:error, :not_found} ->
        {[
           {"giver", "NPC '#{giver_key}' not found",
            "Create the NPC prototype first or fix the giver key"}
         ], []}

      {:ok, proto} ->
        if proto.subtype != :npc do
          {[
             {"giver", "'#{giver_key}' is not an NPC (type: #{proto.subtype})",
              "Quest givers must be NPC prototypes"}
           ], []}
        else
          dialogue_tree = get_prototype_dialogue_tree(proto)

          cond do
            not is_map(dialogue_tree) or map_size(dialogue_tree) == 0 ->
              {[
                 {"giver", "NPC '#{giver_key}' has no dialogue tree",
                  "Add a dialogue_tree component so the NPC can offer the quest"}
               ], []}

            not has_accept_quest_action?(dialogue_tree, quest_id) ->
              # Warning, not error - the accept action might be added later
              {[],
               [
                 {"giver",
                  "NPC '#{giver_key}' doesn't have accept_quest action for '#{quest_id}'",
                  "Add a dialogue choice with action: [\"accept_quest\", \"#{quest_id}\"]"}
               ]}

            true ->
              {[], []}
          end
        end
    end
  end

  # Check if dialogue tree has accept_quest action for this quest
  defp has_accept_quest_action?(dialogue_tree, quest_id) when is_map(dialogue_tree) do
    Enum.any?(dialogue_tree, fn {_node_id, node} ->
      check_node_for_accept_action(node, quest_id)
    end)
  end

  defp has_accept_quest_action?(_, _), do: false

  defp check_node_for_accept_action(node, quest_id) when is_map(node) do
    choices = Map.get(node, "choices") || Map.get(node, :choices) || []
    options = Map.get(node, "options") || Map.get(node, :options) || []

    Enum.any?(choices ++ options, fn choice ->
      action = Map.get(choice, "action") || Map.get(choice, :action)
      is_accept_quest_action?(action, quest_id)
    end)
  end

  defp check_node_for_accept_action(_, _), do: false

  defp is_accept_quest_action?(["accept_quest", qid], quest_id), do: qid == quest_id
  defp is_accept_quest_action?([:accept_quest, qid], quest_id), do: qid == quest_id
  defp is_accept_quest_action?(_, _), do: false

  defp validate_rewards(nil, errors), do: errors

  defp validate_rewards(rewards, errors) when is_map(rewards) do
    # Validate items exist
    items = rewards["items"] || []

    if is_list(items) do
      Enum.reduce(items, errors, fn item, acc ->
        case check_item_exists(item) do
          :ok ->
            acc

          :not_found ->
            [
              {"rewards.items", "Item '#{item}' not found",
               "Verify item key or create the item first"}
              | acc
            ]
        end
      end)
    else
      [{"rewards.items", "Must be a list", nil} | errors]
    end
  end

  defp validate_rewards(_, errors) do
    [{"rewards", "Must be an object", nil} | errors]
  end

  # ===========================================================================
  # NPC Validation
  # ===========================================================================

  defp validate_npc(data) do
    errors = []
    warnings = []

    errors = check_required(errors, data, "key", "Unique NPC key")
    errors = check_required(errors, data, "short_desc", "Short description")

    # Key format
    errors =
      if data["key"] && !Regex.match?(~r/^[a-z][a-z0-9_]*$/, to_string(data["key"])) do
        [{"key", "Must be lowercase with underscores", nil} | errors]
      else
        errors
      end

    errors =
      if data["type"] && data["type"] != "npc" do
        [{"type", "Must be 'npc' for NPC prototypes", nil} | errors]
      else
        errors
      end

    # Check parent exists
    warnings =
      if data["parent"] do
        case check_prototype_exists(data["parent"]) do
          :ok ->
            warnings

          :not_found ->
            [
              {"parent", "Parent '#{data["parent"]}' not found", "Verify the parent key exists"}
              | warnings
            ]
        end
      else
        warnings
      end

    # Validate dialogue tree quest conventions
    {dialogue_errors, dialogue_warnings} = validate_npc_dialogue_conventions(data)
    errors = dialogue_errors ++ errors
    warnings = dialogue_warnings ++ warnings

    {Enum.reverse(errors), Enum.reverse(warnings)}
  end

  # Validates NPC dialogue tree follows quest-aware conventions
  # Checks for: start_active, start_completed, start_ready_to_turn_in nodes
  # when NPC has quests or accept_quest/complete_quest actions
  defp validate_npc_dialogue_conventions(data) do
    npc_key = data["key"] || "unknown"
    components = data["components"] || %{}
    dialogue_tree = Map.get(components, "dialogue_tree") || %{}

    # Find quests this NPC is involved with
    quest_ids = find_npc_quest_ids(data, dialogue_tree)

    if Enum.empty?(quest_ids) or map_size(dialogue_tree) == 0 do
      {[], []}
    else
      # Check each quest for proper dialogue state coverage
      Enum.reduce(quest_ids, {[], []}, fn quest_id, {errs, warns} ->
        {q_errors, q_warnings} = validate_dialogue_for_quest(dialogue_tree, quest_id, npc_key)
        {q_errors ++ errs, q_warnings ++ warns}
      end)
    end
  end

  # Finds all quest IDs this NPC is involved with (via quests list or dialogue actions)
  defp find_npc_quest_ids(data, dialogue_tree) do
    # From explicit quests list
    explicit_quests =
      (data["quests"] || [])
      |> Enum.filter(&is_binary/1)

    # From accept_quest actions in dialogue
    accept_quests = find_quest_actions_in_dialogue(dialogue_tree, "accept_quest")

    # From complete_quest actions in dialogue
    complete_quests = find_quest_actions_in_dialogue(dialogue_tree, "complete_quest")

    (explicit_quests ++ accept_quests ++ complete_quests)
    |> Enum.uniq()
  end

  # Finds quest IDs from specific action types in dialogue tree
  defp find_quest_actions_in_dialogue(dialogue_tree, action_type) when is_map(dialogue_tree) do
    Enum.flat_map(dialogue_tree, fn {_node_id, node} when is_map(node) ->
      choices = Map.get(node, "choices") || []

      Enum.flat_map(choices, fn choice ->
        case Map.get(choice, "action") do
          [^action_type, quest_id] when is_binary(quest_id) -> [quest_id]
          _ -> []
        end
      end)
    end)
  end

  defp find_quest_actions_in_dialogue(_, _), do: []

  # Validates dialogue tree has proper state coverage for a specific quest
  defp validate_dialogue_for_quest(dialogue_tree, quest_id, npc_key) do
    errors = []
    warnings = []

    # Check if NPC gives this quest (has accept_quest action)
    has_accept = has_action_for_quest?(dialogue_tree, "accept_quest", quest_id)

    # Check if NPC completes this quest (has complete_quest action)
    has_complete = has_action_for_quest?(dialogue_tree, "complete_quest", quest_id)

    # If NPC gives or completes the quest, check for state nodes
    if has_accept or has_complete do
      # Check for start_active node for this quest
      has_active_node = has_conditional_start_for_quest?(dialogue_tree, "quest_active", quest_id)

      warnings =
        if has_active_node do
          warnings
        else
          [
            {"dialogue_tree", "NPC '#{npc_key}' has no start_active node for quest '#{quest_id}'",
             "Add a start_active node with show_if: {quest_active: \"#{quest_id}\"} to show reminder dialogue"}
            | warnings
          ]
        end

      # Check for start_completed node for this quest
      has_completed_node =
        has_conditional_start_for_quest?(dialogue_tree, "quest_completed", quest_id) or
          has_completed_quest_node?(dialogue_tree, quest_id)

      warnings =
        if has_completed_node do
          warnings
        else
          [
            {"dialogue_tree",
             "NPC '#{npc_key}' has no start_completed node for quest '#{quest_id}'",
             "Add a start_completed node with completed_quest: \"#{quest_id}\" for post-completion dialogue"}
            | warnings
          ]
        end

      # If NPC completes the quest, check for turn-in ready node
      if has_complete do
        has_ready_node =
          has_conditional_start_for_quest?(dialogue_tree, "quest_complete", quest_id)

        warnings =
          if has_ready_node do
            warnings
          else
            [
              {"dialogue_tree",
               "NPC '#{npc_key}' has no start_ready_to_turn_in node for quest '#{quest_id}'",
               "Add a start_ready_to_turn_in node with show_if: {quest_complete: \"#{quest_id}\"} to prompt turn-in"}
              | warnings
            ]
          end

        {errors, warnings}
      else
        {errors, warnings}
      end
    else
      {errors, warnings}
    end
  end

  # Checks if dialogue tree has an action for specific quest
  defp has_action_for_quest?(dialogue_tree, action_type, quest_id) when is_map(dialogue_tree) do
    Enum.any?(dialogue_tree, fn {_node_id, node} when is_map(node) ->
      # Check node-level action
      node_action_matches =
        case Map.get(node, "action") do
          [^action_type, ^quest_id] -> true
          _ -> false
        end

      # Check choice-level actions
      choices = Map.get(node, "choices") || []

      choice_action_matches =
        Enum.any?(choices, fn choice ->
          case Map.get(choice, "action") do
            [^action_type, ^quest_id] -> true
            _ -> false
          end
        end)

      node_action_matches or choice_action_matches
    end)
  end

  defp has_action_for_quest?(_, _, _), do: false

  # Checks if dialogue tree has a start node with show_if condition for quest
  defp has_conditional_start_for_quest?(dialogue_tree, condition_type, quest_id)
       when is_map(dialogue_tree) do
    Enum.any?(dialogue_tree, fn {node_id, node} when is_map(node) ->
      is_start_node = is_binary(node_id) and String.starts_with?(node_id, "start")

      show_if = Map.get(node, "show_if") || %{}
      condition_matches = Map.get(show_if, condition_type) == quest_id

      is_start_node and condition_matches
    end)
  end

  defp has_conditional_start_for_quest?(_, _, _), do: false

  # Checks if dialogue tree has a start node with completed_quest key
  defp has_completed_quest_node?(dialogue_tree, quest_id) when is_map(dialogue_tree) do
    Enum.any?(dialogue_tree, fn {node_id, node} when is_map(node) ->
      is_start_node = is_binary(node_id) and String.starts_with?(node_id, "start")
      completed_quest = Map.get(node, "completed_quest")

      is_start_node and completed_quest == quest_id
    end)
  end

  defp has_completed_quest_node?(_, _), do: false

  # ===========================================================================
  # Room Validation
  # ===========================================================================

  defp validate_room(data) do
    errors = []
    warnings = []

    errors = check_required(errors, data, "key", "Unique room key")
    errors = check_required(errors, data, "short_desc", "Room name")

    # Key format
    errors =
      if data["key"] && !Regex.match?(~r/^[a-z][a-z0-9_]*$/, to_string(data["key"])) do
        [{"key", "Must be lowercase with underscores", nil} | errors]
      else
        errors
      end

    errors =
      if data["type"] && data["type"] != "room" do
        [{"type", "Must be 'room' for room prototypes", nil} | errors]
      else
        errors
      end

    # Validate exits
    exits = data["exits"] || %{}
    valid_dirs = ["north", "south", "east", "west", "up", "down"]

    errors =
      if is_map(exits) do
        Enum.reduce(exits, errors, fn {dir, _target}, acc ->
          if dir in valid_dirs do
            acc
          else
            [{"exits.#{dir}", "Invalid direction", "Use: #{Enum.join(valid_dirs, ", ")}"} | acc]
          end
        end)
      else
        [{"exits", "Must be an object", nil} | errors]
      end

    # Warn about unconnected rooms
    warnings =
      if is_map(exits) do
        Enum.reduce(exits, warnings, fn {_dir, target}, acc ->
          case check_room_exists(target) do
            :ok ->
              acc

            :not_found ->
              [
                {"exits", "Room '#{target}' not found", "Create the target room or fix the key"}
                | acc
              ]
          end
        end)
      else
        warnings
      end

    # Check parent exists
    warnings =
      if data["parent"] do
        case check_prototype_exists(data["parent"]) do
          :ok ->
            warnings

          :not_found ->
            [
              {"parent", "Parent '#{data["parent"]}' not found", "Verify the parent key exists"}
              | warnings
            ]
        end
      else
        warnings
      end

    {Enum.reverse(errors), Enum.reverse(warnings)}
  end

  # ===========================================================================
  # Storyline Validation
  # ===========================================================================

  defp validate_storyline(data) do
    errors = []
    warnings = []

    errors = check_required(errors, data, "key", "Unique storyline key")
    errors = check_required(errors, data, "name", "Storyline name")
    errors = check_required(errors, data, "acts", "List of acts")

    # Key format
    errors =
      if data["key"] && !Regex.match?(~r/^[a-z][a-z0-9_]*$/, to_string(data["key"])) do
        [{"key", "Must be lowercase with underscores", nil} | errors]
      else
        errors
      end

    acts = data["acts"] || []

    errors =
      if is_list(acts) && Enum.empty?(acts) do
        [{"acts", "At least one act is required", nil} | errors]
      else
        errors
      end

    # Validate each act
    {errors, warnings} =
      if is_list(acts) do
        acts
        |> Enum.with_index()
        |> Enum.reduce({errors, warnings}, fn {act, idx}, {errs, warns} ->
          validate_act(act, idx, errs, warns)
        end)
      else
        {[{"acts", "Must be a list", nil} | errors], warnings}
      end

    {Enum.reverse(errors), Enum.reverse(warnings)}
  end

  defp validate_act(act, idx, errors, warnings) when is_map(act) do
    prefix = "acts[#{idx}]"

    errors = check_required(errors, act, "id", "Act ID", prefix)
    errors = check_required(errors, act, "name", "Act name", prefix)
    errors = check_required(errors, act, "quests", "Quest list", prefix)

    quests = act["quests"] || []

    errors =
      if is_list(quests) && Enum.empty?(quests) do
        [{"#{prefix}.quests", "At least one quest is required per act", nil} | errors]
      else
        errors
      end

    # Warn about missing quests
    warnings =
      if is_list(quests) do
        Enum.reduce(quests, warnings, fn quest_id, acc ->
          case check_quest_exists(quest_id) do
            :ok ->
              acc

            :not_found ->
              [
                {"#{prefix}.quests", "Quest '#{quest_id}' not found",
                 "Create the quest or fix the ID"}
                | acc
              ]
          end
        end)
      else
        warnings
      end

    {errors, warnings}
  end

  defp validate_act(_act, idx, errors, warnings) do
    {[{"acts[#{idx}]", "Must be an object", nil} | errors], warnings}
  end

  # ===========================================================================
  # Helper Functions
  # ===========================================================================

  defp check_required(errors, data, field, _description, prefix \\ nil) do
    full_field = if prefix, do: "#{prefix}.#{field}", else: field

    if is_nil(data[field]) || data[field] == "" do
      [{full_field, "Required field is missing", nil} | errors]
    else
      errors
    end
  end

  defp check_prototype_exists(key) do
    case TypedObject.Loader.get(key) do
      {:error, :not_found} -> :not_found
      {:ok, _} -> :ok
    end
  end

  defp check_item_exists(key), do: check_prototype_exists(key)

  defp check_room_exists(key) do
    case TypedObject.Loader.get(key) do
      {:error, :not_found} -> :not_found
      {:ok, proto} -> if proto.subtype == :room, do: :ok, else: :not_found
    end
  end

  defp check_quest_exists(quest_id) do
    case Loka.Framework.Quest.QuestRegistry.get(quest_id) do
      nil -> :not_found
      _ -> :ok
    end
  end

  defp format_messages(messages) do
    Enum.map(messages, fn
      {field, message, nil} ->
        %{field: field, message: message, suggestion: nil}

      {field, message, suggestion} ->
        %{field: field, message: message, suggestion: suggestion}
    end)
  end
end
