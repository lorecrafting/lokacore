defmodule Loka.Content.Checks do
  @moduledoc """
  Manifest requirements, capability ownership, references and fact types (05 §3, §4, §6;
  06 §20–21). `registry` is a decoded capability registry (CapabilitySpec entries, like
  protocol/capability_registry.json); ownership comes from its commands and policies.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2, ref: 3]
  alias Loka.Content.RoomParts
  alias Loka.Core.Canonical
  alias Loka.Core.Contracts

  @supported_pin 1
  @ref_fields %{"fact_compare" => "fact", "has_item" => "item", "quest_state" => "quest"}
  # A definition sits inside the artifact, the cartridge and its kind's map.
  @enclosing 3

  @doc "Diagnostics for a schema-valid manifest's requires and supported_profiles."
  @spec requirements(String.t(), map(), [map()]) :: [map()]
  def requirements(rel, %{"requires" => req} = m, registry) do
    offline? = "offline_private" in m["supported_profiles"]

    range(rel, req["kernel_api"]) ++
      pins(rel, req) ++
      Enum.flat_map(req["capabilities"], &capability(rel, &1, offline?, registry))
  end

  defp range(rel, %{"at_least" => low, "below" => high}) do
    if version(low) >= version(high),
      do: [diag("KERNEL_API_RANGE_INVALID", at(rel, ["requires", "kernel_api"]))],
      else: []
  end

  defp pins(rel, req) do
    for field <- ~w(content_schema rule_ir), req[field] != @supported_pin do
      data = %{"field" => field, "declared" => req[field], "supported" => @supported_pin}
      diag("PINNED_VERSION_UNSUPPORTED", at(rel, ["requires", field]), data)
    end
  end

  defp version(v), do: v |> String.split(".") |> Enum.map(&String.to_integer/1)

  defp capability(rel, {key, v}, offline?, registry) do
    path = at(rel, ["requires", "capabilities", key])

    case Enum.find(registry, &(&1["key"] == key and &1["version"] == v)) do
      nil -> [diag("UNKNOWN_CAPABILITY", path)]
      %{"portability" => "server_only"} when offline? -> [diag("SERVER_ONLY_CAPABILITY", path)]
      _ -> []
    end
  end

  @doc """
  `v` with each short reference expanded (owner decision 2026-09-25): a Key where a policy
  node's reference (fact, item, quest), in any policy tree (a variant's condition included), or
  an exit's `to` goes becomes the DefinitionRef of cartridge `m`'s definition of that key, of
  the kind the field takes (`Source.ref/3`).
  """
  @spec expand(term(), map()) :: term()
  def expand(%{"op" => op} = n, m) when is_map_key(@ref_fields, op),
    do: Map.update!(n, @ref_fields[op], &ref(&1, @ref_fields[op], m))

  def expand(%{"exits" => exits} = room, m) when is_map(exits) do
    to = fn {d, e} -> {d, Map.update!(e, "to", &ref(&1, "room", m))} end
    room |> Map.delete("exits") |> expand(m) |> Map.put("exits", Map.new(exits, to))
  end

  def expand(v, m) when is_map(v), do: Map.new(v, fn {k, x} -> {k, expand(x, m)} end)
  def expand(v, m) when is_list(v), do: Enum.map(v, &expand(&1, m))
  def expand(v, _), do: v

  @doc """
  Diagnostics across the schema-valid definitions (`kind => key => {rel, steps, value}`):
  nesting depth, and, given a valid manifest, commands, policy ops and references.
  """
  @spec check(map() | nil, map(), [map()]) :: [map()]
  def check(manifest, defs, registry) do
    all = for {_, ds} <- defs, is_map(ds), {_, {_, _, _} = d} <- ds, do: d

    Enum.flat_map(all, &depth/1) ++
      if(manifest, do: uses(manifest, defs, owners(registry)), else: [])
  end

  defp depth({rel, steps, value}) do
    max = Canonical.max_depth()

    if @enclosing + nesting(value) > max,
      do: [diag("NESTING_TOO_DEEP", at(rel, steps), %{"maximum" => max})],
      else: []
  end

  defp nesting(v) when is_map(v), do: 1 + Enum.reduce(v, 0, &max(nesting(elem(&1, 1)), &2))
  defp nesting(v) when is_list(v), do: 1 + Enum.reduce(v, 0, &max(nesting(&1), &2))
  defp nesting(_), do: 0

  defp owners(registry, fields \\ ["commands", "policies"]) do
    for c <- registry,
        name <- Enum.flat_map(fields, &Map.get(c, &1, [])),
        into: %{},
        do: {name, {c["key"], "#{c["key"]}@#{c["version"]}"}}
  end

  @doc """
  Diagnostics for a v2 source (`{entry, text}`; nil for v1): the entry is present, each room's
  owning capability is required, exits and the entry name rooms of this cartridge, and each
  room's and action's text keys have a catalog entry (unless the catalog was rejected,
  `:unknown`).
  """
  @spec rooms(map() | nil, map(), {map() | nil, map() | :unknown} | nil, [map()]) :: [map()]
  def rooms(_, _, nil, _), do: []

  def rooms(m, defs, {entry, text}, registry) do
    rooms = for {_, {rel, [], r}} <- defs["room"], do: {rel, r}

    entry(m, entry, defs) ++
      texts(defs, text) ++
      if(m, do: Enum.flat_map(rooms, &room(&1, m, defs, registry)), else: [])
  end

  defp texts(defs, text) do
    for(
      {kind, fields} <- [{"room", ~w(title description)}, {"action", ~w(label accessibility)}],
      {_, {rel, [], def}} <- defs[kind],
      d <- text_keys({rel, def}, fields, text),
      do: d
    ) ++ RoomParts.details(defs, text) ++ RoomParts.variant_texts(defs, text)
  end

  # Without a valid manifest the entry is unknown, not missing.
  defp entry(nil, _, _), do: []

  defp entry(_, nil, _),
    do: [diag("SCHEMA_VIOLATION", "cartridge.entry", %{"error" => "missing_property"})]

  defp entry(m, ref, defs),
    do: reference("cartridge.json", [], {"entry", "room"}, %{"entry" => ref}, m, defs)

  defp room({rel, r}, m, defs, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    owned(at(rel, []), "room", required) ++
      for(
        {k, _} <- Map.get(r, "details", %{}),
        d <- owned(at(rel, ["details", k]), "detail", required),
        do: d
      ) ++
      for(
        {steps, _} <- RoomParts.variants(r),
        d <- owned(at(rel, steps), "variant", required),
        do: d
      ) ++
      for {dir, exit} <- r["exits"],
          d <- reference(rel, ["exits", dir], {"to", "room"}, exit, m, defs),
          do: d
  end

  defp text_keys(_, _, :unknown), do: []

  defp text_keys({rel, r}, fields, text) do
    for field <- fields, not is_map_key(text, r[field]) do
      diag("UNRESOLVED_REFERENCE", at(rel, [field]), %{"target" => r[field]})
    end
  end

  defp uses(m, defs, owners) do
    required = {m["requires"]["capabilities"], owners}
    actions = for {_, {rel, [], a}} <- defs["action"], do: {rel, a}

    Enum.flat_map(actions, fn {rel, a} -> command(rel, a["command"], required) end) ++
      Enum.flat_map(trees(defs, actions), &tree(&1, {m, defs, required}))
  end

  defp tree({rel, steps, root}, ctx),
    do: for({node, at} <- nodes(root, steps), d <- node(rel, at, node, ctx), do: d)

  # Every policy tree: a named policy's root, each action's inline one and each variant's.
  defp trees(defs, actions) do
    for({_, {rel, [], p}} <- defs["policy"], do: {rel, ["root"], p["root"]}) ++
      for({rel, a} <- actions, do: {rel, ["policy", "root"], a["policy"]["root"]}) ++
      for {_, {rel, [], r}} <- defs["room"],
          {steps, v} <- RoomParts.variants(r),
          do: {rel, steps ++ ["when", "root"], v["when"]["root"]}
  end

  defp command(rel, name, required) do
    if name in commands(),
      do: owned(at(rel, ["command"]), name, required),
      else: [diag("UNKNOWN_COMMAND", at(rel, ["command"]))]
  end

  defp commands,
    do:
      for(b <- Contracts.defs()["CommandPayload"]["oneOf"], do: b["properties"]["type"]["const"])

  defp nodes(%{"op" => op, "items" => items} = n, steps) when op in ~w(all any) do
    children =
      items
      |> Enum.with_index()
      |> Enum.flat_map(fn {c, i} -> nodes(c, steps ++ ["items", i]) end)

    [{n, steps} | children]
  end

  defp nodes(%{"op" => "not", "item" => item} = n, steps),
    do: [{n, steps} | nodes(item, steps ++ ["item"])]

  defp nodes(n, steps), do: [{n, steps}]

  defp node(rel, steps, %{"op" => op} = n, {m, defs, required}) do
    owned(at(rel, steps ++ ["op"]), op, required) ++
      case @ref_fields[op] do
        nil -> []
        field -> reference(rel, steps, field, n, m, defs)
      end
  end

  defp owned(path, name, {required, owners}) do
    {key, pin} = owners[name]

    if is_map_key(required, key),
      do: [],
      else: [diag("UNDECLARED_CAPABILITY", path, %{"capability" => key}, [pin])]
  end

  defp reference(rel, steps, field, n, m, defs) when is_binary(field),
    do: reference(rel, steps, {field, field}, n, m, defs)

  defp reference(rel, steps, {field, kind}, n, m, defs) do
    ref = n[field]

    case resolve(ref, kind, m, defs) do
      :unresolved ->
        s = "#{ref["cartridge_id"]}@#{ref["cartridge_version"]}:#{ref["kind"]}/#{ref["key"]}"
        [diag("UNRESOLVED_REFERENCE", at(rel, steps ++ [field]), %{"target" => s})]

      {_, _, %{"value_type" => t}} ->
        if typed?(n["equals"], t),
          do: [],
          else: [diag("FACT_TYPE_MISMATCH", at(rel, steps ++ ["equals"]))]

      _ ->
        []
    end
  end

  # A ref names this cartridge and the kind its field is named after (fact, item, quest).
  # An :invalid definition or an :unknown namespace (rejected facts.json) counts as
  # resolved: the real error is already reported there.
  defp resolve(
         %{"cartridge_id" => id, "cartridge_version" => v, "kind" => k, "key" => key},
         k,
         %{
           "id" => id,
           "version" => v
         },
         defs
       ) do
    case defs[k] do
      %{^key => target} -> target
      :unknown -> :unknown
      _ -> :unresolved
    end
  end

  defp resolve(_, _, _, _), do: :unresolved

  defp typed?(v, %{"type" => "bool"}), do: is_boolean(v)
  defp typed?(v, %{"type" => "enum", "values" => vs}), do: v in vs

  defp typed?(v, %{"type" => "int"} = t),
    do: is_integer(v) and v >= Map.get(t, "minimum", v) and v <= Map.get(t, "maximum", v)
end
