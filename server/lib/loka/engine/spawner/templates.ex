defmodule Loka.Engine.Spawner.Templates do
  @moduledoc """
  Template-based entity spawning.

  Templates (prototypes with `is_template: true`) are designed for multiple
  instantiation, unlike regular prototypes which are singletons. Each spawn
  from a template gets a unique key.

  This is useful for creating reusable room patterns (corridors, cells,
  guard rooms) that can be placed multiple times in the map editor.

  ## Usage

      # Spawn from a room template
      {:ok, room} = Templates.spawn("stone_corridor", x: 5, y: 3)

      # Spawn with custom description
      {:ok, room} = Templates.spawn("prison_cell",
        short_desc: "Cell Block A - Cell 1",
        x: 10, y: 5
      )

      # Spawn NPC template at location
      {:ok, npc} = Templates.spawn("dungeon_guard",
        location_id: room.id,
        short_desc: "Elite Guard"
      )
  """

  alias Loka.Engine.{Prototype, PrototypeLoader, Entity, Entities}
  alias Loka.Engine.Spawner.Editor
  alias Loka.Utils.MapHelpers

  require Logger

  @doc """
  Spawns an entity from a template prototype.

  ## Options

  - `:key` - Custom key for the instance (auto-generated if not provided)
  - `:short_desc` - Override the template's short description (name)
  - `:long_desc` - Override the template's room display sentence
  - `:extra_desc` - Override the template's examine text
  - `:x`, `:y`, `:z` - Coordinates for room templates (default: 0, 0, 0)
  - `:tags` - Additional tags to merge with template tags
  - `:components` - Additional components to merge with template components
  - `:location_id` - Location for non-room entities

  ## Examples

      {:ok, room} = Templates.spawn("stone_corridor", x: 5, y: 3)
      {:ok, npc} = Templates.spawn("dungeon_guard", location_id: room.id)
  """
  @spec spawn(String.t(), keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def spawn(template_key, opts \\ []) do
    with {:ok, template} <- PrototypeLoader.get(template_key),
         :ok <- validate_is_template(template) do
      # Generate unique instance key
      instance_key = Keyword.get(opts, :key) || generate_template_instance_key(template_key)

      case template.type do
        :room ->
          spawn_room_from_template(template, instance_key, opts)

        _other_type ->
          spawn_entity_from_template(template, instance_key, opts)
      end
    end
  end

  # Validation

  defp validate_is_template(%Prototype{} = proto) do
    if Prototype.template?(proto) do
      :ok
    else
      {:error, {:not_a_template, "#{proto.key} is not marked as a template (is_template: true)"}}
    end
  end

  # Key Generation

  defp generate_template_instance_key(template_key) do
    short_id = UUID.uuid4() |> String.split("-") |> List.first()
    "#{template_key}_#{short_id}"
  end

  # Room Template Spawning

  defp spawn_room_from_template(template, instance_key, opts) do
    # Use create_room with template values + overrides
    room_attrs = [
      key: instance_key,
      short_desc: Keyword.get(opts, :short_desc, template.short_desc),
      long_desc: Keyword.get(opts, :long_desc, template.long_desc),
      extra_desc: Keyword.get(opts, :extra_desc, template.extra_desc),
      x: Keyword.get(opts, :x, 0),
      y: Keyword.get(opts, :y, 0),
      z: Keyword.get(opts, :z, 0),
      tags: merge_tags(template.tags, Keyword.get(opts, :tags, [])),
      components: merge_components(template.components, Keyword.get(opts, :components, %{}))
    ]

    case Editor.create_room(room_attrs) do
      {:ok, room} ->
        # Update metadata to track template origin
        room = %{room | metadata: Map.put(room.metadata, :template_key, template.key)}
        Logger.debug("Spawned room from template #{template.key} as #{instance_key}")
        {:ok, room}

      error ->
        error
    end
  end

  # Entity Template Spawning

  defp spawn_entity_from_template(template, instance_key, opts) do
    # For non-room entities, build entity directly
    overrides = build_overrides(template, opts)
    entity = Prototype.to_entity(template, overrides)
    entity = %{entity | key: instance_key}

    case Entities.save_entity(entity) do
      {:ok, schema} ->
        saved_entity = Entities.to_entity(schema)
        Logger.debug("Spawned entity from template #{template.key} as #{instance_key}")
        {:ok, saved_entity}

      {:error, changeset} ->
        {:error, {:save_failed, changeset}}
    end
  end

  defp build_overrides(prototype, opts) do
    overrides =
      opts
      |> Keyword.take([
        :short_desc,
        :long_desc,
        :extra_desc,
        :keywords,
        :mood,
        :location_id,
        :components,
        :attributes,
        :tags
      ])
      |> Map.new()

    # Deep merge components and attributes with prototype values
    overrides
    |> maybe_deep_merge(:components, prototype.components, Map.get(overrides, :components))
    |> maybe_deep_merge(:attributes, prototype.attributes, Map.get(overrides, :attributes))
  end

  defp maybe_deep_merge(overrides, _field, _base, nil), do: overrides

  defp maybe_deep_merge(overrides, field, base, additions)
       when is_map(base) and is_map(additions) do
    Map.put(overrides, field, MapHelpers.deep_merge(base, additions))
  end

  defp maybe_deep_merge(overrides, _field, _base, _additions), do: overrides

  # Merge Helpers

  defp merge_tags(template_tags, override_tags) do
    (template_tags ++ override_tags) |> Enum.uniq()
  end

  defp merge_components(template_components, override_components) do
    MapHelpers.deep_merge(template_components, override_components)
  end
end
