defmodule Loka.WorldBuilder.NPCPathExtractor do
  @moduledoc """
  Extracts patrol paths and wander constraints from NPCs for visualization.

  Used by the World Builder canvas to draw NPC movement paths on the map.

  Handles multiple data sources:
  - TypedObject structs with behaviors in data.behaviors
  - Entity maps with behavior_config in attributes
  """

  alias Loka.Engine.TypedObject

  @doc """
  Extracts all NPC paths from a list of entities.

  Returns a map of npc_key => path_info where path_info contains:
  - :patrol - list of room keys for patrol routes
  - :wander - wander configuration (zone, tags, etc.)
  """
  @spec extract_paths([map()]) :: %{String.t() => map()}
  def extract_paths(npcs) when is_list(npcs) do
    npcs
    |> Enum.map(&extract_npc_path/1)
    |> Enum.filter(&(&1 != nil))
    |> Map.new()
  end

  @doc """
  Extract path info from a single NPC.
  Handles both TypedObject structs and entity maps.
  """
  def extract_npc_path(%TypedObject{key: key} = npc) do
    # Try behaviors from data first, then attributes.behavior_config
    behaviors = get_behaviors(npc)
    patrol = extract_patrol_path(behaviors)
    wander = extract_wander_config(behaviors)

    # Also check attributes.behavior_config for patrol paths
    patrol = patrol || extract_patrol_from_attributes(npc)

    if patrol || wander do
      short_desc = get_in(npc.data, ["short_desc"]) || get_in(npc.data, [:short_desc])

      path_info = %{
        name: short_desc || npc.name || key,
        patrol: patrol,
        wander: wander
      }

      {key, path_info}
    else
      nil
    end
  end

  # Handle entity maps from EntityManager
  def extract_npc_path(%{key: key} = entity) when is_map(entity) do
    # Check attributes.behavior_config.patrol for path
    patrol = extract_patrol_from_entity_map(entity)

    if patrol do
      name =
        Map.get(entity, :name) ||
          get_in(entity, [:data, :primary_keyword]) ||
          key

      path_info = %{
        name: name,
        patrol: patrol,
        wander: nil
      }

      {key, path_info}
    else
      nil
    end
  end

  def extract_npc_path(_), do: nil

  # Extract patrol from entity map structure (attributes.behavior_config.patrol)
  defp extract_patrol_from_entity_map(entity) do
    behavior_config =
      get_in(entity, [:attributes, "behavior_config"]) ||
        get_in(entity, [:attributes, :behavior_config])

    case behavior_config do
      %{"patrol" => patrol_config} ->
        extract_patrol_config(patrol_config)

      %{patrol: patrol_config} ->
        extract_patrol_config(patrol_config)

      _ ->
        nil
    end
  end

  # Extract patrol from TypedObject attributes
  defp extract_patrol_from_attributes(%TypedObject{attributes: attrs}) when is_map(attrs) do
    behavior_config =
      Map.get(attrs, "behavior_config") || Map.get(attrs, :behavior_config)

    case behavior_config do
      %{"patrol" => patrol_config} ->
        extract_patrol_config(patrol_config)

      %{patrol: patrol_config} ->
        extract_patrol_config(patrol_config)

      _ ->
        nil
    end
  end

  defp extract_patrol_from_attributes(_), do: nil

  # Extract patrol config from the patrol map
  defp extract_patrol_config(patrol_config) when is_map(patrol_config) do
    # Path can be either "path" or "route" key
    route =
      Map.get(patrol_config, "path") ||
        Map.get(patrol_config, :path) ||
        Map.get(patrol_config, "route") ||
        Map.get(patrol_config, :route, [])

    if route != [] do
      %{
        route: route,
        loop: Map.get(patrol_config, "loop", true) || Map.get(patrol_config, :loop, true),
        interval:
          Map.get(patrol_config, "pause_seconds") ||
            Map.get(patrol_config, :pause_seconds) ||
            Map.get(patrol_config, "interval") ||
            Map.get(patrol_config, :interval)
      }
    else
      nil
    end
  end

  defp extract_patrol_config(_), do: nil

  defp get_behaviors(%TypedObject{data: data}) when is_map(data) do
    # Get behaviors from data (YAML uses string keys)
    Map.get(data, "behaviors") || Map.get(data, :behaviors, [])
  end

  defp get_behaviors(_), do: []

  defp extract_patrol_path(behaviors) when is_list(behaviors) do
    patrol_behavior =
      Enum.find(behaviors, fn b ->
        script = Map.get(b, "script") || Map.get(b, :script)
        script == "patrol" or script == :patrol
      end)

    case patrol_behavior do
      nil ->
        nil

      behavior ->
        config = Map.get(behavior, "config") || Map.get(behavior, :config, %{})
        route = Map.get(config, "route") || Map.get(config, :route, [])

        if route != [] do
          %{
            route: route,
            loop: Map.get(config, "loop", true) || Map.get(config, :loop, true),
            interval: Map.get(config, "interval") || Map.get(config, :interval)
          }
        else
          nil
        end
    end
  end

  defp extract_patrol_path(_), do: nil

  defp extract_wander_config(behaviors) when is_list(behaviors) do
    wander_behavior =
      Enum.find(behaviors, fn b ->
        script = Map.get(b, "script") || Map.get(b, :script)
        script == "wander" or script == :wander
      end)

    case wander_behavior do
      nil ->
        nil

      behavior ->
        config = Map.get(behavior, "config") || Map.get(behavior, :config, %{})

        %{
          zone: Map.get(config, "zone") || Map.get(config, :zone),
          room_tags: Map.get(config, "room_tags") || Map.get(config, :room_tags, []),
          avoid_tags: Map.get(config, "avoid_tags") || Map.get(config, :avoid_tags, []),
          interval: Map.get(config, "interval") || Map.get(config, :interval)
        }
    end
  end

  defp extract_wander_config(_), do: nil
end
