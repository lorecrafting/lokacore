defmodule Loka.Content.Services do
  @moduledoc "Checks finite immediate service declarations and their exact provider stock."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2, ref: 3]
  alias Loka.Content.Refs

  defp service_benefit(b, m) do
    fields =
      case b["kind"] do
        "entitlement" -> [{"fact", "fact"}]
        "meal" -> [{"stock", "resource"}, {"recovery", "resource"}]
        "drink" -> [{"vessel", "item"}, {"liquid", "liquid"}, {"recovery", "resource"}]
      end

    Enum.reduce(fields, b, fn {field, kind}, result ->
      Map.update!(result, field, &ref(&1, kind, m))
    end)
  end

  def expand(%{"benefit" => b, "provider" => p, "currency" => c} = s, m) do
    s
    |> Map.put("provider", ref(p, "npc", m))
    |> Map.put("currency", ref(c, "resource", m))
    |> Map.put("benefit", service_benefit(b, m))
  end

  def bed(%{"bed" => %{"entitlement" => _} = b} = d, m),
    do: Map.put(d, "bed", Map.update!(b, "entitlement", &ref(&1, "fact", m)))

  def bed(d, _), do: d

  def npc(%{"services" => services} = n, m),
    do: Map.put(n, "services", Enum.map(services, &ref(&1, "service", m)))

  def npc(n, _), do: n

  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    declared = for {_, {rel, [], s}} <- defs["service"], do: {rel, s}
    errors = Enum.flat_map(declared, fn {rel, s} -> service(rel, s, m, defs, text) end)

    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    api_errors =
      if declared != [] and api < [1, 23],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    errors ++
      beds(m, defs, text) ++
      api_errors ++
      for {key, {rel, [], npc}} <- defs["npc"],
          npc["services"],
          not providers?(npc["services"], ref(key, "npc", m), m, defs),
          do: bad(at(rel, ["services"]))
  end

  defp service(rel, s, m, defs, text) do
    npc = resolved(s["provider"], "npc", m, defs)
    currency = resolved(s["currency"], "resource", m, defs)
    action = defs["action"][s["action"]]

    valid_action =
      case action do
        {_, [], a} -> a["command"] == "use_service"
        _ -> false
      end

    checks =
      [
        {m["requires"]["capabilities"]["service"] == 1, []},
        {valid_action, ["action"]},
        {finite?(currency) and npc["resource_starts"][s["currency"]["key"]] != nil, ["currency"]},
        {ref(s["key"], "service", m) in (npc["services"] || []), ["provider"]}
      ] ++ benefit(s["benefit"], npc, s, m, defs)

    reasons =
      if s["benefit"]["kind"] == "entitlement",
        do: ~w(service.unaffordable service.already_paid),
        else: ~w(service.unaffordable service.full_mv service.sold_out)

    fields = Enum.map(reasons, &{[], &1}) ++ Enum.map(~w(label narration), &{[&1], s[&1]})
    texts(rel, fields, text) ++ for({valid, steps} <- checks, not valid, do: bad(at(rel, steps)))
  end

  defp benefit(%{"kind" => "entitlement", "fact" => r}, _, _, m, defs) do
    f = resolved(r, "fact", m, defs)

    [
      {f["scopes"] == ["player"] and f["value_type"]["type"] == "bool" and
         f["value_type"]["default"] == false, ["benefit", "fact"]}
    ]
  end

  defp benefit(b, npc, s, m, defs) do
    recovery = resolved(b["recovery"], "resource", m, defs)
    result = [{recovery["key"] == "mv", ["benefit", "recovery"]}]

    case b["kind"] do
      "meal" ->
        stock = resolved(b["stock"], "resource", m, defs)

        result ++
          [
            {finite?(stock) and npc["resource_starts"][b["stock"]["key"]] != nil and
               b["stock"] != s["currency"] and stock["maximum"] - stock["minimum"] >= b["debit"],
             ["benefit", "stock"]}
          ]

      "drink" ->
        item = resolved(b["vessel"], "item", m, defs)
        liquid = resolved(b["liquid"], "liquid", m, defs)

        result ++
          [
            {item["location"]["in"] == "npc" and item["location"]["npc"] == s["provider"] and
               item["vessel"]["initial"]["kind"] == b["liquid"] and
               is_integer(liquid["drink_amount"]) and
               item["vessel"]["capacity"] >= liquid["drink_amount"] and
               item["vessel"]["initial"]["quantity"] >= liquid["drink_amount"],
             ["benefit", "vessel"]}
          ]
    end
  end

  defp beds(m, defs, text) do
    for {_, {rel, [], room}} <- defs["room"],
        {key, %{"bed" => bed}} <- Map.get(room, "details", %{}),
        f = resolved(bed["entitlement"], "fact", m, defs),
        d <-
          if(
            f["value_type"]["type"] != "bool" or f["scopes"] != ["player"] or
              m["requires"]["capabilities"]["position"] != 1 or
              m["requires"]["capabilities"]["service"] != 1,
            do: [bad(at(rel, ["details", key, "bed"]))],
            else: []
          ) ++
            texts(rel, [{["details", key, "bed", "title"], bed["title"]}], text),
        do: d
  end

  defp texts(_, _, :unknown), do: []

  defp texts(rel, fields, text),
    do:
      for(
        {steps, key} <- fields,
        not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => key})
      )

  defp providers?(refs, provider, m, defs),
    do:
      Enum.uniq(refs) == refs and
        Enum.all?(refs, &(resolved(&1, "service", m, defs)["provider"] == provider))

  defp finite?(r), do: r["gain"] == 0 and r["regen"] == nil

  defp resolved(r, kind, m, defs) do
    case Refs.resolve(r, kind, m, defs) do
      {_, _, d} -> d
      _ -> %{}
    end
  end

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
