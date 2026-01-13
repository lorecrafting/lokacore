defmodule Loka.Ecto.Json do
  @moduledoc """
  Custom Ecto type for storing arbitrary Elixir terms as JSON.

  Unlike `Loka.Ecto.Term` which uses Erlang binary serialization,
  this type stores data as JSON text, making it queryable in SQLite
  and human-readable in the database.

  ## Key Differences from Erlang Term Serialization

  - **Atoms become strings**: `:attack` becomes `"attack"`
  - **Map keys become strings**: `%{health: 100}` becomes `%{"health" => 100}`
  - **Tuples become arrays**: `{1, 2, 3}` becomes `[1, 2, 3]`
  - **Data is queryable**: Can use JSON functions in SQLite queries

  ## Important: String Keys on Load

  When data is loaded from the database, all map keys will be strings.
  Code that accesses loaded data must use string keys:

      # Before (with Loka.Ecto.Term):
      Map.get(components, :health)

      # After (with Loka.Ecto.Json):
      Map.get(components, "health")

  ## Example

      schema "entities" do
        field :components, Loka.Ecto.Json
        field :metadata, Loka.Ecto.Json
      end

      # Store complex data
      entity = %Entity{components: %{health: %{current: 100, max: 100}}}

      # After loading, access with string keys:
      entity.components["health"]["current"]  # => 100
  """

  use Ecto.Type

  @impl true
  def type, do: :string

  @impl true
  def cast(nil), do: {:ok, nil}
  def cast(term), do: {:ok, term}

  @impl true
  def load(nil), do: {:ok, nil}

  def load(json) when is_binary(json) do
    case Jason.decode(json) do
      {:ok, term} -> {:ok, term}
      {:error, _} -> :error
    end
  end

  @impl true
  def dump(nil), do: {:ok, nil}

  def dump(term) do
    case Jason.encode(prepare_for_json(term)) do
      {:ok, json} -> {:ok, json}
      {:error, _} -> :error
    end
  end

  @impl true
  def equal?(term1, term2), do: term1 == term2

  @impl true
  def embed_as(_format), do: :dump

  # Prepare Elixir terms for JSON encoding
  # Converts atoms to strings, tuples to lists, and ensures all map keys are strings
  defp prepare_for_json(nil), do: nil
  # Booleans must come before atoms since is_atom(true) is true
  defp prepare_for_json(boolean) when is_boolean(boolean), do: boolean
  defp prepare_for_json(atom) when is_atom(atom), do: Atom.to_string(atom)
  defp prepare_for_json(binary) when is_binary(binary), do: binary
  defp prepare_for_json(number) when is_number(number), do: number

  defp prepare_for_json(tuple) when is_tuple(tuple) do
    tuple
    |> Tuple.to_list()
    |> prepare_for_json()
  end

  defp prepare_for_json(list) when is_list(list) do
    Enum.map(list, &prepare_for_json/1)
  end

  # Handle DateTime/Date/Time/NaiveDateTime by converting to ISO8601 string
  # These must come BEFORE is_map since structs are maps
  defp prepare_for_json(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp prepare_for_json(%NaiveDateTime{} = dt), do: NaiveDateTime.to_iso8601(dt)
  defp prepare_for_json(%Date{} = date), do: Date.to_iso8601(date)
  defp prepare_for_json(%Time{} = time), do: Time.to_iso8601(time)

  # Handle other structs by converting to map first
  defp prepare_for_json(%_{} = struct) do
    struct
    |> Map.from_struct()
    |> prepare_for_json()
  end

  # Plain maps (not structs)
  defp prepare_for_json(map) when is_map(map) do
    map
    |> Enum.map(fn {k, v} ->
      key = if is_atom(k), do: Atom.to_string(k), else: to_string(k)
      {key, prepare_for_json(v)}
    end)
    |> Map.new()
  end

  defp prepare_for_json(other) do
    # Fallback: convert to string representation
    inspect(other)
  end
end
