defmodule Loka.Engine.SocialSubstitution do
  @moduledoc """
  Variable substitution for social/emote messages.

  Replaces placeholders in message templates with actual values
  based on the actor and target entities.

  ## Supported Variables

  | Variable | Meaning | Example |
  |----------|---------|---------|
  | `{actor}` | Actor's display name | "Alice", "the guard" |
  | `{target}` | Target's display name | "Bob", "the merchant" |
  | `{actor_subjective}` | he/she/they | "she" |
  | `{actor_objective}` | him/her/them | "her" |
  | `{actor_possessive}` | his/her/their | "her" |
  | `{target_subjective}` | he/she/they | "he" |
  | `{target_objective}` | him/her/them | "him" |
  | `{target_possessive}` | his/her/their | "his" |
  | `{self_pronoun}` | himself/herself/themself | "herself" |

  ## Usage

      template = "You smile at {target}."
      result = SocialSubstitution.substitute(template, actor, target)
      # => "You smile at Bob."

      template = "{actor} hugs {target_objective}."
      result = SocialSubstitution.substitute(template, alice, bob)
      # => "Alice hugs him."
  """

  @doc """
  Substitutes all variables in a template string.

  ## Parameters

  - `template` - The message template with {variable} placeholders
  - `actor` - The entity performing the action (map with :short_desc, :components)
  - `target` - The target entity or nil

  ## Returns

  The substituted string with first letter capitalized.
  """
  def substitute(template, actor, target \\ nil) when is_binary(template) do
    template
    |> String.replace("{actor}", get_name(actor))
    |> String.replace("{target}", get_name(target))
    |> String.replace("{actor_subjective}", pronoun(actor, :subjective))
    |> String.replace("{actor_objective}", pronoun(actor, :objective))
    |> String.replace("{actor_possessive}", pronoun(actor, :possessive))
    |> String.replace("{target_subjective}", pronoun(target, :subjective))
    |> String.replace("{target_objective}", pronoun(target, :objective))
    |> String.replace("{target_possessive}", pronoun(target, :possessive))
    |> String.replace("{self_pronoun}", self_pronoun(actor))
    |> capitalize_first()
  end

  @doc """
  Gets the display name for an entity.

  Uses short_desc if available, falls back to "someone".
  For PlayerGameState, uses character_name.
  """
  def get_name(nil), do: "someone"

  def get_name(%{short_desc: short_desc}) when is_binary(short_desc) and short_desc != "" do
    short_desc
  end

  def get_name(%{character_name: name}) when is_binary(name) and name != "" do
    name
  end

  def get_name(%{name: name}) when is_binary(name) and name != "" do
    name
  end

  def get_name(_), do: "someone"

  @doc """
  Gets the appropriate pronoun for an entity based on gender.

  ## Parameters

  - `entity` - Entity map with optional :components => :gender component
  - `type` - :subjective (he/she/they), :objective (him/her/them), :possessive (his/her/their)
  """
  def pronoun(nil, _type), do: "they"

  def pronoun(entity, type) do
    gender = get_gender(entity)

    case {gender, type} do
      {:male, :subjective} -> "he"
      {:male, :objective} -> "him"
      {:male, :possessive} -> "his"
      {:female, :subjective} -> "she"
      {:female, :objective} -> "her"
      {:female, :possessive} -> "her"
      {_, :subjective} -> "they"
      {_, :objective} -> "them"
      {_, :possessive} -> "their"
    end
  end

  @doc """
  Gets the reflexive pronoun for self-targeting socials.
  """
  def self_pronoun(nil), do: "themself"

  def self_pronoun(entity) do
    gender = get_gender(entity)

    case gender do
      :male -> "himself"
      :female -> "herself"
      _ -> "themself"
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp get_gender(%{components: %{gender: gender}}) when is_atom(gender), do: gender

  defp get_gender(%{components: %{"gender" => gender}}) when is_binary(gender) do
    String.to_existing_atom(gender)
  rescue
    ArgumentError -> :neutral
  end

  defp get_gender(%{gender: gender}) when is_atom(gender), do: gender
  defp get_gender(_), do: :neutral

  defp capitalize_first(""), do: ""

  defp capitalize_first(<<first::utf8, rest::binary>>) do
    String.upcase(<<first::utf8>>) <> rest
  end
end
