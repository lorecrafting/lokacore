defmodule Exmud.Engine.Schema.ScriptSchema do
  @moduledoc """
  Ecto schema for Lua scripts.

  Scripts can be attached to entities to customize their behavior. They are
  validated against the Lua sandbox security rules before being saved.

  ## Hooks

  Scripts can be assigned to specific hooks:
  - `on_enter` - Triggered when a player enters a room
  - `on_leave` - Triggered when a player leaves a room
  - `on_look` - Triggered when a player looks at the entity
  - `on_attack` - Triggered when the entity is attacked
  - `on_tick` - Triggered on world tick (periodic)
  - `on_say` - Triggered when someone speaks near the entity
  - `on_give` - Triggered when an item is given to the entity
  - `on_use` - Triggered when the entity is used

  ## Example

      %ScriptSchema{
        name: "guard_behavior",
        hook: "on_enter",
        source: ~S'''
        function on_enter(player)
          if player.level < 10 then
            game.message(player.id, "The guard blocks your path!")
            return false
          end
          return true
        end
        '''
      }
  """

  use Ecto.Schema
  import Ecto.Changeset

  @hooks ~w(on_enter on_leave on_look on_attack on_tick on_say on_give on_use custom)

  schema "scripts" do
    field :name, :string
    field :description, :string
    field :source, :string
    field :hook, :string
    field :enabled, :boolean, default: true

    timestamps(type: :utc_datetime)
  end

  @required_fields [:name, :source]
  @optional_fields [:description, :hook, :enabled]

  @doc """
  Creates a changeset for script creation or update.
  """
  def changeset(script, attrs) do
    script
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> unique_constraint(:name)
    |> validate_inclusion(:hook, @hooks ++ [nil])
    |> validate_script_source()
  end

  @doc """
  Returns the list of valid hook types.
  """
  def hooks, do: @hooks

  # Validate the Lua source code against the sandbox security rules
  defp validate_script_source(changeset) do
    case get_change(changeset, :source) do
      nil ->
        changeset

      source ->
        case Exmud.Engine.Scripting.validate_script(source) do
          :ok -> changeset
          {:error, reason} -> add_error(changeset, :source, "invalid: #{inspect(reason)}")
        end
    end
  end
end
