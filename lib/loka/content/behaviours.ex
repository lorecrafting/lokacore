defmodule Loka.Content.Behaviours do
  @moduledoc """
  Behaviours: `behaviours/<name>.json` holds `{"params": [...], "reactions": {"<rule>": rule}}`,
  and an NPC or item listing `"behaviours": ["<name>" | {"behaviour": "<name>", "with": {...}}]`
  gets one copy `<rule>_<holder>` of each rule, with `{"param": "holder"}` replaced by its key and
  every other marker by its `with` argument (docs/system/cartridge.md, Source shortcuts).
  `expand/1` removes every behaviour and strips `behaviours` from every NPC and item. It returns
  faults; Source builds the diagnostics, so this module never calls Source.
  """

  alias Loka.Content.Params
  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  @doc "Every behaviour replaced by its copies on its holders; Zones.expand refuses a repeated key."
  @spec expand([entry()]) :: {[entry()], [fault()]}
  def expand(files) do
    {defs, files} = Enum.split_with(files, &match?({_, {:behaviour, _, _}, _}, &1))
    {named, refused} = defs |> Enum.map(&rules/1) |> Enum.unzip()
    named = Map.new(named)
    {files, faults} = files |> Enum.map(&hold(&1, named)) |> Enum.unzip()
    {List.flatten(files), List.flatten(refused) ++ List.flatten(faults)}
  end

  # name => {params, [{rel, steps, rule, value}]}; a refused or undecodable behaviour stays known,
  # with params nil and no rules, so its holders add no second cause.
  defp rules({rel, {_, name, steps}, %{} = value}) do
    extra =
      for m <- Map.keys(value),
          m not in ["reactions", "params"],
          do: {"UNKNOWN_FIELD", {rel, steps ++ [m]}, %{}}

    {rs, bad} = reactions({rel, steps ++ ["reactions"]}, value["reactions"])
    {params, wrong} = params({rel, steps}, value)

    case bad ++ wrong do
      [] -> {{name, {params, rs}}, extra}
      refused -> {{name, {nil, []}}, refused ++ extra}
    end
  end

  defp rules({_, {_, name, _}, :invalid}), do: {{name, {nil, []}}, []}
  defp rules({rel, {_, name, steps}, _}), do: {{name, {nil, []}}, [invalid_type({rel, steps})]}

  defp params({rel, steps}, value) do
    params = Map.get(value, "params", [])

    case Params.declared(params, ["holder"]) do
      {:error, e} ->
        {nil, [{"SCHEMA_VIOLATION", {rel, steps ++ ["params"]}, %{"error" => e}}]}

      :ok ->
        markers = Params.unresolved(value["reactions"], ["holder" | params])
        at = steps ++ ["reactions"]
        {params, for({path, n} <- markers, do: unresolved({rel, at ++ path}, n))}
    end
  end

  defp reactions({rel, steps}, %{} = rs),
    do: {for({r, v} <- rs, do: {rel, steps ++ [r], r, v}), []}

  defp reactions(at, _), do: {[], [invalid_type(at)]}

  defp hold({rel, {kind, holder, steps} = id, %{"behaviours" => names} = value}, named)
       when kind in [:npc, :item] do
    {copies, faults} = copies(names, named, holder, {rel, steps ++ ["behaviours"]})
    {[{rel, id, Map.delete(value, "behaviours")} | copies], faults}
  end

  defp hold(file, _), do: {[file], []}

  defp copies(names, named, holder, at) do
    attached = if is_list(names), do: Enum.map(names, &attachment/1)

    if attached && Enum.all?(attached) do
      # A name listed twice counts once, at its first index.
      attached
      |> Enum.with_index()
      |> Enum.uniq_by(fn {{n, _}, _} -> n end)
      |> Enum.map(&attach(&1, named[elem(elem(&1, 0), 0)], holder, at))
      |> Enum.unzip()
    else
      {[], [invalid_type(at)]}
    end
  end

  # `{name, with}`, or nil when the entry is neither a Key nor `{"behaviour": Key, "with": ...}`.
  defp attachment(%{"behaviour" => name} = a) do
    if key?(name) and Map.keys(a) -- ["behaviour", "with"] == [],
      do: {name, Map.get(a, "with", %{})}
  end

  defp attachment(name), do: if(key?(name), do: {name, %{}})

  defp key?(name), do: Contracts.validate("Key", name) == :ok

  defp attach({{name, _}, i}, nil, _, {rel, steps}),
    do: {[], [unresolved({rel, steps ++ [i]}, "behaviours/" <> name)]}

  defp attach(_, {nil, _}, _, _), do: {[], []}

  defp attach({{_, with}, i}, {params, rs}, holder, {rel, steps}) do
    case Params.check(with, params) do
      [] ->
        {for(r <- rs, do: copy(r, holder, Map.put(with, "holder", holder))), []}

      faults ->
        {[], for({c, path, d} <- faults, do: {c, {rel, steps ++ [i, "with" | path]}, d})}
    end
  end

  # A copy keeps the behaviour rule's location, so each diagnostic reports once there.
  defp copy({rel, steps, rule, value}, holder, args),
    do: {rel, {:reaction, "#{rule}_#{holder}", steps}, Params.fill(value, args)}

  defp unresolved(at, target), do: {"UNRESOLVED_REFERENCE", at, %{"target" => target}}
  defp invalid_type(at), do: {"SCHEMA_VIOLATION", at, %{"error" => "invalid_type"}}
end
