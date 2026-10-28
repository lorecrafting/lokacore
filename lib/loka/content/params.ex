defmodule Loka.Content.Params do
  @moduledoc """
  Parameters (docs/system/cartridge.md, Source shortcuts): a prototype or behaviour declares
  `"params": ["<Key>", ...]`, a `{"param": "<name>"}` marker stands for an argument, and a `with`
  object fills it. Extends (a child's `with`) and Behaviours (an attachment's `with`) share these
  functions; faults carry steps relative to the caller's site, and this module never calls Source.
  """

  alias Loka.Core.Contracts

  @doc "`:ok` if `params` is a list of Keys naming none of `reserved`, else the schema error."
  @spec declared(term(), [String.t()]) :: :ok | {:error, String.t()}
  def declared(params, reserved \\ []) do
    cond do
      not (is_list(params) and Enum.all?(params, &(Contracts.validate("Key", &1) == :ok))) ->
        {:error, "invalid_type"}

      Enum.any?(params, &(&1 in reserved)) ->
        {:error, "invalid_value"}

      true ->
        :ok
    end
  end

  @doc "Each marker in `value` naming none of `names`, as `{steps, name}`."
  @spec unresolved(term(), [String.t()]) :: [{list(), String.t()}]
  def unresolved(value, names), do: markers(value, [], names)

  defp markers(%{"param" => name} = marker, path, names)
       when map_size(marker) == 1 and is_binary(name),
       do: if(name in names, do: [], else: [{path, name}])

  defp markers(%{} = map, path, names),
    do: Enum.flat_map(map, fn {k, v} -> markers(v, path ++ [k], names) end)

  defp markers(list, path, names) when is_list(list),
    do:
      list |> Enum.with_index() |> Enum.flat_map(fn {v, i} -> markers(v, path ++ [i], names) end)

  defp markers(_, _, _), do: []

  @doc "The faults of `with` against `params`, as `{code, steps under with, data}`."
  @spec check(term(), [String.t()]) :: [{String.t(), list(), map()}]
  def check(%{} = with, params) do
    unknown = for k <- Enum.sort(Map.keys(with)), k not in params, do: {"UNKNOWN_FIELD", [k], %{}}

    if Enum.all?(params, &is_map_key(with, &1)),
      do: unknown,
      else: unknown ++ [{"SCHEMA_VIOLATION", [], %{"error" => "missing_property"}}]
  end

  def check(_, _), do: [{"SCHEMA_VIOLATION", [], %{"error" => "invalid_type"}}]

  @doc "`value` with each marker naming an argument replaced by that argument's value."
  @spec fill(term(), map()) :: term()
  def fill(%{"param" => name} = marker, args)
      when map_size(marker) == 1 and is_map_key(args, name),
      do: args[name]

  def fill(%{} = map, args), do: Map.new(map, fn {k, v} -> {k, fill(v, args)} end)
  def fill(list, args) when is_list(list), do: Enum.map(list, &fill(&1, args))
  def fill(value, _), do: value
end
