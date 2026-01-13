defmodule Loka.Framework.Commands.PartyCommand do
  @moduledoc """
  Party command for managing temporary player groups.

  Parties allow players to group together for coordinated gameplay
  and private party chat.

  ## Usage

      party invite Alice       # Invite player
      party accept             # Accept pending invite
      party decline            # Decline invite
      party leave              # Leave current party
      party disband            # Leader only - dissolve party
      party list               # Show party members
      party promote Alice      # Make Alice the leader
      party kick Bob           # Remove Bob from party
      p Hello team!            # Party chat shortcut

  ## Party Size

  Parties can have up to 6 members including the leader.
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.PartyManager
  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @impl true
  def key, do: "party"

  @impl true
  def aliases, do: ["p", "group", "g"]

  @impl true
  def help do
    """
    party <action> [player] - Manage your party.

    Actions:
      invite <player>  - Invite a player to your party
      accept           - Accept a pending invitation
      decline          - Decline a pending invitation
      leave            - Leave your current party
      disband          - Disband the party (leader only)
      list             - Show party members
      promote <player> - Make another player the leader
      kick <player>    - Remove a player from the party

    Party Chat:
      party <message>  - Send a message to your party
      p <message>      - Shortcut for party chat

    Examples:
      party invite Alice
      party accept
      p Ready to go!
    """
  end

  @impl true
  def parse(args, _context) do
    args = String.trim(args)

    case String.split(args, " ", parts: 2) do
      ["invite", target] when target != "" ->
        {:ok, %{action: :invite, target: target}}

      ["invite"] ->
        {:error, "Invite whom?"}

      ["accept"] ->
        {:ok, %{action: :accept}}

      ["decline"] ->
        {:ok, %{action: :decline}}

      ["leave"] ->
        {:ok, %{action: :leave}}

      ["disband"] ->
        {:ok, %{action: :disband}}

      ["list"] ->
        {:ok, %{action: :list}}

      ["promote", target] when target != "" ->
        {:ok, %{action: :promote, target: target}}

      ["promote"] ->
        {:error, "Promote whom?"}

      ["kick", target] when target != "" ->
        {:ok, %{action: :kick, target: target}}

      ["kick"] ->
        {:error, "Kick whom?"}

      [] ->
        {:ok, %{action: :list}}

      [message] when message not in ~w(invite accept decline leave disband list promote kick) ->
        # Treat as party chat
        {:ok, %{action: :say, message: message}}

      [_cmd, _message] ->
        # Two-word message
        {:ok, %{action: :say, message: args}}

      _ ->
        {:error, "Unknown party action."}
    end
  end

  @impl true
  def execute(%{action: :invite, target: target_name}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    # First ensure player is in a party (or create one)
    party_result =
      case PartyManager.get_party(player_id) do
        {:ok, _party} -> :ok
        {:error, :not_in_party} -> PartyManager.create(player_id)
      end

    case party_result do
      {:ok, _} ->
        # Find target player and invite
        case find_player_by_name(target_name) do
          {:ok, target} ->
            target_id = Map.get(target, :id) || Map.get(target, :player_id)

            case PartyManager.invite(target_id, player_id) do
              :ok ->
                {:ok,
                 [
                   %{
                     type: :party,
                     text: "You have invited #{target_name} to your party.",
                     recipient: :actor
                   }
                 ]}

              {:error, :party_full} ->
                {:error, "Your party is full (max 6 members)."}

              {:error, :already_member} ->
                {:error, "#{target_name} is already in your party."}

              {:error, :already_invited} ->
                {:error, "#{target_name} already has a pending invite."}

              {:error, :target_in_party} ->
                {:error, "#{target_name} is already in a party."}

              {:error, :not_leader} ->
                {:error, "Only the party leader can invite."}

              {:error, reason} ->
                {:error, "Cannot invite: #{reason}"}
            end

          {:error, :not_found} ->
            {:error, "Player '#{target_name}' is not online."}
        end

      :ok ->
        # Already in party, try invite
        execute(%{action: :invite, target: target_name}, context)

      {:error, :already_in_party} ->
        # In party but not leader - shouldn't happen here
        {:error, "Only the party leader can invite."}
    end
  end

  def execute(%{action: :accept}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case PartyManager.accept(player_id) do
      {:ok, party} ->
        {:ok,
         [
           %{
             type: :party,
             text:
               "You have joined the party! (#{Loka.Framework.Social.Party.size(party)} members)",
             recipient: :actor
           },
           %{
             type: :state_update,
             updates: %{social: %{party_id: party.id}}
           }
         ]}

      {:error, :no_invite} ->
        {:error, "You don't have any pending party invites."}

      {:error, :invite_expired} ->
        {:error, "The party invite has expired."}

      {:error, :party_disbanded} ->
        {:error, "That party no longer exists."}

      {:error, :party_full} ->
        {:error, "The party is now full."}

      {:error, reason} ->
        {:error, "Cannot accept invite: #{reason}"}
    end
  end

  def execute(%{action: :decline}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case PartyManager.decline(player_id) do
      :ok ->
        {:ok, [%{type: :party, text: "You declined the party invite.", recipient: :actor}]}

      {:error, :no_invite} ->
        {:error, "You don't have any pending party invites."}
    end
  end

  def execute(%{action: :leave}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case PartyManager.leave(player_id) do
      {:ok, :disbanded} ->
        {:ok,
         [
           %{
             type: :party,
             text: "You have left and the party has been disbanded.",
             recipient: :actor
           },
           %{type: :state_update, updates: %{social: %{party_id: nil}}}
         ]}

      {:ok, :left, {:promoted, _new_leader}} ->
        {:ok,
         [
           %{type: :party, text: "You have left the party.", recipient: :actor},
           %{type: :state_update, updates: %{social: %{party_id: nil}}}
         ]}

      {:ok, :left} ->
        {:ok,
         [
           %{type: :party, text: "You have left the party.", recipient: :actor},
           %{type: :state_update, updates: %{social: %{party_id: nil}}}
         ]}

      {:error, :not_in_party} ->
        {:error, "You are not in a party."}
    end
  end

  def execute(%{action: :disband}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case PartyManager.disband(player_id) do
      {:ok, members} ->
        {:ok,
         [
           %{
             type: :party,
             text: "You have disbanded the party (#{length(members)} members).",
             recipient: :actor
           },
           %{type: :state_update, updates: %{social: %{party_id: nil}}}
         ]}

      {:error, :not_in_party} ->
        {:error, "You are not in a party."}

      {:error, :not_leader} ->
        {:error, "Only the party leader can disband."}
    end
  end

  def execute(%{action: :list}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case PartyManager.get_party(player_id) do
      {:ok, party} ->
        text = format_party_list(party, player_id)
        {:ok, [%{type: :info, text: text, recipient: :actor}]}

      {:error, :not_in_party} ->
        {:error, "You are not in a party."}
    end
  end

  def execute(%{action: :promote, target: target_name}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)

        case PartyManager.promote(target_id, player_id) do
          {:ok, _party} ->
            {:ok,
             [%{type: :party, text: "#{target_name} is now the party leader.", recipient: :actor}]}

          {:error, :not_in_party} ->
            {:error, "You are not in a party."}

          {:error, :not_leader} ->
            {:error, "Only the party leader can promote."}

          {:error, :not_member} ->
            {:error, "#{target_name} is not in your party."}

          {:error, :already_leader} ->
            {:error, "You are already the leader."}
        end

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' is not online."}
    end
  end

  def execute(%{action: :kick, target: target_name}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)

        case PartyManager.kick(target_id, player_id) do
          {:ok, _} ->
            {:ok,
             [
               %{
                 type: :party,
                 text: "#{target_name} has been removed from the party.",
                 recipient: :actor
               }
             ]}

          {:error, :not_in_party} ->
            {:error, "You are not in a party."}

          {:error, :not_leader} ->
            {:error, "Only the party leader can kick members."}

          {:error, :not_member} ->
            {:error, "#{target_name} is not in your party."}

          {:error, :cannot_kick_self} ->
            {:error, "You cannot kick yourself. Use 'party leave' or 'party disband'."}
        end

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' is not online."}
    end
  end

  def execute(%{action: :say, message: message}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case PartyManager.get_party_id(player_id) do
      nil ->
        {:error, "You are not in a party."}

      party_id ->
        msg =
          ScopedMessage.new(:party, message, actor,
            party_id: party_id,
            message_type: :party
          )

        MessageRouter.route(msg)

        actor_name = Map.get(actor, :name, "You")

        {:ok,
         [
           %{
             type: :party,
             text: "[Party] #{actor_name}: #{message}",
             recipient: :actor
           }
         ]}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp find_player_by_name(name) do
    Loka.Engine.EntityRegistry.find_player_by_name(name)
  rescue
    _ -> {:error, :not_found}
  end

  defp format_party_list(party, current_player_id) do
    alias Loka.Framework.Social.Party

    leader_id = party.leader
    members = Party.member_list(party)

    # Build a map of player_id -> name from online players
    player_names =
      Loka.Session.Registry.get_online_players()
      |> Enum.into(%{}, fn %{id: id, name: name} -> {id, name} end)

    header = "Party Members (#{length(members)}/#{Party.max_size()}):\n"

    lines =
      Enum.map(members, fn member_id ->
        name = Map.get(player_names, member_id, "Unknown")
        you = if member_id == current_player_id, do: " (you)", else: ""
        leader = if member_id == leader_id, do: " [Leader]", else: ""
        "  #{name}#{leader}#{you}"
      end)

    header <> Enum.join(lines, "\n")
  end
end
