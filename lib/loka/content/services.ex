# size: allow 460, row 20a/20b/25 escrow orders, kgd.70 barters, bank accounts and Built rooms S2-S5 builds, mends and razes check in the same service admission pass
defmodule Loka.Content.Services do
  @moduledoc "Checks finite immediate service declarations and their exact provider stock."
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2, ref: 3]
  alias Loka.Content.{Position, Refs}

  defp benefit_fields(b) do
    case b["kind"] do
      k when k in ~w(entitlement repair) -> [{"fact", "fact"}]
      k when k in ~w(claim cancel) -> [{"service", "service"}]
      k when k in ~w(deposit withdraw) -> [{"account", "fact"}, {"vault", "npc"}]
      "build" -> [{"blueprint", "blueprint"}, {"site", "room"}] ++ fact_field(b)
      k when k in ~w(mend raze) -> [{"site", "room"}]
      "meal" -> [{"stock", "resource"}, {"recovery", "resource"}]
      "drink" -> [{"vessel", "item"}, {"liquid", "liquid"}, {"recovery", "resource"}]
    end
  end

  defp service_benefit(b, m) do
    Enum.reduce(benefit_fields(b), b, fn {field, kind}, result ->
      Map.update!(result, field, &ref(&1, kind, m))
    end)
    |> escrow_refs(m)
  end

  defp fact_field(%{"fact" => _}), do: [{"fact", "fact"}]
  defp fact_field(_), do: []

  defp escrow_refs(%{"escrow" => e} = b, m) do
    items = Enum.map(e["items"], &ref(&1, "item", m))
    e = %{e | "items" => items, "custody" => ref(e["custody"], "room", m)}
    e = if e["output"], do: Map.update!(e, "output", &ref(&1, "item", m)), else: e
    %{b | "escrow" => e}
  end

  defp escrow_refs(b, _), do: b

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
      beds(m, defs, text) ++
      api(m, declared) ++
      providers(m, defs) ++
      owned(declared) ++
      vaults(declared)
  end

  # Toolbox row 25: the services on one account name one vault and one currency.
  defp vaults(declared) do
    banks = for {rel, s} <- declared, bank?(s["benefit"]), do: {rel, s}

    for {rel, s} <- banks,
        Enum.any?(banks, fn {_, o} -> account(o) == account(s) and home(o) != home(s) end),
        do: bad(at(rel, ["benefit", "vault"]))
  end

  defp account(s), do: s["benefit"]["account"]
  defp home(s), do: {s["benefit"]["vault"], s["currency"]}

  defp bank?(b), do: b["kind"] in ~w(deposit withdraw)

  # Toolbox row 20b: a timed order's fact belongs to its commission alone; another entitlement
  # setting it would open an order with no inputs and no job (Built rooms S3: or a build commission).
  defp owned(declared) do
    owners =
      for {rel, %{"benefit" => %{"escrow" => %{"ready_after" => _}} = b}} <- declared,
          do: {b["fact"], rel}

    for {rel, %{"benefit" => %{"kind" => k, "fact" => f}}} <- declared,
        k in ~w(entitlement build),
        Enum.any?(owners, fn {o, owner} -> o == f and owner != rel end),
        do: bad(at(rel, ["benefit", "fact"]))
  end

  defp api(m, declared) do
    minimum =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if declared != [] and minimum < api_floor(Enum.map(declared, fn {_, s} -> s end)),
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp api_floor(services) do
    benefits = Enum.map(services, & &1["benefit"])

    cond do
      Enum.any?(services, &barter?/1) -> [1, 101]
      Enum.any?(benefits, &bank?/1) -> [1, 83]
      Enum.any?(benefits, &timed?/1) -> [1, 80]
      Enum.any?(benefits, & &1["escrow"]) -> [1, 79]
      true -> [1, 23]
    end
  end

  # Row kgd.70 (API 1.101): a free service, or an output handed over at once (no ready_after).
  defp barter?(%{"price" => p, "benefit" => b}),
    do: p == 0 or (is_map_key(b["escrow"] || %{}, "output") and not timed?(b))

  defp timed?(b),
    do: b["kind"] in ~w(claim cancel) or is_map_key(b["escrow"] || %{}, "ready_after")

  defp providers(m, defs) do
    for {key, {rel, [], npc}} <- defs["npc"],
        npc["services"],
        not providers?(npc["services"], ref(key, "npc", m), m, defs),
        do: bad(at(rel, ["services"]))
  end

  defp service(rel, s, m, defs, text) do
    npc = resolved(s["provider"], "npc", m, defs)
    checks = bindings(s, npc, m, defs) ++ benefit(s["benefit"], npc, s, m, defs) ++ [free(s)]

    texts(rel, service_texts(s), text) ++
      for({valid, steps} <- checks, not valid, do: bad(at(rel, steps))) ++
      escrow(rel, s["benefit"]["escrow"], m, defs) ++ benefit_refs(rel, s["benefit"], m, defs)
  end

  # Row kgd.70: only an escrowed entitlement may be free (a barter); any other benefit is paid.
  defp free(%{"price" => p, "benefit" => b}),
    do: {p != 0 or (b["kind"] == "entitlement" and is_map_key(b, "escrow")), ["price"]}

  defp benefit_refs(rel, %{"service" => r}, m, defs),
    do: unresolved(r, "service", at(rel, ["benefit", "service"]), m, defs)

  defp benefit_refs(rel, %{"account" => a, "vault" => v}, m, defs),
    do:
      unresolved(a, "fact", at(rel, ["benefit", "account"]), m, defs) ++
        unresolved(v, "npc", at(rel, ["benefit", "vault"]), m, defs)

  defp benefit_refs(rel, %{"kind" => "build", "blueprint" => b, "site" => r}, m, defs),
    do:
      unresolved(b, "blueprint", at(rel, ["benefit", "blueprint"]), m, defs) ++
        unresolved(r, "room", at(rel, ["benefit", "site"]), m, defs)

  defp benefit_refs(rel, %{"kind" => k, "site" => r}, m, defs) when k in ~w(mend raze),
    do: unresolved(r, "room", at(rel, ["benefit", "site"]), m, defs)

  defp benefit_refs(_, _, _, _), do: []

  # Toolbox row 20a: distinct items held to a room; no shop offer (commerce save reconciles offer
  # custody by receipt and would refuse a service transfer of one).
  defp escrow(_, nil, _, _), do: []

  defp escrow(rel, %{"items" => items, "quantity" => quantity, "custody" => custody} = e, m, defs) do
    path = &at(rel, ["benefit", "escrow" | &1])

    shape = [
      {Enum.uniq(items) == items, diag("DUPLICATE_DEFINITION", path.(["items"]))},
      {quantity <= length(items), bad(path.(["quantity"]))}
    ]

    inputs(items, path, m, defs) ++
      unresolved(custody, "room", path.(["custody"]), m, defs) ++
      for({false, d} <- shape, do: d) ++ output(path, e, m, defs)
  end

  # Toolbox row 20b: the work job a timed order (output comes with ready_after) needs schedule.
  defp schedule(path, m) do
    owner = %{"capability" => "schedule"}

    if is_map_key(m["requires"]["capabilities"], "schedule"),
      do: [],
      else: [diag("UNDECLARED_CAPABILITY", path.(["ready_after"]), owner, ["schedule@1"])]
  end

  # Toolbox row 20b: the finished output already lies in custody.
  defp output(path, %{"output" => r, "custody" => custody} = e, m, defs) do
    at = path.(["output"])

    # Row kgd.70: an output with no ready_after is a barter, handed over at once; no job.
    if(is_map_key(e, "ready_after"), do: schedule(path, m), else: []) ++
      case Refs.resolve(r, "item", m, defs) do
        :unresolved -> [diag("UNRESOLVED_REFERENCE", at, %{"target" => r})]
        {_, _, %{"location" => %{"in" => "room", "room" => ^custody}}} -> []
        _ -> [bad(at)]
      end
  end

  # Built rooms S3: a build commission has ready_after and no output.
  defp output(path, %{"ready_after" => _}, m, _), do: schedule(path, m)
  defp output(_, _, _, _), do: []

  defp inputs(items, path, m, defs) do
    offered =
      for {_, {_, [], %{"shop" => shop}}} <- defs["npc"], o <- shop["offers"], do: o["item"]

    for {r, i} <- Enum.with_index(items),
        at = path.(["items", i]),
        d <- unresolved(r, "item", at, m, defs) ++ if(r in offered, do: [bad(at)], else: []),
        do: d
  end

  defp unresolved(r, kind, path, m, defs) do
    case Refs.resolve(r, kind, m, defs) do
      :unresolved -> [diag("UNRESOLVED_REFERENCE", path, %{"target" => r})]
      _ -> []
    end
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

  defp entitlement_texts(nil), do: ~w(service.unaffordable service.already_paid)

  defp entitlement_texts(%{"output" => _}),
    do: entitlement_texts(%{}) ++ ~w(service.no_output)

  defp entitlement_texts(_),
    do: ~w(service.unaffordable service.order_open service.missing_inputs)

  defp service_texts(s),
    do:
      Enum.map(reasons(s["benefit"]), &{[], &1}) ++ Enum.map(~w(label narration), &{[&1], s[&1]})

  defp reasons(%{"kind" => "entitlement"} = b), do: entitlement_texts(b["escrow"])

  defp reasons(%{"kind" => "repair"}),
    do: ~w(service.unaffordable service.nothing_to_repair service.full_durability)

  defp reasons(%{"kind" => "claim"}),
    do: ~w(service.unaffordable service.no_order service.not_ready service.no_output)

  defp reasons(%{"kind" => "cancel"}), do: ~w(service.unaffordable service.no_order service.ready)

  defp reasons(%{"kind" => k}) when k in ~w(deposit withdraw),
    do: ~w(service.unaffordable service.no_funds)

  defp reasons(%{"kind" => "build"} = b),
    do:
      ~w(service.unaffordable service.site_taken service.construction_full) ++
        if(b["escrow"], do: ~w(service.order_open service.missing_inputs), else: [])

  defp reasons(%{"kind" => "mend"} = b),
    do:
      ~w(service.unaffordable service.nothing_to_mend) ++
        if(b["escrow"], do: ~w(service.missing_inputs), else: [])

  defp reasons(%{"kind" => "raze"}),
    do: ~w(service.unaffordable service.nothing_to_raze service.occupied)

  defp reasons(_), do: ~w(service.unaffordable service.full_mv service.sold_out)

  defp benefit(%{"kind" => "entitlement", "fact" => r}, _, _, m, defs) do
    f = resolved(r, "fact", m, defs)
    [{player_bool?(f) and f["value_type"]["default"] == false, ["benefit", "fact"]}]
  end

  # Toolbox row 21: a repair restores a fact some weapon's durability names.
  defp benefit(%{"kind" => "repair", "fact" => r}, _, _, _, defs) do
    named = for {_, {_, _, %{"weapon" => %{"durability" => d}}}} <- defs["item"], do: d["fact"]
    [{r in named, ["benefit", "fact"]}]
  end

  # Toolbox row 20b: claim and cancel name a timed commission; Built rooms S3: a claim one with
  # an output (a build raises its room instead); row kgd.70: a barter (no ready_after) leaves none.
  defp benefit(%{"kind" => k, "service" => r}, _, _, m, defs) when k in ~w(claim cancel) do
    c = resolved(r, "service", m, defs)
    e = c["benefit"]["escrow"] || %{}
    settles = is_map_key(e, "ready_after") and (k == "cancel" or is_map_key(e, "output"))
    [{c == %{} or settles, ["benefit", "service"]}]
  end

  # Toolbox row 25: the account is a bounded int player fact from 0 no other engine writer owns;
  # the vault holds the currency; both can hold `amount`.
  defp benefit(%{"kind" => k, "account" => a, "vault" => v, "amount" => n}, _, s, m, defs)
       when k in ~w(deposit withdraw) do
    f = resolved(a, "fact", m, defs)
    vault = resolved(v, "npc", m, defs)

    [
      {f == %{} or account?(f, a, m, defs), ["benefit", "account"]},
      {vault == %{} or (vault["resource_starts"] || %{})[s["currency"]["key"]] != nil,
       ["benefit", "vault"]},
      {holds?(f["value_type"], n) and holds?(resolved(s["currency"], "resource", m, defs), n),
       ["benefit", "amount"]}
    ]
  end

  # Built rooms S2: a resolved site lists the direction and a resolved blueprint.
  defp benefit(%{"kind" => "build", "blueprint" => b, "site" => r} = build, _, _, m, defs) do
    case Refs.resolve(r, "room", m, defs) do
      {_, _, room} ->
        site = room["site"] || %{}

        [
          {resolved(b, "blueprint", m, defs) == %{} or b in (site["blueprints"] || []),
           ["benefit", "blueprint"]},
          {build["direction"] in (site["directions"] || []), ["benefit", "direction"]}
        ]

      _ ->
        []
    end ++ build_fact(build, m, defs)
  end

  # Built rooms S4: a resolved site lists the direction and some blueprint with a ruin to cure.
  defp benefit(%{"kind" => "mend", "site" => r} = mend, _, _, m, defs) do
    case Refs.resolve(r, "room", m, defs) do
      {_, _, room} ->
        site = room["site"] || %{}
        ruin? = &(resolved(&1, "blueprint", m, defs)["ruin"] != nil)

        [
          {mend["direction"] in (site["directions"] || []), ["benefit", "direction"]},
          {Enum.any?(site["blueprints"] || [], ruin?), ["benefit", "site"]}
        ]

      _ ->
        []
    end
  end

  # Built rooms S5: a resolved site lists the direction.
  defp benefit(%{"kind" => "raze", "site" => r} = raze, _, _, m, defs) do
    case Refs.resolve(r, "room", m, defs) do
      {_, _, room} ->
        [
          {raze["direction"] in ((room["site"] || %{})["directions"] || []),
           ["benefit", "direction"]}
        ]

      _ ->
        []
    end
  end

  defp benefit(b, npc, s, m, defs) do
    recovery = resolved(b["recovery"], "resource", m, defs)
    [{recovery["key"] == "mv", ["benefit", "recovery"]}] ++ stock(b, npc, s, m, defs)
  end

  # Built rooms S3: a build commission's fact is an entitlement's (a player bool from false).
  defp build_fact(%{"fact" => r}, m, defs),
    do: benefit(%{"kind" => "entitlement", "fact" => r}, nil, nil, m, defs)

  defp build_fact(_, _, _), do: []

  defp account?(%{"value_type" => t} = f, a, m, defs),
    do:
      f["scopes"] == ["player"] and t["type"] == "int" and t["minimum"] == 0 and
        is_integer(t["maximum"]) and t["default"] == 0 and
        a["key"] not in Position.foreign_names(m, defs)

  defp holds?(%{"minimum" => lo, "maximum" => hi}, n) when is_integer(lo) and is_integer(hi),
    do: hi - lo >= n

  defp holds?(_, _), do: true

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
