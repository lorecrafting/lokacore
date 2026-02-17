defmodule Loka.Testing.AIEval.EvalContext do
  @moduledoc """
  Provides an isolated eval environment for AI testing.

  Wraps ToolExecutor to redirect all content operations to the eval
  directory (`priv/world/eval/`) instead of the real game world.

  ## How isolation works

  Uses `Application.put_env` to temporarily override the world base path
  during eval execution. The eval context is entered/exited explicitly:

      EvalContext.enter(:eval)
      # ... run eval scenarios ...
      EvalContext.exit()

  This approach works because `WorldPaths.world_dir/0` can be made to read
  from config. For eval, we use a simpler approach: we directly call ToolExecutor
  but override file paths in the input where applicable.
  """

  alias Loka.Testing.AIEval.WorldTarget

  @original_env_key :loka_eval_original_world_base_path

  @doc """
  Enter the eval context for the given world target.
  Sets up directories and overrides paths.
  """
  @spec enter(WorldTarget.world()) :: :ok
  def enter(world \\ :eval) do
    config = WorldTarget.config(world)

    # Save original value
    original = Application.get_env(:loka, :world_base_path)
    Process.put(@original_env_key, original)

    # Override world base path
    Application.put_env(:loka, :world_base_path, config.base_path)

    # Ensure directories exist
    WorldTarget.ensure_dirs!(world)

    :ok
  end

  @doc """
  Exit the eval context and restore original paths.
  """
  @spec exit() :: :ok
  def exit do
    case Process.get(@original_env_key) do
      nil ->
        Application.delete_env(:loka, :world_base_path)

      original ->
        Application.put_env(:loka, :world_base_path, original)
    end

    Process.delete(@original_env_key)
    :ok
  end

  @doc """
  Execute a function within the eval context.
  Automatically enters and exits the context.
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
end
