defmodule Loka.Game.Actions.Social do
  @moduledoc """
  Social game actions.

  Handles emotes, mood, and pose interactions.

  ## Actions

  - `:emote` - Perform an emote (with or without target)
  - `:set_mood` - Set character mood
  - `:set_pose` - Set character pose text
  """

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Engine.Entity
  alias Loka.Engine.SocialLoader
  alias Loka.Engine.SocialSubstitution

  @valid_moods ~w(neutral cheerful melancholy fierce distracted formal playful weary)

  @doc """
  Perform an emote, optionally targeted at another entity.
  """
  @spec emote(Context.t(), String.t(), String.t() | nil) ::
          {:ok, Result.t()} | {:error, String.t()}
  def emote(ctx, emote_key, target_id) do
    case SocialLoader.get(emote_key) do
      {:ok, social} ->
        if target_id do
          emote_with_target(ctx, social, emote_key, target_id)
        else
          emote_no_target(ctx, social)
        end

      {:error, :not_found} ->
        {:error, "Unknown emote: #{emote_key}"}
    end
  end

  @doc """
  Set the character's mood.
  """
  @spec set_mood(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def set_mood(ctx, mood_str) do
    character = ctx.character

    if mood_str in @valid_moods do
      social = Entity.get_component(character, "social") || %{}
      mood_atom = String.to_existing_atom(mood_str)

      updated_social =
        Map.put(social, "mood", %{
          "current" => Atom.to_string(mood_atom),
          "updated_at" => DateTime.utc_now() |> DateTime.to_iso8601()
        })

      new_character = Entity.add_component(character, "social", updated_social)

      mood_message =
        if mood_str == "neutral",
          do: "You return to a neutral state of mind.",
          else: "You are now feeling #{mood_str}."

      result =
        Result.new(
          state: %{character: new_character},
          events: [{:event, mood_message}]
        )

      {:ok, result}
    else
      {:error, "Invalid mood."}
    end
  end

  @doc """
  Set the character's pose text.
  """
  @spec set_pose(Context.t(), String.t()) :: {:ok, Result.t()}
  def set_pose(ctx, pose_text) do
    character = ctx.character
    social = Entity.get_component(character, "social") || %{}
    pose_text = String.trim(pose_text)

    updated_social =
      Map.put(social, "pose", %{
        "text" => pose_text,
        "updated_at" => DateTime.utc_now() |> DateTime.to_iso8601()
      })

    new_character = Entity.add_component(character, "social", updated_social)

    msg = if pose_text == "", do: "You clear your pose.", else: "Your pose is now: #{pose_text}"

    result =
      Result.new(
        state: %{character: new_character},
        events: [{:event, msg}]
      )

    {:ok, result}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp emote_with_target(ctx, social, _emote_key, target_id) do
    room = ctx.room
    actor = %{name: ctx.player_name, id: ctx.player_id}

    case find_emote_target(ctx, target_id) do
      nil ->
        {:error, "Target not found."}

      target ->
        target_name = target.name || "someone"
        target_data = %{name: target_name, id: target_id}
        is_self = to_string(target_id) == to_string(ctx.player_id)

        messages =
          if is_self,
            do: social.messages[:self_target] || social.messages[:with_target],
            else: social.messages[:with_target]

        if messages do
          actor_text = SocialSubstitution.substitute(messages.to_actor, actor, target_data)

          events = [{:event, actor_text}]

          events =
            if messages[:to_room] && room.id do
              room_text = SocialSubstitution.substitute(messages.to_room, actor, target_data)

              events ++
                [
                  {:broadcast_room, room.id,
                   {:player_emotes_at, ctx.player_id, target_id, ctx.player_name, room_text}}
                ]
            else
              events
            end

          result = Result.new(events: events)
          {:ok, result}
        else
          {:error, "Cannot perform that emote."}
        end
    end
  end

  defp emote_no_target(ctx, social) do
    room = ctx.room
    actor = %{name: ctx.player_name, id: ctx.player_id}
    messages = social.messages[:no_target]

    if messages do
      actor_text = SocialSubstitution.substitute(messages.to_actor, actor, nil)

      events = [{:event, actor_text}]

      events =
        if messages[:to_room] && room.id do
          room_text = SocialSubstitution.substitute(messages.to_room, actor, nil)

          events ++
            [
              {:broadcast_room, room.id,
               {:player_emotes, ctx.player_id, ctx.player_name, room_text}}
            ]
        else
          events
        end

      result = Result.new(events: events)
      {:ok, result}
    else
      {:error, "That emote requires a target."}
    end
  end

  defp find_emote_target(ctx, target_id) do
    room = ctx.room

    # Check if targeting self
    if to_string(target_id) == to_string(ctx.player_id) do
      %{name: ctx.player_name, id: ctx.player_id}
    else
      # Check NPCs in room
      Enum.find(room.entities || [], fn e -> to_string(e.id) == to_string(target_id) end)
    end
  end
end
