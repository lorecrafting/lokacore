defmodule Exmud.Engine.Behavior do
  @moduledoc """
  Behavior protocol - defines how entities respond to events.

  Behaviors are Elixir modules that implement specific callbacks
  to handle events for entities they're attached to.
  """

  alias Exmud.Engine.{Entity, Event}

  @doc """
  Handles an event for a given entity.
  Returns the updated entity and optionally emitted events.
  """
  @callback handle_event(entity :: Entity.t(), event :: Event.t(), context :: map()) ::
              {:ok, Entity.t()} | {:ok, Entity.t(), [Event.t()]} | {:error, term()}

  @doc """
  Checks if the behavior can handle a specific event type.
  """
  @callback can_handle?(entity :: Entity.t(), event_type :: atom()) :: boolean()

  @optional_callbacks [can_handle?: 2]

  @doc """
  Processes an event through all behaviors attached to an entity.
  """
  def process_event(%Entity{behaviors: behaviors} = entity, %Event{} = event, context \\ %{}) do
    behaviors
    |> Enum.filter(&behavior_can_handle?(&1, entity, event.type))
    |> Enum.reduce_while({:ok, entity, []}, fn behavior, {:ok, ent, events} ->
      case behavior.handle_event(ent, event, context) do
        {:ok, updated_entity} ->
          {:cont, {:ok, updated_entity, events}}

        {:ok, updated_entity, new_events} ->
          {:cont, {:ok, updated_entity, events ++ new_events}}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp behavior_can_handle?(behavior, entity, event_type) do
    if function_exported?(behavior, :can_handle?, 2) do
      behavior.can_handle?(entity, event_type)
    else
      true
    end
  end
end
