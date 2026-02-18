defmodule Loka.Engine.Spawner.Templates do
  @moduledoc """
  Template-based entity spawning.

  Templates (prototypes with `is_template: true`) are designed for multiple
  instantiation, unlike regular prototypes which are singletons. Each spawn
  from a template gets a unique key.
  """

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Engine.Spawner.Editor
  alias Loka.Utils.MapHelpers

  require Logger

  @spec spawn(String.t(), keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def spawn(template_key, opts \\ []) do
    with {:ok, template} <- Entities.find_one(key: template_key),
         :ok <- validate_is_template(template) do
      instance_key = Keyword.get(opts, :key) || generate_template_instance_key(template_key)

      case template.type do
        :room ->
          spawn_room_from_template(template, instance_key, opts)

        _other_type ->
          spawn_entity_from_template(template, instance_key, opts)
      end
    end
  end

  defp validate_is_template(%Entity{} = entity) do
    # V2: is_template is stored in metadata (not components["data"])
    is_template =
      get_in(entity.metadata, ["is_template"]) ||
        get_in(entity.metadata, [:is_template])

    if is_template == true do
      :ok
    else
      {:error, {:not_a_template, "#{entity.key} is not marked as a template (is_template: true)"}}
    end
  end

  defp generate_template_instance_key(template_key) do
    short_id = Ecto.UUID.generate() |> String.split("-") |> List.first()
    "#{template_key}_#{short_id}"
  end

  defp spawn_room_from_template(template, instance_key, opts) do
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
        room = %{room | metadata: Map.put(room.metadata, :template_key, template.key)}
        Logger.debug("Spawned room from template #{template.key} as #{instance_key}")
        {:ok, room}

      error ->
        error
    end
  end

  defp spawn_entity_from_template(template, instance_key, opts) do
    overrides = build_overrides(template, opts)
    entity = prototype_to_entity(template, overrides)
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

  defp prototype_to_entity(%Entity{} = prototype, overrides) do
    now = DateTime.utc_now()

    entity = %Entity{
      prototype
      | id: Ecto.UUID.generate(),
        is_prototype: false,
        prototype_key: prototype.key,
        metadata:
          Map.merge(prototype.metadata || %{}, %{
            created_at: now,
            updated_at: now,
            prototype_key: prototype.key
          })
    }

    entity
    |> maybe_apply_override(:short_desc, overrides)
    |> maybe_apply_override(:long_desc, overrides)
    |> maybe_apply_override(:extra_desc, overrides)
    |> maybe_apply_override(:keywords, overrides)
    |> maybe_apply_override(:mood, overrides)
    |> maybe_apply_override(:location_id, overrides)
    |> maybe_apply_override(:components, overrides)
    |> maybe_apply_override(:tags, overrides)
  end

  defp maybe_apply_override(entity, field, overrides) do
    case Map.get(overrides, field) do
      nil -> entity
      value -> Map.put(entity, field, value)
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
        :tags
      ])
      |> Map.new()

    overrides
    |> maybe_deep_merge(:components, prototype.components, Map.get(overrides, :components))
  end

  defp maybe_deep_merge(overrides, _field, _base, nil), do: overrides

  defp maybe_deep_merge(overrides, field, base, additions)
       when is_map(base) and is_map(additions) do
    Map.put(overrides, field, MapHelpers.deep_merge(base, additions))
  end

  defp maybe_deep_merge(overrides, _field, _base, _additions), do: overrides

  defp merge_tags(template_tags, override_tags) do
    (template_tags ++ override_tags) |> Enum.uniq()
  end

  defp merge_components(template_components, override_components) do
    MapHelpers.deep_merge(template_components, override_components)
  end
end
