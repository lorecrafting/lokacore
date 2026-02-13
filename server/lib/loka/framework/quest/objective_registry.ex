defmodule Loka.Framework.Quest.ObjectiveRegistry do
  @moduledoc """
  Registry for quest objective handlers.

  Maps objective types to handler modules. In V2 this is a simple compile-time
  dispatch map (no GenServer needed).

  ## Built-in Handlers

  - `Loka.Framework.Quest.Handlers.KillHandler` - `:kill`
  - `Loka.Framework.Quest.Handlers.GetItemHandler` - `:get_item`
  - `Loka.Framework.Quest.Handlers.GoToHandler` - `:go_to`
  - `Loka.Framework.Quest.Handlers.TalkHandler` - `:talk`
  - `Loka.Framework.Quest.Handlers.CraftHandler` - `:craft`
  """

  alias Loka.Framework.Quest.ObjectiveHandler

  @handlers %{
    kill: Loka.Framework.Quest.Handlers.KillHandler,
    get_item: Loka.Framework.Quest.Handlers.GetItemHandler,
    go_to: Loka.Framework.Quest.Handlers.GoToHandler,
    talk: Loka.Framework.Quest.Handlers.TalkHandler,
    craft: Loka.Framework.Quest.Handlers.CraftHandler
  }

  @doc """
  Gets the handler module for an objective type.
  """
  def get(type) when is_atom(type) do
    case Map.get(@handlers, type) do
      nil -> {:error, :not_found}
      handler -> {:ok, handler}
    end
  end

  # Accept optional server arg for backwards-compat (ignored)
  def get(type, _server), do: get(type)

  @doc """
  Gets the handler module for an objective type, raises if not found.
  """
  def get!(type) when is_atom(type) do
    case get(type) do
      {:ok, handler} -> handler
      {:error, :not_found} -> raise "No handler registered for objective type: #{type}"
    end
  end

  @doc """
  Lists all registered objective types.
  """
  def list_types, do: Map.keys(@handlers)
  def list_types(_server), do: list_types()

  @doc """
  Lists all registered handlers with their types.
  """
  def list_handlers, do: Enum.map(@handlers, fn {type, handler} -> {type, handler} end)
  def list_handlers(_server), do: list_handlers()

  @doc """
  Checks if a handler is registered for the given type.
  """
  def registered?(type) when is_atom(type), do: Map.has_key?(@handlers, type)
  def registered?(type, _server), do: registered?(type)

  @doc """
  Checks if an event matches an objective and returns progress update info.

  Returns:
  - `{:ok, handler, new_progress, is_complete}` if the event matches
  - `:no_match` if the event doesn't match this objective
  - `{:error, :unknown_type}` if no handler is registered for the objective type
  """
  def check_event(objective_def, event, current_progress, _server \\ nil) do
    type = get_objective_type(objective_def)

    case get(type) do
      {:ok, handler} ->
        if handler.matches?(objective_def, event) do
          new_progress = handler.progress(objective_def, event, current_progress)
          is_complete = handler.is_complete?(objective_def, new_progress)
          {:ok, handler, new_progress, is_complete}
        else
          :no_match
        end

      {:error, :not_found} ->
        {:error, :unknown_type}
    end
  end

  @doc """
  Validates an objective definition using its handler.
  """
  def validate_objective(objective_def, _server \\ nil) do
    type = get_objective_type(objective_def)

    case get(type) do
      {:ok, handler} -> handler.validate(objective_def)
      {:error, :not_found} -> {:error, "Unknown objective type: #{type}"}
    end
  end

  @doc """
  Gets a description for an objective using its handler.
  """
  def describe_objective(objective_def, progress, _server \\ nil) do
    type = get_objective_type(objective_def)

    case get(type) do
      {:ok, handler} ->
        if function_exported?(handler, :description, 2) do
          handler.description(objective_def, progress)
        else
          ObjectiveHandler.default_description(objective_def, progress)
        end

      {:error, :not_found} ->
        ObjectiveHandler.default_description(objective_def, progress)
    end
  end

  # No-op for backwards compat — callers that try to register/start
  def register(_handler_module, _server \\ nil), do: :ok
  def start_link(_opts \\ []), do: :ignore

  defp get_objective_type(objective_def) do
    type = Map.get(objective_def, :type) || Map.get(objective_def, "type")

    cond do
      is_atom(type) -> type
      is_binary(type) -> String.to_existing_atom(type)
      true -> nil
    end
  rescue
    ArgumentError -> nil
  end
end
