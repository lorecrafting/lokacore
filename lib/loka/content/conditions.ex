defmodule Loka.Content.Conditions do
  @moduledoc """
  `conditions/<key>.json` holds one Policy, written as `{"op": "named", "key": "<key>"}` in any
  Policy of the source and substituted here, before any check, so a use site is checked as if the
  condition were written out there (docs/system/cartridge.md, Source shortcuts, Named conditions).
  A condition may read another; one that reaches itself, directly or not, is CONDITION_CYCLE at its
  own file. Every other refusal lands where the author wrote it: a condition that is no Policy
  against Policy at its file, an unknown key as UNRESOLVED_REFERENCE at the leaf. It returns faults;
  Source builds the diagnostics, so this module never calls Source.
  """

  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "Where a value sits: its file and the steps into it."
  @type at :: {String.t(), [String.t() | non_neg_integer()]}
  @typedoc """
  A refusal: a code with its place and data, or `{:policy, at, value, errors}` when a condition is
  no Policy and Source is to build the SCHEMA_VIOLATION from the contract's own errors.
  """
  @type fault :: {String.t(), at(), map()} | {:policy, at(), term(), [map()]}

  # A condition that cannot be worked out reads as the policy with no condition: the fault at its
  # own file is the cause, so a site reading it adds no second one.
  @always %{"op" => "all", "items" => []}

  @named %{
    "description" =>
      "A condition written once in the conditions folder and read here by its name; it is replaced by that condition, so the artifact never carries this leaf.",
    "type" => "object",
    "properties" => %{
      "op" => %{"const" => "named"},
      "key" => %{"$ref" => "Key", "description" => "The condition's name."}
    },
    "required" => ["op", "key"],
    "additionalProperties" => false
  }

  @doc """
  The `Policy` contract with the source-only `named` branch, which a Policy position may write and
  `lower/2` replaces. Source contracts carry it; the protocol's own `Policy` never does.
  """
  @spec widen(map()) :: map()
  def widen(policy), do: Map.update!(policy, "oneOf", &(&1 ++ [@named]))

  @doc """
  Every named condition substituted at every site, without the condition files themselves, and the
  faults. `contracts` is the source contract set, which accepts `named` wherever a Policy goes.
  """
  @spec lower([entry()], map()) :: {[entry()], [fault()]}
  def lower(files, contracts) do
    {conditions, files} = Enum.split_with(files, &match?({_, {:condition, _, _}, _}, &1))

    named =
      for {rel, {:condition, key, _}, value} <- conditions, into: %{}, do: {key, {rel, value}}

    st = %{named: named, cyclic: MapSet.new(cyclic(named)), known: %{}, contracts: contracts}
    {st, own} = conditions(st)
    {files, sites} = Enum.map_reduce(files, [], fn file, ds -> site(file, st, ds) end)
    {files, sort(own ++ sites)}
  end

  # Every condition expanded, in key order, so a fault list is the same however the files arrived;
  # a condition on a cycle is refused at its own file instead.
  defp conditions(st) do
    {st, ds} =
      Enum.reduce(Enum.sort(Map.keys(st.named)), {st, []}, fn key, {st, ds} ->
        {st, more} = expand(key, st)
        {st, ds ++ more}
      end)

    {st, ds ++ for(key <- Enum.sort(st.cyclic), do: cycle_fault(key, st.named))}
  end

  # A cycle is reported at each condition's own file, wherever the file sits.
  defp cycle_fault(key, named), do: {"CONDITION_CYCLE", {elem(named[key], 0), []}, %{}}

  # {:ok, Policy} | :invalid for one condition, memoized. A key on a cycle is :invalid and never
  # expanded, which is what lets a non-cyclic condition's expansion terminate.
  defp expand(key, %{known: known} = st) do
    cond do
      Map.has_key?(known, key) -> {st, []}
      key in st.cyclic -> {%{st | known: Map.put(known, key, :invalid)}, []}
      true -> fresh(key, st)
    end
  end

  # A condition's value against Policy at its own file. The source contracts accept a `named` leaf
  # wherever a Policy goes, so its own leaves are substituted before any site checks anything.
  defp fresh(key, st) do
    {rel, value} = st.named[key]
    at = {rel, []}

    case Contracts.detailed("Policy", value, st.contracts) do
      :ok ->
        {value, {st, ds}} = substitute(value, at, st, [])
        {%{st | known: Map.put(st.known, key, {:ok, value})}, ds}

      {:error, es} ->
        {%{st | known: Map.put(st.known, key, :invalid)}, [{:policy, at, value, es}]}
    end
  end

  # The value with every `named` leaf substituted: a known condition as itself, one that cannot be
  # worked out as the always policy, and an unknown key as always with the leaf's own fault.
  defp substitute(%{"op" => "named", "key" => key} = leaf, at, st, ds) when map_size(leaf) == 2 do
    if is_map_key(st.named, key) do
      {st, more} = expand(key, st)

      case st.known[key] do
        {:ok, policy} -> {policy, {st, ds ++ more}}
        :invalid -> {@always, {st, ds ++ more}}
      end
    else
      {@always, {st, ds ++ [{"UNRESOLVED_REFERENCE", under(at, "key"), %{"target" => key}}]}}
    end
  end

  defp substitute(%{} = v, at, st, ds) do
    {pairs, {st, ds}} =
      v
      |> Enum.sort()
      |> Enum.map_reduce({st, ds}, fn {k, x}, {st, ds} ->
        {y, {st, more}} = substitute(x, under(at, k), st, [])
        {{k, y}, {st, ds ++ more}}
      end)

    {Map.new(pairs), {st, ds}}
  end

  defp substitute(l, at, st, ds) when is_list(l) do
    {list, {st, ds}} =
      l
      |> Enum.with_index()
      |> Enum.map_reduce({st, ds}, fn {x, i}, {st, ds} ->
        {y, {st, more}} = substitute(x, under(at, i), st, [])
        {y, {st, ds ++ more}}
      end)

    {list, {st, ds}}
  end

  defp substitute(v, _, st, ds), do: {v, {st, ds}}

  # A definition with its `named` leaves substituted, at the site's own path.
  defp site({rel, {_, _, steps}, %{} = value} = file, st, ds) do
    {value, {_, more}} = substitute(value, {rel, steps}, st, [])
    {{rel, elem(file, 1), value}, ds ++ more}
  end

  defp site(file, _st, ds), do: {file, ds}

  # Every condition that can reach itself through `named`.
  defp cyclic(named) do
    graph = Map.new(named, fn {key, {_, value}} -> {key, names(value)} end)
    for {key, _} <- Enum.sort(graph), reaches?(key, graph), do: key
  end

  defp reaches?(key, graph), do: key in closure(Map.get(graph, key, []), graph, MapSet.new())

  defp closure([], _, seen), do: seen

  defp closure(keys, graph, seen) do
    fresh = Enum.reject(Enum.uniq(keys), &MapSet.member?(seen, &1))

    closure(
      Enum.flat_map(fresh, &Map.get(graph, &1, [])),
      graph,
      MapSet.union(seen, MapSet.new(fresh))
    )
  end

  defp names(%{"op" => "named", "key" => key} = leaf) when map_size(leaf) == 2, do: [key]
  # A map iterates as {key, value} pairs, so the pair is taken apart by hand; a tuple that reached
  # names/1 whole would fall to the catch-all and a cycle nested inside an op's arguments would go
  # unseen.
  defp names(%{} = v), do: Enum.flat_map(v, fn {_key, value} -> names(value) end)
  defp names(l) when is_list(l), do: Enum.flat_map(l, &names/1)
  defp names(_), do: []

  defp under({rel, steps}, step), do: {rel, steps ++ [step]}

  defp sort(faults), do: Enum.sort_by(faults, &{elem(&1, 1), elem(&1, 0)})

  @doc """
  Each fault as a diagnostic, built by the two functions Source owns (its `bundle_diag/1` for a
  code and place, its `schema/4` for a condition that is no Policy), so this module never calls
  Source and the two stay acyclic.
  """
  @spec diagnostics([fault()], (term() -> map()), ({at(), term(), [map()]} -> [map()])) :: [
          map()
        ]
  def diagnostics(faults, bundle, schema) do
    Enum.flat_map(faults, fn
      {:policy, at, value, errors} -> schema.({at, value, errors})
      fault -> [bundle.(fault)]
    end)
  end
end
