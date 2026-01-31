defmodule Loka.Engine.Schema.ScriptSchema do
  @moduledoc """
  Ecto schema for sandboxed Elixir scripts.

  Scripts can be attached to entities to customize their behavior. They are
  validated against the Elixir sandbox security rules before being saved.

  > **Note:** This DB schema is kept for future use when non-technical builders
  > need UI-based script editing. Currently, YAML files in `priv/world/scripts/`
  > are the primary source of truth. See CLAUDE.md for the YAML-only architecture.

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
        if player.level < 10 do
          message("The guard blocks your path!")
          deny()
        else
          continue()
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

  # Input validation limits
  @max_name_length 100
  @max_description_length 1_000
  @max_source_length 100_000

  @doc """
  Creates a changeset for script creation or update.
  """
  def changeset(script, attrs) do
    script
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:name, max: @max_name_length)
    |> validate_length(:description, max: @max_description_length)
    |> validate_length(:source, max: @max_source_length)
    |> unique_constraint(:name)
    |> validate_inclusion(:hook, @hooks ++ [nil])
    |> validate_script_source()
  end

  @doc """
  Returns the list of valid hook types.
  """
  def hooks, do: @hooks

  # Validate the Elixir source code against the sandbox security rules
  defp validate_script_source(changeset) do
    case get_change(changeset, :source) do
      nil ->
        changeset

      source ->
        case Loka.Engine.Script.Sandbox.validate(source) do
          :ok -> changeset
          {:error, reason} -> add_error(changeset, :source, "invalid: #{inspect(reason)}")
        end
    end
  end
end
