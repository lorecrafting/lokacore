defmodule Loka.Engine.Commands.SocialCommand do
  @moduledoc """
  Generic command handler for all social/emote commands.

  This module handles dynamically registered social commands (smile, wave, hug, etc.)
  by looking up their definitions from the SocialLoader and executing the
  appropriate message output.

  ## How It Works

  1. SocialRegistry registers each social as a command with metadata
  2. When executed, this module receives the social key via context
  3. Looks up the social definition from SocialLoader
  4. Parses target from arguments (if any)
  5. Selects appropriate message set (no_target, with_target, self_target, not_found)
  6. Applies variable substitution
  7. Returns events for actor, target, and room

  ## Message Routing

  - `:to_actor` - Sent only to the person performing the social
  - `:to_target` - Sent only to the target (if any)
  - `:to_room` - Sent to everyone else in the room

  ## Example Execution

      # "smile" with no target
      # Actor sees: "You smile happily."
      # Room sees: "Alice smiles happily."

      # "hug bob"
      # Actor sees: "You hug Bob warmly."
      # Bob sees: "Alice hugs you warmly."
      # Room sees: "Alice hugs Bob."
  """

  use Loka.Engine.Command

  alias Loka.Engine.SocialLoader
  alias Loka.Engine.SocialSubstitution

  # These are overridden dynamically via the registry metadata
  @impl true
  def key, do: "social"

  @impl true
  def help, do: "Perform a social/emote action."

  @impl true
  def parse(args, context) do
    target_name = String.trim(args)
    room = Map.get(context, :location)

    target =
      if target_name != "" do
        find_target(target_name, room, context)
      else
        nil
      end

    {:ok, %{target_name: target_name, target: target}}
  end

  @impl true
  def execute(parsed, context) do
    # Get the social key from context metadata (set by SocialRegistry)
    social_key = get_in(context, [:metadata, :social_key]) || context[:social_key]

    case SocialLoader.get(social_key) do
      {:ok, social} ->
        do_execute(social, parsed, context)

      {:error, :not_found} ->
        {:error, "Unknown social: #{social_key}"}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp do_execute(social, %{target_name: target_name, target: target}, context) do
    actor = Map.get(context, :actor)

    # Select appropriate message set
    messages = select_messages(social, target_name, target, actor)

    case messages do
      {:error, message} ->
        # Target not found or requires_target violation
        event = build_actor_event(message, actor, nil)
        {:ok, [event]}

      message_set ->
        events = build_events(message_set, actor, target, context)
        {:ok, events}
    end
  end

  defp select_messages(social, "", nil, _actor) do
    # No target provided
    if social.requires_target do
      # Social requires a target but none given
      case social.messages[:not_found] do
        nil -> {:error, "#{String.capitalize(social.key)} whom?"}
        not_found -> {:error, not_found.to_actor}
      end
    else
      # Use no_target messages
      social.messages[:no_target] || {:error, "You #{social.key}."}
    end
  end

  defp select_messages(social, target_name, nil, _actor) when target_name != "" do
    # Target name provided but not found
    case social.messages[:not_found] do
      nil -> {:error, "You don't see '#{target_name}' here."}
      not_found -> {:error, not_found.to_actor}
    end
  end

  defp select_messages(social, _target_name, target, actor) do
    # Target found - check if self-target
    if is_self_target?(target, actor) do
      social.messages[:self_target] || social.messages[:with_target]
    else
      social.messages[:with_target]
    end
  end

  defp is_self_target?(nil, _actor), do: false

  defp is_self_target?(target, actor) do
    # Compare by ID if available, otherwise by player_id
    target_id = Map.get(target, :id) || Map.get(target, :player_id)
    actor_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    target_id != nil && target_id == actor_id
  end

  defp build_events(message_set, actor, target, context) do
    room = Map.get(context, :location)
    events = []

    # Message to actor
    events =
      if message_set[:to_actor] do
        text = SocialSubstitution.substitute(message_set.to_actor, actor, target)
        [build_actor_event(text, actor, target) | events]
      else
        events
      end

    # Message to target (if target exists and message defined)
    events =
      if target && message_set[:to_target] do
        text = SocialSubstitution.substitute(message_set.to_target, actor, target)
        [build_target_event(text, actor, target) | events]
      else
        events
      end

    # Message to room (everyone except actor and target)
    events =
      if room && message_set[:to_room] do
        text = SocialSubstitution.substitute(message_set.to_room, actor, target)
        [build_room_event(text, actor, target, room) | events]
      else
        events
      end

    Enum.reverse(events)
  end

  defp build_actor_event(text, _actor, _target) do
    %{
      type: :social,
      text: text,
      recipient: :actor,
      timestamp: DateTime.utc_now()
    }
  end

  defp build_target_event(text, _actor, target) do
    %{
      type: :social,
      text: text,
      recipient: :target,
      target_id: Map.get(target, :id) || Map.get(target, :player_id),
      timestamp: DateTime.utc_now()
    }
  end

  defp build_room_event(text, actor, target, room) do
    actor_id = Map.get(actor, :id) || Map.get(actor, :player_id)
    target_id = if target, do: Map.get(target, :id) || Map.get(target, :player_id), else: nil

    exclude = [actor_id | if(target_id, do: [target_id], else: [])] |> Enum.reject(&is_nil/1)

    %{
      type: :social,
      text: text,
      recipient: :room,
      room_id: Map.get(room, :id),
      exclude: exclude,
      timestamp: DateTime.utc_now()
    }
  end

  defp find_target(_name, nil, _context), do: nil

  defp find_target(name, room, context) do
    name_lower = String.downcase(name)

    # Check if targeting self
    actor = Map.get(context, :actor)
    actor_name = SocialSubstitution.get_name(actor) |> String.downcase()

    if String.contains?(actor_name, name_lower) or name_lower in ["self", "myself", "me"] do
      actor
    else
      # Look in room for NPCs and other players
      find_in_room(name_lower, room)
    end
  end

  defp find_in_room(name, room) do
    npcs = Map.get(room, :npcs, [])
    players = Map.get(room, :players, [])
    items = Map.get(room, :items, [])

    entities = npcs ++ players ++ items

    Enum.find(entities, fn entity ->
      entity_name = SocialSubstitution.get_name(entity) |> String.downcase()
      keywords = Map.get(entity, :keywords, []) |> Enum.map(&String.downcase/1)

      String.contains?(entity_name, name) or name in keywords
    end)
  end
end
