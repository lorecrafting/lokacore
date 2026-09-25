defmodule Loka.Core.RegistriesTest do
  # The protocol/ registries: each entry valid against its contract, and each registry
  # consistent with the contracts and files it names. Fixtures are decoded with the stdlib
  # JSON so they never pass through the code under test.
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts

  @invalid JSON.decode!(File.read!("protocol/fixtures/invalid.json"))
  @registry JSON.decode!(File.read!("protocol/error_registry.json"))
  @effects JSON.decode!(File.read!("protocol/effect_registry.json"))
  @invariants JSON.decode!(File.read!("protocol/invariants.json"))
  @capabilities JSON.decode!(File.read!("protocol/capability_registry.json"))
  @lock_kat JSON.decode!(File.read!("protocol/fixtures/capability_lock_hash.json"))
  @cartridge_kat JSON.decode!(File.read!("protocol/fixtures/cartridge_hash.json"))

  test "the registry lists exactly the ErrorCode codes, each entry valid" do
    for entry <- @registry,
        do: assert(Contracts.validate("ErrorRegistryEntry", entry) == :ok, inspect(entry))

    assert Enum.sort(for e <- @registry, do: e["code"]) ==
             Enum.sort(Contracts.defs()["ErrorCode"]["enum"])
  end

  # Breaks if a name is registered without a record branch (or the reverse), or a branch's
  # store, or a metric's Measure data, disagrees with its registry entry (ADR-075).
  test "the event registry lists exactly the ObservationRecord events, same store and kind" do
    events = JSON.decode!(File.read!("protocol/event_registry.json"))

    for entry <- events,
        do: assert(Contracts.validate("EventRegistryEntry", entry) == :ok, inspect(entry))

    branches =
      for %{"properties" => p} <- Contracts.defs()["ObservationRecord"]["oneOf"],
          do: {p["event"]["const"], p["store"]["enum"], p["data"]["$ref"] == "Measure"}

    assert Enum.sort(for e <- events, do: {e["name"], [e["store"]], e["kind"] == "metric"}) ==
             Enum.sort(branches)
  end

  # docs/dev-evidence.jsonl (ADR-075 §7): every line a canonical agent.work record, and
  # (pull_request, role, instance) unique. Breaks if the PM appends a malformed, non-canonical,
  # misfiled or repeated record.
  defp evidence_problems(lines) do
    checked = for l <- lines, d = Loka.Core.Canonical.decode(l), do: {l, d, line_problem(l, d)}

    keys = for {_, {:ok, v}, nil} <- checked, do: evidence_key(v)

    for({l, _, problem} <- checked, problem != nil, do: {problem, l}) ++
      for {k, n} <- Enum.frequencies(keys), n > 1, do: {:duplicate, k}
  end

  defp evidence_key(%{"ids" => ids, "data" => d}),
    do: {ids["pull_request"], d["role"], d["instance"]}

  defp line_problem(_, {:error, _}), do: :invalid_json

  defp line_problem(line, {:ok, v}) do
    cond do
      Contracts.validate("ObservationRecord", v) != :ok -> :invalid
      v["event"] != "agent.work" -> :wrong_event
      Loka.Core.Canonical.encode(v) != {:ok, line} -> :not_canonical
      true -> nil
    end
  end

  test "docs/dev-evidence.jsonl holds only unique canonical agent.work records" do
    lines = String.split(File.read!("docs/dev-evidence.jsonl"), "\n", trim: true)
    assert evidence_problems(lines) == []
  end

  test "the dev-evidence check catches a bare token count, a repeat, a misfiled and a non-canonical line" do
    [latency, work] =
      for e <- ["kernel.decision_latency", "agent.work"],
          do: Enum.find(Contracts.defs()["ObservationRecord"]["examples"], &(&1["event"] == e))

    {:ok, good} = Loka.Core.Canonical.encode(work)
    {:ok, misfiled} = Loka.Core.Canonical.encode(latency)
    bare = String.replace(good, ~s({"state":"unknown"}), "0")
    spaced = String.replace(good, ",", ", ")

    assert Enum.sort(evidence_problems([good, good, bare, misfiled, spaced])) ==
             Enum.sort([
               {:duplicate, {27, "reviewer", 1}},
               {:invalid, bare},
               {:wrong_event, misfiled},
               {:not_canonical, spaced}
             ])
  end

  # The 14 §R3B list, one kind per named type; ActionRecipe/ComposedAction is one (21 §7).
  @r3b ~w(action_recipe inspectable_detail description_variant connection barrier reaction_rule
          consequence_operator narration_spec scene_definition scene_instance scene_space
          instance_plan spawn_bundle population_plan commerce_composition service capacity
          service_job world_event_plan)

  test "the feature registry lists every 14 §R3B kind once, each entry valid" do
    features = JSON.decode!(File.read!("protocol/feature_registry.json"))

    for entry <- features,
        do: assert(Contracts.validate("FeatureRegistryEntry", entry) == :ok, inspect(entry))

    kinds = for e <- features, do: e["kind"]
    assert Enum.sort(kinds) == Enum.sort(@r3b)
    assert Enum.sort(Contracts.defs()["FeatureKind"]["enum"]) == Enum.sort(@r3b)
  end

  test "every code the fixtures expect is a registered abi_validation code" do
    registered = for %{"code" => c, "category" => "abi_validation"} <- @registry, do: c
    for %{"errors" => es} <- @invalid, %{"code" => c} <- es, do: assert(c in registered, c)
  end

  test "the effect registry classifies exactly the EffectPayload types, each entry valid" do
    for entry <- @effects,
        do: assert(Contracts.validate("EffectRegistryEntry", entry) == :ok, inspect(entry))

    types =
      for b <- Contracts.defs()["EffectPayload"]["oneOf"], do: b["properties"]["type"]["const"]

    assert Enum.sort(for e <- @effects, do: e["type"]) == Enum.sort(types)
  end

  test "every effect origin is a registered capability key" do
    keys = for c <- @capabilities, do: c["key"]
    for e <- @effects, origin <- e["allowed_origins"], do: assert(origin in keys, origin)
  end

  # Gate R3 gap 2: every registered command, event and policy op has exactly one owning
  # capability key (each version of it lists the name), recorded on the registry entry, so
  # the owner is always a registered capability; the schemas stay the only catalogs of names.
  @owned for {field, contract, tag} <- [
               {"commands", "CommandPayload", "type"},
               {"events", "EventPayload", "type"},
               {"policies", "Policy", "op"}
             ],
             do:
               {field,
                for(b <- Contracts.defs()[contract]["oneOf"], do: b["properties"][tag]["const"])}

  defp ownership_problems(registry) do
    for {field, names} <- @owned,
        owners = owner_counts(registry, field),
        n <- Enum.uniq(names ++ Map.keys(owners)),
        problem = ownership(n in names, Map.get(owners, n, 0)),
        problem != nil,
        do: {problem, n}
  end

  # name => how many distinct capability keys list it
  defp owner_counts(registry, field) do
    for(c <- registry, n <- c[field] || [], uniq: true, do: {n, c["key"]})
    |> Enum.frequencies_by(&elem(&1, 0))
  end

  defp ownership(false, _), do: :unknown
  defp ownership(true, 0), do: :unowned
  defp ownership(true, 1), do: nil
  defp ownership(true, _), do: :two_owners

  test "every command, event and policy op has exactly one owning capability" do
    assert ownership_problems(@capabilities) == []
  end

  test "the ownership check catches an unowned, a doubly owned and an unknown name, not a second version" do
    dialogue = Enum.find(@capabilities, &(&1["key"] == "dialogue"))

    planted =
      for c <- [%{dialogue | "version" => 2} | @capabilities] do
        case c["key"] do
          "movement" -> Map.delete(c, "commands")
          "quest" -> Map.update!(c, "commands", &["take", "fly" | &1])
          _ -> c
        end
      end

    assert Enum.sort(ownership_problems(planted)) ==
             [{:two_owners, "take"}, {:unknown, "fly"}, {:unowned, "move"}]
  end

  # Invariants are checked by id (docs/ROADMAP.md), so an id must name one invariant, and a
  # citation must point at a real docs/spec heading.
  defp invariant_problems(entries) do
    dupes = for {id, n} <- Enum.frequencies_by(entries, & &1["id"]), n > 1, do: {:duplicate, id}

    dupes ++
      for e <- entries,
          problem <- [entry_problem(e)],
          problem != nil,
          do: {problem, e["id"]}
  end

  defp entry_problem(e) do
    with :ok <- Contracts.validate("InvariantEntry", e),
         {:ok, text} <- File.read(Path.join("docs/spec", e["citation"]["document"])) do
      if e["citation"]["heading"] in String.split(text, "\n"), do: nil, else: :no_heading
    else
      {:error, :enoent} -> :no_document
      {:error, _} -> :invalid
    end
  end

  test "the invariant registry has unique ids and real citations" do
    assert invariant_problems(@invariants) == []
  end

  test "the invariant check catches a duplicate id and bad or missing citations" do
    [a, b | _] = @invariants
    cite = &put_in(b, ["citation", &1], &2)

    planted = [
      a,
      %{b | "id" => a["id"]},
      Map.delete(b, "citation") |> Map.put("id", "no_citation"),
      cite.("document", "99-missing.md") |> Map.put("id", "no_document"),
      cite.("heading", String.slice(b["citation"]["heading"], 0..8))
      |> Map.put("id", "no_heading")
    ]

    assert Enum.sort(invariant_problems(planted)) ==
             Enum.sort([
               {:duplicate, a["id"]},
               {:invalid, "no_citation"},
               {:no_document, "no_document"},
               {:no_heading, "no_heading"}
             ])
  end

  test "the capability registry: valid entries, key@version unique, covers the chapter-one lock, all portable" do
    for entry <- @capabilities,
        do: assert(Contracts.validate("CapabilitySpec", entry) == :ok, inspect(entry))

    pins = for %{"key" => k, "version" => v} <- @capabilities, do: {k, v}
    assert pins == Enum.uniq(pins)
    by_pin = Map.new(@capabilities, &{{&1["key"], &1["version"]}, &1})

    # 00a §1: every chapter-one capability is portable (offline_private).
    for pin <- @lock_kat["value"]["capabilities"],
        do: assert(by_pin[pin]["portability"] == "portable", inspect(pin))
  end

  # 37 keys: over 32, so the map iterates unsorted and the encoder must sort
  # (docs/lessons/contracts.md).
  test "the capability lock encodes and hashes to the independent known answer" do
    %{"value" => lock, "canonical" => canonical, "sha256" => sha} = @lock_kat
    assert Contracts.validate("CapabilityLock", lock) == :ok
    assert Loka.Core.Canonical.encode(lock) == {:ok, canonical}
    assert Loka.Core.Canonical.hash(lock) == {:ok, sha}
  end

  # Breaks if the encoder mishandles non-ASCII text or nested definition maps, or if the
  # frozen contracts drift from the hello subset.
  test "the hello cartridge encodes and hashes to the independent known answer" do
    %{"value" => cartridge, "canonical" => canonical, "sha256" => sha} = @cartridge_kat
    assert Contracts.validate("CompiledCartridge", cartridge) == :ok
    assert Loka.Core.Canonical.encode(cartridge) == {:ok, canonical}
    assert Loka.Core.Canonical.hash(cartridge) == {:ok, sha}
  end

  # Breaks if a row is malformed or duplicated, names a missing fixture, or a capability
  # residency falls outside the six 05 §6 classes.
  test "the residency rows: valid, unique keys, real fixtures; capability classes are 05 §6 classes" do
    rows = JSON.decode!(File.read!("protocol/residency.json"))
    for r <- rows, do: assert(Contracts.validate("Responsibility", r) == :ok, inspect(r))
    assert Enum.uniq_by(rows, & &1["key"]) == rows
    for r <- rows, f <- r["fixtures"], do: assert(File.regular?(f), f)

    classes = Contracts.defs()["ResidencyClass"]["enum"]

    for b <- Contracts.defs()["CapabilitySpec"]["oneOf"],
        c <- b["properties"]["residency"]["enum"],
        c != nil,
        do: assert(c in classes, c)
  end
end
