defmodule Loka.Engine.Spawner.Editor do
  @moduledoc """
  Direct entity creation for the admin dashboard.

  Unlike prototype-based spawning, these functions create entities directly
  without requiring YAML files. Primarily used by the admin map editor.

  ## Usage

      # Create a room from the editor
      {:ok, room} = Editor.create_room(name: "Dark Cave", x: 5, y: 3)

      # Create an exit between rooms
      {:ok, exit} = Editor.create_exit(
        direction: "north",
        source_id: room_a.id,
        destination_id: room_b.id
      )
  """

  alias Loka.Engine.{Entity, Entities, Hooks, Directions}

  require Logger

  @doc """
  Creates a room entity directly without a prototype.

  This is the primary creation method for the admin dashboard, allowing rooms
  to be created on-the-fly without YAML files.

  ## Options

  - `:key` - Room key (auto-generated from short_desc if not provided)
  - `:short_desc` - Room name/title (required)
  - `:long_desc` - Room long description for listings
  - `:extra_desc` - Detailed room description (default: "")
  - `:x`, `:y`, `:z` - Coordinates (default: 0, 0, 0)
  - `:tags` - List of tags (default: [])
  - `:components` - Additional components to merge (default: %{})

  ## Examples

      {:ok, room} = Editor.create_room(short_desc: "Dark Cave", x: 5, y: 3)
      {:ok, room} = Editor.create_room(short_desc: "Tower", key: "tower_base", z: 1)
  """
  @spec create_room(keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def create_room(attrs) do
    # Support legacy :name attr for backward compat
    short_desc = Keyword.get(attrs, :short_desc) || Keyword.get(attrs, :name)

    if is_nil(short_desc) or short_desc == "" do
      {:error, :name_required}
    else
      key = Keyword.get(attrs, :key) || generate_unique_key(short_desc)
      long_desc = Keyword.get(attrs, :long_desc)
      extra_desc = Keyword.get(attrs, :extra_desc) || Keyword.get(attrs, :description, "")
      x = Keyword.get(attrs, :x, 0)
      y = Keyword.get(attrs, :y, 0)
      z = Keyword.get(attrs, :z, 0)
      tags = Keyword.get(attrs, :tags, [])
      extra_components = Keyword.get(attrs, :components, %{})

      coordinates = %{"x" => x, "y" => y, "z" => z}
      # Merge extra_components first, then override coordinates from explicit x/y/z
      components = Map.merge(extra_components, %{"coordinates" => coordinates})

      room = %Entity{
        id: Ecto.UUID.generate(),
        type: :room,
        key: key,
        short_desc: short_desc,
        long_desc: long_desc,
        extra_desc: extra_desc,
        location_id: nil,
        components: components,
        traits: [],
        tags: tags,
        scripts: %{},
        metadata: %{
          created_at: DateTime.utc_now(),
          updated_at: DateTime.utc_now(),
          created_by: "editor"
        }
      }

      case Entities.save_entity(room) do
        {:ok, schema} ->
          Logger.info("Created room #{key} at (#{x}, #{y}, #{z})")
          {:ok, Entities.to_entity(schema)}

        {:error, changeset} ->
          {:error, {:save_failed, changeset}}
      end
    end
  end

  @doc """
  Creates an exit entity between two rooms.

  ## Options

  - `:direction` - Direction of exit (e.g., "north", "up") (required)
  - `:source_id` - ID of the source room (required)
  - `:destination_id` - ID of the destination room (required)
  - `:short_desc` - Exit name (default: capitalized direction)
  - `:long_desc` - Exit description (default: "An exit leading {direction}.")
  - `:create_return` - Whether to create return exit (default: false)

  ## Examples

      {:ok, exit} = Editor.create_exit(
        direction: "north",
        source_id: room_a.id,
        destination_id: room_b.id
      )

      # Create bidirectional exits
      {:ok, exits} = Editor.create_exit(
        direction: "north",
        source_id: room_a.id,
        destination_id: room_b.id,
        create_return: true
      )
  """
  @spec create_exit(keyword()) :: {:ok, Entity.t() | [Entity.t()]} | {:error, term()}
  def create_exit(attrs) do
    direction = Keyword.get(attrs, :direction)
    source_id = Keyword.get(attrs, :source_id)
    dest_id = Keyword.get(attrs, :destination_id)

    cond do
      is_nil(direction) -> {:error, :direction_required}
      is_nil(source_id) -> {:error, :source_id_required}
      is_nil(dest_id) -> {:error, :destination_id_required}
      true -> do_create_exit(attrs)
    end
  end

  # Private implementation

  defp do_create_exit(attrs) do
    direction = to_string(Keyword.get(attrs, :direction))
    source_id = Keyword.get(attrs, :source_id)
    dest_id = Keyword.get(attrs, :destination_id)
    create_return = Keyword.get(attrs, :create_return, false)

    # Check if exit already exists in this direction from source
    if exit_exists?(source_id, direction) do
      {:error, {:exit_exists, "Exit already exists: #{direction} from this room"}}
    else
      do_create_exit_unchecked(attrs, direction, source_id, dest_id, create_return)
    end
  end

  defp do_create_exit_unchecked(attrs, direction, source_id, dest_id, create_return) do
    # Get destination room for key reference
    dest_room = Entities.get_entity(dest_id)
    dest_key = if dest_room, do: Entities.to_entity(dest_room).key, else: nil

    source_room = Entities.get_entity(source_id)
    source_key = if source_room, do: Entities.to_entity(source_room).key, else: nil

    exit_key = "exit_#{source_key || source_id}_#{direction}"

    exit_entity = %Entity{
      id: Ecto.UUID.generate(),
      type: :exit,
      key: exit_key,
      short_desc:
        Keyword.get(attrs, :short_desc) || Keyword.get(attrs, :name, String.capitalize(direction)),
      long_desc:
        Keyword.get(attrs, :long_desc) ||
          Keyword.get(attrs, :description, "An exit leading #{direction}."),
      extra_desc: Keyword.get(attrs, :extra_desc, "An exit leading #{direction}."),
      keywords: [direction],
      location_id: source_id,
      components: %{
        "exit" => %{
          "direction" => direction,
          "destination_key" => dest_key,
          "destination_id" => dest_id
        }
      },
      traits: [],
      tags: ["exit"],
      scripts: %{},
      metadata: %{
        created_at: DateTime.utc_now(),
        updated_at: DateTime.utc_now(),
        created_by: "editor"
      }
    }

    case Entities.save_entity(exit_entity) do
      {:ok, schema} ->
        exit = Entities.to_entity(schema)
        Logger.info("Created exit #{exit_key} -> #{dest_key || dest_id}")

        # Trigger hooks for exit creation (for auto-layout)
        Hooks.run(:at_entity_creation, [exit, %{created_by: "spawner"}])

        if create_return do
          # Create return exit
          return_direction = Directions.opposite(direction)

          case create_exit(
                 direction: return_direction,
                 source_id: dest_id,
                 destination_id: source_id,
                 create_return: false
               ) do
            {:ok, return_exit} ->
              {:ok, [exit, return_exit]}

            {:error, reason} ->
              Logger.warning("Failed to create return exit: #{inspect(reason)}")
              {:ok, exit}
          end
        else
          {:ok, exit}
        end

      {:error, changeset} ->
        {:error, {:save_failed, changeset}}
    end
  end

  defp exit_exists?(source_id, direction) do
    direction = String.downcase(to_string(direction))

    Entities.get_contents(source_id)
    |> Enum.any?(fn entity ->
      entity.type == :exit &&
        get_exit_direction(entity) == direction
    end)
  end

  defp get_exit_direction(exit_entity) do
    # Exit data may be nested under "exit" key or directly in components
    components = exit_entity.components || %{}
    exit_data = Map.get(components, "exit", components)
    Map.get(exit_data, "direction", "") |> String.downcase()
  end

  @doc false
  def generate_unique_key(name) when is_binary(name) do
    slug =
      name
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/, "_")
      |> String.trim("_")

    short_id = Ecto.UUID.generate() |> String.split("-") |> List.first()
    "#{slug}_#{short_id}"
  end
end
