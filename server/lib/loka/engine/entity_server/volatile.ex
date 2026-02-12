defmodule Loka.Engine.EntityServer.Volatile do
  @moduledoc """
  Process dictionary helpers for transient state within EntityServer.

  Volatile state is per-process, non-persisted data used by behaviors for
  things like combat targets, dialogue cursors, tick counts, patrol waypoints.

  ## Important

  - **Must NOT be called from spawned Tasks** — process dictionary is per-process.
  - Volatile state is lost on process restart (that's the point).
  - EntityServer manages the lifecycle: sets up volatile before calling behaviors,
    reads it back after.

  ## Usage (inside a behavior's on_event/3)

      alias Loka.Engine.EntityServer.Volatile

      def on_event(entity, :tick, _payload) do
        count = Volatile.get(:tick_count, 0)
        Volatile.set(:tick_count, count + 1)
        {:ok, entity}
      end
  """

  @volatile_key :entity_volatile

  @doc "Gets a volatile state value by key."
  @spec get(term(), term()) :: term()
  def get(key, default \\ nil) do
    vol = Process.get(@volatile_key, %{})
    Map.get(vol, key, default)
  end

  @doc "Sets a volatile state value."
  @spec set(term(), term()) :: term()
  def set(key, value) do
    vol = Process.get(@volatile_key, %{})
    Process.put(@volatile_key, Map.put(vol, key, value))
    value
  end

  @doc "Deletes a volatile state key."
  @spec delete(term()) :: :ok
  def delete(key) do
    vol = Process.get(@volatile_key, %{})
    Process.put(@volatile_key, Map.delete(vol, key))
    :ok
  end

  @doc "Returns the entire volatile state map."
  @spec all() :: map()
  def all do
    Process.get(@volatile_key, %{})
  end

  @doc "Replaces the entire volatile state map."
  @spec put_all(map()) :: :ok
  def put_all(state) when is_map(state) do
    Process.put(@volatile_key, state)
    :ok
  end

  @doc "Clears all volatile state."
  @spec clear() :: :ok
  def clear do
    Process.put(@volatile_key, %{})
    :ok
  end
end
