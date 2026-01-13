defmodule Loka.Engine.Social do
  @moduledoc """
  Social/emote data structure for the Loka engine.

  Socials are expressive actions like "smile", "wave", "hug" that players use
  for roleplay and communication. They are data-driven from YAML, with
  variable substitution for pronouns and names.

  ## Message Slots

  Each social has up to 4 message contexts:

  - `no_target` - When used without a target ("smile")
  - `with_target` - When targeting another entity ("smile at Bob")
  - `self_target` - When targeting yourself ("smile at self")
  - `not_found` - When target cannot be found

  ## Variable Substitution

  Messages support these placeholders:

  | Variable | Meaning | Example |
  |----------|---------|---------|
  | `{actor}` | Actor's short_desc or name | "Alice", "the guard" |
  | `{target}` | Target's short_desc or name | "Bob", "the merchant" |
  | `{actor_subjective}` | he/she/they | "she" |
  | `{actor_objective}` | him/her/them | "her" |
  | `{actor_possessive}` | his/her/their | "her" |
  | `{target_subjective}` | he/she/they | "he" |
  | `{target_objective}` | him/her/them | "him" |
  | `{target_possessive}` | his/her/their | "his" |
  | `{self_pronoun}` | himself/herself/themself | "herself" |

  ## Example YAML

      smile:
        aliases: [grin]
        min_position: resting
        messages:
          no_target:
            to_actor: "You smile happily."
            to_room: "{actor} smiles happily."
          with_target:
            to_actor: "You smile at {target}."
            to_target: "{actor} smiles at you warmly."
            to_room: "{actor} smiles at {target}."
  """

  @type position :: :dead | :sleeping | :resting | :sitting | :standing | :fighting

  @type messages :: %{
          optional(:no_target) => message_set(),
          optional(:with_target) => message_set(),
          optional(:self_target) => message_set(),
          optional(:not_found) => message_set()
        }

  @type message_set :: %{
          required(:to_actor) => String.t(),
          optional(:to_target) => String.t(),
          optional(:to_room) => String.t()
        }

  @type t :: %__MODULE__{
          key: String.t(),
          aliases: [String.t()],
          min_position: position(),
          hidden: boolean(),
          requires_target: boolean(),
          messages: messages()
        }

  defstruct [
    :key,
    aliases: [],
    min_position: :resting,
    hidden: false,
    requires_target: false,
    messages: %{}
  ]

  @valid_positions [:dead, :sleeping, :resting, :sitting, :standing, :fighting]
  @valid_contexts [:no_target, :with_target, :self_target, :not_found]

  @doc """
  Creates a Social struct from a map (parsed YAML data).

  ## Parameters

  - `key` - The social command key (e.g., "smile")
  - `data` - Map of social attributes from YAML

  ## Returns

  - `{:ok, Social.t()}` on success
  - `{:error, reason}` on validation failure
  """
  def from_map(key, data) when is_binary(key) and is_map(data) do
    with {:ok, messages} <- parse_messages(data["messages"]) do
      position = parse_position(data["min_position"])

      social = %__MODULE__{
        key: key,
        aliases: data["aliases"] || [],
        min_position: position,
        hidden: data["hidden"] == true,
        requires_target: data["requires_target"] == true,
        messages: messages
      }

      {:ok, social}
    end
  end

  @doc """
  Returns all command keys for this social (primary key + aliases).
  """
  def all_keys(%__MODULE__{key: key, aliases: aliases}) do
    [key | aliases]
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp parse_messages(nil), do: {:error, "messages is required"}

  defp parse_messages(messages) when is_map(messages) do
    result =
      Enum.reduce_while(messages, {:ok, %{}}, fn {context, message_set}, {:ok, acc} ->
        case parse_context(context) do
          {:ok, context_atom} ->
            {:cont, {:ok, Map.put(acc, context_atom, parse_message_set(message_set))}}

          {:error, reason} ->
            {:halt, {:error, reason}}
        end
      end)

    result
  end

  defp parse_context(context) when is_binary(context) do
    # Use to_existing_atom to prevent atom exhaustion - contexts are pre-defined
    case String.to_existing_atom(context) do
      context_atom when context_atom in @valid_contexts ->
        {:ok, context_atom}

      _ ->
        {:error, "invalid message context: #{context}"}
    end
  rescue
    ArgumentError ->
      {:error, "invalid message context: #{context}"}
  end

  defp parse_message_set(message_set) when is_map(message_set) do
    %{
      to_actor: message_set["to_actor"]
    }
    |> maybe_put(:to_target, message_set["to_target"])
    |> maybe_put(:to_room, message_set["to_room"])
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp parse_position(nil), do: :resting

  defp parse_position(position) when is_binary(position) do
    atom = String.to_existing_atom(position)
    if atom in @valid_positions, do: atom, else: :resting
  rescue
    ArgumentError -> :resting
  end

  defp parse_position(_), do: :resting
end
