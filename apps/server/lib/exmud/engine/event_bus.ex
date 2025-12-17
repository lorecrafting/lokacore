defmodule Exmud.Engine.EventBus do
  @moduledoc """
  Central event routing system using Phoenix.PubSub.

  Events are broadcast to relevant topics based on their type,
  location, and target entities.
  """

  alias Exmud.Engine.Event

  @pubsub Exmud.PubSub

  @doc """
  Emits an event to all relevant subscribers.
  """
  def emit(%Event{} = event) do
    unless Event.cancelled?(event) do
      event
      |> build_topics()
      |> Enum.each(&broadcast(&1, event))
    end

    :ok
  end

  @doc """
  Subscribes to a specific topic.
  """
  def subscribe(topic) when is_binary(topic) do
    Phoenix.PubSub.subscribe(@pubsub, topic)
  end

  @doc """
  Unsubscribes from a specific topic.
  """
  def unsubscribe(topic) when is_binary(topic) do
    Phoenix.PubSub.unsubscribe(@pubsub, topic)
  end

  @doc """
  Broadcasts an event to a specific topic.
  """
  def broadcast(topic, %Event{} = event) do
    Phoenix.PubSub.broadcast(@pubsub, topic, {:event, event})
  end

  @doc """
  Builds the list of topics an event should be broadcast to.
  """
  def build_topics(%Event{} = event) do
    ["events:global"]
    |> maybe_add_type_topic(event)
    |> maybe_add_location_topic(event)
    |> maybe_add_entity_topic(event)
  end

  defp maybe_add_type_topic(topics, %Event{type: type}) do
    ["events:#{type}" | topics]
  end

  defp maybe_add_location_topic(topics, %Event{location: nil}), do: topics

  defp maybe_add_location_topic(topics, %Event{location: location}) do
    ["room:#{location}" | topics]
  end

  defp maybe_add_entity_topic(topics, %Event{target: nil}), do: topics

  defp maybe_add_entity_topic(topics, %Event{target: target}) do
    ["entity:#{target}" | topics]
  end
end
