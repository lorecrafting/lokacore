defmodule Loka.TypedObjectSandbox do
  @moduledoc """
  Test helper that provides isolated TypedObject.Registry access.

  Saves the current ETS state on checkout, clears the tables for the test,
  and restores the original state when the test exits. This prevents tests
  that call `Registry.clear()` from wiping production prototypes and causing
  cascading failures in other tests.

  ## Usage

      setup do
        Loka.TypedObjectSandbox.checkout()
        :ok
      end
  """

  alias Loka.Engine.TypedObject.Registry

  @tables [:typed_objects, :typed_objects_by_type, :typed_objects_by_tag]

  @doc """
  Saves current ETS state, clears the registry, and registers
  an `on_exit` callback to restore the original data.
  """
  def checkout do
    Registry.init()

    saved = save_state()
    Registry.clear()

    ExUnit.Callbacks.on_exit(fn ->
      restore_state(saved)
    end)

    :ok
  end

  defp save_state do
    Enum.map(@tables, fn table ->
      {table, :ets.tab2list(table)}
    end)
  end

  defp restore_state(saved) do
    Enum.each(saved, fn {table, entries} ->
      :ets.delete_all_objects(table)
      Enum.each(entries, fn entry -> :ets.insert(table, entry) end)
    end)
  end
end
