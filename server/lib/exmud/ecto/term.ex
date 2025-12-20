defmodule Exmud.Ecto.Term do
  @moduledoc """
  Custom Ecto type for storing arbitrary Erlang terms as binary.

  Uses `:erlang.term_to_binary/1` for serialization and `:erlang.binary_to_term/1`
  for deserialization. This enables storing complex data structures like maps,
  lists, and nested data in a single database column.

  Similar to Evennia's pickle-based attribute storage, but using Erlang's
  native term serialization which is more efficient for BEAM languages.

  ## Example

      schema "entities" do
        field :components, Exmud.Ecto.Term
        field :metadata, Exmud.Ecto.Term
      end

      # Store complex data
      entity = %Entity{components: %{health: %{current: 100, max: 100}}}
  """

  use Ecto.Type

  @impl true
  def type, do: :binary

  @impl true
  def cast(nil), do: {:ok, nil}
  def cast(term), do: {:ok, term}

  @impl true
  def load(nil), do: {:ok, nil}

  def load(binary) when is_binary(binary) do
    {:ok, :erlang.binary_to_term(binary)}
  rescue
    ArgumentError -> :error
  end

  @impl true
  def dump(nil), do: {:ok, nil}
  def dump(term), do: {:ok, :erlang.term_to_binary(term)}

  @impl true
  def equal?(term1, term2), do: term1 == term2

  @impl true
  def embed_as(_format), do: :dump
end
