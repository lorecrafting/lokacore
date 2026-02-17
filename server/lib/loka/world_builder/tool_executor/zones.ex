defmodule Loka.WorldBuilder.ToolExecutor.Zones do
  @moduledoc false

  alias Loka.WorldBuilder.YamlBuilder
  alias Loka.WorldBuilder.ToolExecutor.Entities, as: EntityHelpers
  alias Loka.Content.Zone
  alias Loka.Engine.{Entity, Entities}

  # ---------------------------------------------------------------------------
  # Zone CRUD
  # ---------------------------------------------------------------------------

  def execute_get_zone_info(input) do
    zone_key = input["zone_key"]

    case Zone.get(zone_key) do
      {:ok, zone} ->
        data = (zone.components || %{})["data"] || %{}

        {:ok,
         %{
           success: true,
           zone: %{
             key: zone.key,
             name: zone.short_desc,
             description: zone.extra_desc,
             level_range: data["level_range"],
             rooms: data["rooms"] || [],
             tags: zone.tags || []
           }
         }}

      {:error, :not_found} ->
        {:error, "Zone not found: #{zone_key}"}
    end
  end

  def execute_list_zones(_input) do
    zones = Zone.all()

    zone_list =
      Enum.map(zones, fn zone ->
        rooms = get_zone_rooms(zone)

        %{
          key: zone.key,
          name: zone.short_desc || zone.key,
          room_count: length(rooms)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(zone_list)} zones",
       zones: zone_list
     }}
  end

  def execute_create_zone(input) do
    key = input["key"]
    name = input["name"]
    rooms = input["rooms"] || []
    reset_mode = input["reset_mode"] || "empty"

    entity =
      Entity.new(
        type: :zone,
        key: key,
        short_desc: name,
        is_prototype: true,
        components: %{
          "data" => %{
            "rooms" => rooms,
            "reset_mode" => reset_mode,
            "lifespan_minutes" => 0
          }
        },
        metadata: %{"draft" => true}
      )

    case Entities.save(entity) do
      {:ok, _} ->
        {:ok, warnings} = YamlBuilder.validate_references(:zone, %{rooms: rooms})
        message = "Created zone '#{name}' (#{key})"

        message =
          if warnings != [],
            do: message <> "\nWarnings: " <> Enum.join(warnings, "; "),
            else: message

        {:ok,
         %{
           success: true,
           message: message,
           zone: %{key: key, name: name}
         }}

      {:error, reason} ->
        {:error, "Failed to create zone: #{inspect(reason)}"}
    end
  end

  def execute_update_zone(input) do
    key = input["key"]

    case Zone.get(key) do
      {:ok, zone} ->
        updates = Map.drop(input, ["key"])
        zone_data = (zone.components || %{})["data"] || %{}
        updated_data = Enum.reduce(updates, zone_data, fn {k, v}, acc -> Map.put(acc, k, v) end)

        name = updates["name"] || zone.short_desc || key
        updated_components = Map.put(zone.components || %{}, "data", updated_data)

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated zone '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update zone: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Zone not found in DB: #{key}"}
        end

      {:error, :not_found} ->
        {:error, "Zone not found: #{key}"}
    end
  end

  def execute_delete_zone(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :zone} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted zone '#{key}'"}}

      _ ->
        {:error, "Zone not found: #{key}"}
    end
  end

  # ---------------------------------------------------------------------------
  # Cutscene CRUD
  # ---------------------------------------------------------------------------

  def execute_create_cutscene(input) do
    key = input["key"]
    name = input["name"]
    trigger = input["trigger"] || "manual"

    scenes =
      input["scenes"] ||
        [%{"type" => "narration", "text" => "A new scene begins...", "delay" => 2000}]

    entity =
      Entity.new(
        type: :cutscene,
        key: key,
        short_desc: name,
        is_prototype: true,
        components: %{"data" => %{"trigger" => trigger, "scenes" => scenes}},
        metadata: %{"draft" => true}
      )

    case Entities.save(entity) do
      {:ok, _} ->
        {:ok, warnings} = YamlBuilder.validate_references(:cutscene, %{scenes: scenes})
        message = "Created cutscene '#{name}' (#{key})"

        message =
          if warnings != [],
            do: message <> "\nWarnings: " <> Enum.join(warnings, "; "),
            else: message

        {:ok, %{success: true, message: message}}

      {:error, reason} ->
        {:error, "Failed to create cutscene: #{inspect(reason)}"}
    end
  end

  def execute_update_cutscene(input) do
    key = input["key"]

    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, cs} ->
        cs_data = (cs.components || %{})["data"] || %{}
        name = input["name"] || cs.short_desc || key
        trigger = input["trigger"] || cs_data["trigger"] || "manual"
        scenes = input["scenes"] || cs_data["scenes"] || []

        updated_components =
          Map.put(cs.components || %{}, "data", %{
            "trigger" => trigger,
            "scenes" => scenes
          })

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated cutscene '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update cutscene: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Cutscene not found in DB: #{key}"}
        end

      _ ->
        {:error, "Cutscene not found: #{key}"}
    end
  end

  def execute_delete_cutscene(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :cutscene} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted cutscene '#{key}'"}}

      _ ->
        {:error, "Cutscene not found: #{key}"}
    end
  end

  def execute_get_cutscene(input) do
    key = input["key"]

    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, cs} ->
        cs_data = (cs.components || %{})["data"] || %{}

        {:ok,
         %{
           success: true,
           cutscene: %{
             key: cs.key,
             name: cs.short_desc,
             trigger: cs_data["trigger"],
             scenes: cs_data["scenes"] || []
           }
         }}

      _ ->
        {:error, "Cutscene not found: #{key}"}
    end
  end

  def execute_list_cutscenes(_input) do
    cutscenes = Entities.find_all(type: :cutscene, is_prototype: true)

    list =
      Enum.map(cutscenes, fn c ->
        c_data = (c.components || %{})["data"] || %{}
        scenes = c_data["scenes"] || []
        %{key: c.key, name: c.short_desc || c.key, scene_count: length(scenes)}
      end)

    {:ok, %{success: true, message: "Found #{length(list)} cutscenes", cutscenes: list}}
  end

  # ---------------------------------------------------------------------------
  # Storyline CRUD
  # ---------------------------------------------------------------------------

  def execute_create_storyline(input) do
    key = input["key"]
    name = input["name"]
    main_quests = input["main_quests"] || []
    side_quests = input["side_quests"] || []

    entity =
      Entity.new(
        type: :storyline,
        key: key,
        short_desc: name,
        is_prototype: true,
        components: %{
          "data" => %{
            "main_quests" => main_quests,
            "side_quests" => side_quests
          }
        },
        metadata: %{"draft" => true}
      )

    case Entities.save(entity) do
      {:ok, _} ->
        {:ok, warnings} =
          YamlBuilder.validate_references(:storyline, %{
            main_quests: main_quests,
            side_quests: side_quests
          })

        message = "Created storyline '#{name}' (#{key})"

        message =
          if warnings != [],
            do: message <> "\nWarnings: " <> Enum.join(warnings, "; "),
            else: message

        {:ok, %{success: true, message: message}}

      {:error, reason} ->
        {:error, "Failed to create storyline: #{inspect(reason)}"}
    end
  end

  def execute_update_storyline(input) do
    key = input["key"]

    case Entities.find_one(key: key, type: :storyline) do
      {:ok, sl} ->
        sl_data = (sl.components || %{})["data"] || %{}
        name = input["name"] || sl.short_desc || key
        main_quests = input["main_quests"] || sl_data["main_quests"] || []
        side_quests = input["side_quests"] || sl_data["side_quests"] || []

        updated_components =
          Map.put(sl.components || %{}, "data", %{
            "main_quests" => main_quests,
            "side_quests" => side_quests
          })

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated storyline '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update storyline: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Storyline not found in DB: #{key}"}
        end

      _ ->
        {:error, "Storyline not found: #{key}"}
    end
  end

  def execute_delete_storyline(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :storyline} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted storyline '#{key}'"}}

      _ ->
        {:error, "Storyline not found: #{key}"}
    end
  end

  def execute_list_storylines(_input) do
    storylines = Entities.find_all(type: :storyline, is_prototype: true)

    list =
      Enum.map(storylines, fn s ->
        s_data = (s.components || %{})["data"] || %{}
        main = s_data["main_quests"] || []
        side = s_data["side_quests"] || []

        %{
          key: s.key,
          name: s.short_desc || s.key,
          main_quest_count: length(main),
          side_quest_count: length(side)
        }
      end)

    {:ok, %{success: true, message: "Found #{length(list)} storylines", storylines: list}}
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp get_zone_rooms(zone) do
    data = (EntityHelpers.get_safe_field(zone, :components) || %{})["data"] || %{}
    data["rooms"] || []
  end
end
