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

    Enum.flat_map(declared, fn {rel, s} -> service(rel, s, m, defs, text) end) ++
      beds(m, defs, text) ++ api(m, declared) ++ providers(m, defs)
  end

  defp api(m, declared) do
    minimum =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if declared != [] and minimum < [1, 23],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp providers(m, defs) do
    for {key, {rel, [], npc}} <- defs["npc"],
        npc["services"],
        not providers?(npc["services"], ref(key, "npc", m), m, defs),
        do: bad(at(rel, ["services"]))
  end

  defp service(rel, s, m, defs, text) do
    npc = resolved(s["provider"], "npc", m, defs)
    checks = bindings(s, npc, m, defs) ++ benefit(s["benefit"], npc, s, m, defs)

    texts(rel, service_texts(s), text) ++
      for({valid, steps} <- checks, not valid, do: bad(at(rel, steps)))
  end

  defp bindings(s, npc, m, defs) do
    currency = resolved(s["currency"], "resource", m, defs)

    [
      {m["requires"]["capabilities"]["service"] == 1, []},
      {service_action?(defs["action"][s["action"]]), ["action"]},
      {declared_stock?(currency, npc, s["currency"]["key"]), ["currency"]},
      {ref(s["key"], "service", m) in (npc["services"] || []), ["provider"]}
    ]
  end

  defp service_action?({_, [], a}), do: a["command"] == "use_service"
  defp service_action?(_), do: false

  defp service_texts(s) do
    reasons =
      if s["benefit"]["kind"] == "entitlement",
        do: ~w(service.unaffordable service.already_paid),
        else: ~w(service.unaffordable service.full_mv service.sold_out)

    Enum.map(reasons, &{[], &1}) ++ Enum.map(~w(label narration), &{[&1], s[&1]})
  end

  defp benefit(%{"kind" => "entitlement", "fact" => r}, _, _, m, defs) do
    f = resolved(r, "fact", m, defs)
    [{player_bool?(f) and f["value_type"]["default"] == false, ["benefit", "fact"]}]
  end

  defp benefit(b, npc, s, m, defs) do
    recovery = resolved(b["recovery"], "resource", m, defs)
    [{recovery["key"] == "mv", ["benefit", "recovery"]}] ++ stock(b, npc, s, m, defs)
  end

  defp stock(%{"kind" => "meal"} = b, npc, s, m, defs) do
    stock = resolved(b["stock"], "resource", m, defs)

    [
      {declared_stock?(stock, npc, b["stock"]["key"]) and b["stock"] != s["currency"] and
         stock["maximum"] - stock["minimum"] >= b["debit"], ["benefit", "stock"]}
    ]
  end

  defp stock(%{"kind" => "drink"} = b, _, s, m, defs) do
    item = resolved(b["vessel"], "item", m, defs)
    liquid = resolved(b["liquid"], "liquid", m, defs)
    [{held_vessel?(item, s, b) and serves?(item, liquid), ["benefit", "vessel"]}]
  end

  defp declared_stock?(r, npc, key), do: finite?(r) and npc["resource_starts"][key] != nil

  defp held_vessel?(item, service, benefit) do
    location = item["location"]

    location["in"] == "npc" and location["npc"] == service["provider"] and
      item["vessel"]["initial"]["kind"] == benefit["liquid"]
  end

  defp serves?(item, liquid) do
    amount = liquid["drink_amount"]
    vessel = item["vessel"]

    is_integer(amount) and vessel["capacity"] >= amount and
      vessel["initial"]["quantity"] >= amount
  end

  defp player_bool?(f), do: f["scopes"] == ["player"] and f["value_type"]["type"] == "bool"

  defp beds(m, defs, text) do
    for {_, {rel, [], room}} <- defs["room"],
        {key, %{"bed" => bed}} <- Map.get(room, "details", %{}),
        d <- bed(rel, key, bed, m, defs, text),
        do: d
  end

  defp bed(rel, key, bed, m, defs, text) do
    f = resolved(bed["entitlement"], "fact", m, defs)
    caps = m["requires"]["capabilities"]
    valid = player_bool?(f) and caps["position"] == 1 and caps["service"] == 1
    errors = if valid, do: [], else: [bad(at(rel, ["details", key, "bed"]))]
    errors ++ texts(rel, [{["details", key, "bed", "title"], bed["title"]}], text)
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
