defmodule Loka.Testing.AIEval.EvalContext do
  @moduledoc """
  Provides an isolated eval environment for AI testing.

  Isolates both YAML paths and database entities. On enter, snapshots
  all existing entity IDs. On exit, deletes any entities created during
  the eval and restores the original world path.

      EvalContext.enter(:eval)
      # ... run eval scenarios (creates entities in DB) ...
      EvalContext.exit()
      # All eval-created entities are deleted, paths restored
  """

  require Logger

  alias Loka.Engine.Entities
  alias Loka.Testing.AIEval.WorldTarget

  @original_env_key :loka_eval_original_world_base_path
  @snapshot_key :loka_eval_entity_snapshot

  @doc """
  Enter the eval context for the given world target.
  Snapshots existing entity IDs and sets up isolated paths.
  """
  @spec enter(WorldTarget.world()) :: :ok
  def enter(world \\ :eval) do
    config = WorldTarget.config(world)

    # Save original world path
    original = Application.get_env(:loka, :world_base_path)
    Process.put(@original_env_key, original)

    # Snapshot existing entity IDs before eval creates anything
    existing_ids =
      Entities.find_all([])
      |> Enum.map(& &1.id)
      |> MapSet.new()

    Process.put(@snapshot_key, existing_ids)

    Logger.info(
      "[EvalContext] Entered eval context (#{MapSet.size(existing_ids)} existing entities)"
    )

    # Override world base path
    Application.put_env(:loka, :world_base_path, config.base_path)

    # Ensure directories exist
    WorldTarget.ensure_dirs!(world)

    :ok
  end

  @doc """
  Exit the eval context. Deletes all entities created during eval
  and restores original paths.
  """
  @spec exit() :: :ok
  def exit do
    # Clean up eval-created entities
    cleanup_entities()

    # Restore original world path
    case Process.get(@original_env_key) do
      nil ->
        Application.delete_env(:loka, :world_base_path)

      original ->
        Application.put_env(:loka, :world_base_path, original)
    end

    Process.delete(@original_env_key)
    Process.delete(@snapshot_key)
    :ok
  end

  @doc """
  Execute a function within the eval context.
  Automatically enters and exits (with cleanup).
  """
  @spec with_eval_context(WorldTarget.world(), (-> result)) :: result when result: any()
  def with_eval_context(world \\ :eval, fun) do
    enter(world)

    try do
      fun.()
    after
      __MODULE__.exit()
    end
  end

  @doc """
  Returns the current eval base path, or nil if not in eval context.
  """
  @spec current_base_path() :: String.t() | nil
  def current_base_path do
    Application.get_env(:loka, :world_base_path)
  end

  @doc """
  Check if we're currently in an eval context.
  """
  @spec in_eval_context?() :: boolean()
  def in_eval_context? do
    Process.get(@original_env_key) != nil
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp cleanup_entities do
    snapshot = Process.get(@snapshot_key)

    if snapshot do
      current_ids =
        Entities.find_all([])
        |> Enum.map(& &1.id)
        |> MapSet.new()

      new_ids = MapSet.difference(current_ids, snapshot)
      count = MapSet.size(new_ids)

      if count > 0 do
        Logger.info("[EvalContext] Cleaning up #{count} eval-created entities...")

        # Delete in reverse order to handle parent-child relationships
        # (children first, then parents)
        Enum.each(new_ids, fn id ->
          case Entities.delete(id) do
            {:ok, _} ->
              :ok

            {:error, :not_found} ->
              :ok

            {:error, reason} ->
              Logger.warning("[EvalContext] Failed to delete #{id}: #{inspect(reason)}")
          end
        end)

        Logger.info("[EvalContext] Cleanup complete")
      else
        Logger.info("[EvalContext] No eval entities to clean up")
      end
    end
  end
end
