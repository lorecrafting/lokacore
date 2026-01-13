defmodule Loka.Engine.Scripts do
  @moduledoc """
  Context for managing sandboxed Elixir scripts in the database.

  Provides CRUD operations for scripts stored in the `scripts` table.

  > **Note:** This DB context is kept for future use when non-technical builders
  > need UI-based script editing. Currently, YAML files in `priv/world/scripts/`
  > are the primary source of truth via `Loka.Content.Script`.
  > See CLAUDE.md for the YAML-only architecture decision.

  ## Current Usage

  For most use cases, prefer `Loka.Content.Script` which loads from YAML:

      # Preferred: Load from YAML
      Loka.Content.Script.all()
      Loka.Content.Script.get("guard_on_enter")

  This DB context will be used when:
  - Non-technical builders create scripts via Admin UI
  - Runtime script overrides are needed (future feature)
  """

  import Ecto.Query
  alias Loka.Repo
  alias Loka.Engine.Schema.ScriptSchema

  # =============================================================================
  # Script CRUD
  # =============================================================================

  @doc """
  Lists all scripts, with optional filtering.

  ## Options
    - `:enabled` - Filter by enabled status
    - `:hook` - Filter by hook type
  """
  def list_scripts(opts \\ []) do
    ScriptSchema
    |> filter_by_enabled(opts[:enabled])
    |> filter_by_hook(opts[:hook])
    |> order_by([s], asc: s.name)
    |> Repo.all()
  end

  @doc """
  Gets a single script by ID.
  """
  def get_script(id) do
    Repo.get(ScriptSchema, id)
  end

  @doc """
  Gets a single script by ID, raises if not found.
  """
  def get_script!(id) do
    Repo.get!(ScriptSchema, id)
  end

  @doc """
  Gets a single script by name.
  """
  def get_script_by_name(name) when is_binary(name) do
    Repo.get_by(ScriptSchema, name: name)
  end

  @doc """
  Creates a new script.
  """
  def create_script(attrs) do
    %ScriptSchema{}
    |> ScriptSchema.changeset(normalize_attrs(attrs))
    |> Repo.insert()
  end

  @doc """
  Updates an existing script.
  """
  def update_script(%ScriptSchema{} = script, attrs) do
    script
    |> ScriptSchema.changeset(normalize_attrs(attrs))
    |> Repo.update()
  end

  @doc """
  Deletes a script.
  """
  def delete_script(%ScriptSchema{} = script) do
    Repo.delete(script)
  end

  @doc """
  Returns a changeset for tracking script changes.
  """
  def change_script(%ScriptSchema{} = script, attrs \\ %{}) do
    ScriptSchema.changeset(script, normalize_attrs(attrs))
  end

  # =============================================================================
  # Script Operations
  # =============================================================================

  @doc """
  Enables a script.
  """
  def enable_script(%ScriptSchema{} = script) do
    update_script(script, %{enabled: true})
  end

  @doc """
  Disables a script.
  """
  def disable_script(%ScriptSchema{} = script) do
    update_script(script, %{enabled: false})
  end

  @doc """
  Toggles a script's enabled status.
  """
  def toggle_script(%ScriptSchema{enabled: enabled} = script) do
    update_script(script, %{enabled: !enabled})
  end

  @doc """
  Tests a script by executing it with a mock entity.

  Returns `{:ok, result}` on success or `{:error, reason}` on failure.
  """
  def test_script(%ScriptSchema{source: source}) do
    test_entity = %Loka.Engine.Entity{
      id: "test-entity",
      type: :npc,
      key: "test_npc",
      short_desc: "Test NPC",
      long_desc: "A test NPC stands here.",
      extra_desc: "A test entity for script validation."
    }

    Loka.Engine.Scripting.execute(source, test_entity, %{test: true})
  end

  def test_script(source) when is_binary(source) do
    test_entity = %Loka.Engine.Entity{
      id: "test-entity",
      type: :npc,
      key: "test_npc",
      short_desc: "Test NPC",
      long_desc: "A test NPC stands here.",
      extra_desc: "A test entity for script validation."
    }

    Loka.Engine.Scripting.execute(source, test_entity, %{test: true})
  end

  # =============================================================================
  # Statistics
  # =============================================================================

  @doc """
  Counts all scripts.
  """
  def count_scripts do
    Repo.aggregate(ScriptSchema, :count)
  end

  @doc """
  Counts enabled scripts.
  """
  def count_enabled_scripts do
    ScriptSchema
    |> where([s], s.enabled == true)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts scripts by hook type.
  """
  def count_by_hook(hook) do
    ScriptSchema
    |> where([s], s.hook == ^hook)
    |> Repo.aggregate(:count)
  end

  # =============================================================================
  # Bulk Operations
  # =============================================================================

  @doc """
  Returns all enabled scripts for a specific hook.
  """
  def get_scripts_for_hook(hook) do
    list_scripts(enabled: true, hook: hook)
  end

  @doc """
  Returns a map of hook -> scripts for all enabled scripts.
  """
  def get_all_enabled_scripts_by_hook do
    list_scripts(enabled: true)
    |> Enum.group_by(& &1.hook)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp filter_by_enabled(query, nil), do: query

  defp filter_by_enabled(query, enabled) do
    where(query, [s], s.enabled == ^enabled)
  end

  defp filter_by_hook(query, nil), do: query

  defp filter_by_hook(query, hook) do
    where(query, [s], s.hook == ^hook)
  end

  defp normalize_attrs(attrs) when is_map(attrs) do
    attrs
    |> Enum.map(fn
      {key, value} when is_atom(key) -> {key, value}
      {key, value} when is_binary(key) -> {String.to_existing_atom(key), value}
    end)
    |> Map.new()
  rescue
    ArgumentError -> attrs
  end
end
