# size: allow 450, ancestry, careful skill refs and Study ingress join shared source checking
defmodule Loka.Content.Checks do
  @moduledoc "Capability ownership, references and fact types (05 §4, §6; 06 §20–21)."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2, ref: 3]
  import Loka.Content.Refs, only: [commands: 0, owners: 1, owners: 2, owned: 3, reference: 6]
  alias Loka.Content.{Barriers, Dialogues, Entities, Quests, Reactions, Recipes, RoomParts}
  alias Loka.Core.Canonical

  @ref_fields Map.merge(Loka.Content.LeafRefs.all(), %{
                "fact.assign" => %{"fact" => "fact"},
                "fact.adjust" => %{"fact" => "fact"},
                "skill.acquire" => %{"skill" => "skill"},
                "topic.grant" => %{"topic" => "topic"},
                "status.apply" => %{"status" => "status"},
                "quest.activate" => %{"quest" => "quest"},
                "quest.resolve" => %{"quest" => "quest"},
                "quest.fail" => %{"quest" => "quest"}
              })
  @enclosing 3
  @doc "Expands short source references to local DefinitionRefs (owner decision 2026-09-25)."
  @spec expand(term(), map()) :: term()
  def expand(%{} = value, m) when is_map_key(value, "bundle") or is_map_key(value, "corpse"),
    do: Loka.Content.Population.expand(value, m)

  def expand(%{"op" => "population.suppress", "plan" => plan} = step, m),
    do: Map.put(step, "plan", ref(plan, "population", m))

  def expand(%{"op" => op} = n, m) when is_map_key(@ref_fields, op) do
    for {f, kind} <- @ref_fields[op], is_map_key(n, f), reduce: n do
      n -> Map.update!(n, f, &ref(&1, kind, m))
    end
  end

  def expand(%{"attribute" => _, "modifier" => _} = ancestry, m),
    do: Loka.Content.Ancestries.expand(ancestry, m)

  def expand(%{"kind" => "source", "capacity" => _, "supply" => supply} = f, m),
    do: Map.put(f, "supply", ref(supply, "item", m))

  def expand(%{"benefit" => _, "provider" => _, "currency" => _} = s, m),
    do: Loka.Content.Services.expand(s, m)

  def expand(%{"reverse" => _, "destination" => _, "recipient" => _} = t, m),
    do: Loka.Content.Transports.expand(t, m)

  def expand(%{"transport" => t} = d, m),
    do:
      d
      |> Map.delete("transport")
      |> expand(m)
      |> Map.put("transport", Map.update!(t, "route", &ref(&1, "transport", m)))

  def expand(%{"rest" => r}, m), do: %{"rest" => Loka.Content.Dreams.expand(r, m)}

  def expand(%{"label" => _, "text" => _, "topic" => topic} = readable, m),
    do: Map.put(readable, "topic", ref(topic, "topic", m))

  # A room (its title a text key): a details map may also have a detail keyed exits or title.
  def expand(%{"exits" => exits, "title" => t} = room, m) when is_map(exits) and is_binary(t) do
    exit = fn {d, e} -> {d, Map.new(e, &exit_field(&1, m))} end
    room |> Map.delete("exits") |> expand(m) |> Map.put("exits", Map.new(exits, exit))
  end

  def expand(%{"fact" => f, "equals" => _} = gate, m) when is_binary(f),
    do: Map.put(gate, "fact", ref(f, "fact", m))

  def expand(%{"npc" => npc, "room" => room, "answered" => _} = knock, m),
    do: knock |> Map.put("npc", ref(npc, "npc", m)) |> Map.put("room", ref(room, "room", m))

  # A reaction's trigger (ReactionRule on): its short fact or room.
  def expand(%{"event" => "fact_changed", "fact" => k} = on, m) when is_binary(k),
    do: Map.put(on, "fact", ref(k, "fact", m))

  def expand(%{"event" => "entity_entered_room", "room" => k} = on, m) when is_binary(k),
    do: Map.put(on, "room", ref(k, "room", m))

  def expand(%{"event" => "quest_resolved", "quest" => k} = on, m) when is_binary(k),
    do: Map.put(on, "quest", ref(k, "quest", m))

  # A recipe narration's participant (NarrationParticipant): the npc or item its role selects.
  def expand(%{"role" => k} = p, m) when k in ~w(npc item) and is_map_key(p, k),
    do: Map.update!(p, k, &ref(&1, k, m))

  def expand(%{"item_acquired" => k} = objective, m) when is_binary(k),
    do: Map.put(objective, "item_acquired", ref(k, "item", m))

  def expand(%{"route" => _, "checkpoints" => _, "trust_fact" => _} = p, m) do
    p
    |> Map.update!("npc", &ref(&1, "npc", m))
    |> Map.update!("trust_fact", &ref(&1, "fact", m))
    |> Map.update!("route", &Enum.map(&1, fn r -> ref(r, "room", m) end))
    |> Map.update!("checkpoints", &Enum.map(&1, fn r -> ref(r, "room", m) end))
  end

  def expand(%{"patrol" => p} = o, m),
    do: o |> Map.delete("patrol") |> expand(m) |> Map.put("patrol", expand(p, m))

  def expand(%{"start_room" => _, "survived_fact" => _} = expedition, m),
    do: Loka.Content.Expedition.expand(expedition, m)

  def expand(%{"transition" => t, "quest" => q, "npc" => _} = p, m)
      when t in ~w(start continue rejoin restart), do: Map.put(p, "quest", ref(q, "quest", m))

  # A barrier (a details map may have a detail keyed key_item, whose value is a map).
  def expand(%{"key_item" => k} = barrier, m) when is_binary(k),
    do: Map.put(barrier, "key_item", ref(k, "item", m))

  # An ItemLocation (`in` a kind, and that kind's field) or an NPC (its room_line a text key).
  def expand(%{"in" => k} = loc, m) when k in ~w(room npc item) and is_map_key(loc, k),
    do: Map.update!(loc, k, &ref(&1, k, m))

  # An item's barrier (a container's lid, c1-locks); its location expands as above.
  def expand(%{"barrier" => k, "location" => _} = item, m) when is_binary(k),
    do: item |> Map.delete("barrier") |> expand(m) |> Map.put("barrier", ref(k, "barrier", m))

  def expand(%{"room" => _, "room_line" => t} = npc, m) when is_binary(t) do
    schedule = Map.get(npc, "daily_schedule", %{})

    npc
    |> Loka.Content.Death.npc(m)
    |> Map.delete("shop")
    |> Map.merge(if npc["shop"], do: %{"shop" => expand(npc["shop"], m)}, else: %{})
    |> Map.update!("room", &ref(&1, "room", m))
    |> expand_attack(m)
    |> Map.merge(
      if npc["perception"], do: %{"perception" => expand(npc["perception"], m)}, else: %{}
    )
    |> Map.merge(if schedule == %{}, do: %{}, else: %{"daily_schedule" => scheduled(schedule, m)})
  end

  # A recipe's target (RecipeTarget): its detail a key, so a details map never matches.
  def expand(%{"kind" => "detail", "room" => _, "detail" => d} = target, m) when is_binary(d),
    do: Map.update!(target, "room", &ref(&1, "room", m))

  def expand(%{"offers" => offers, "resource" => r} = shop, m),
    do:
      shop
      |> Map.merge(
        if shop["buy_discount"],
          do: %{"buy_discount" => expand(shop["buy_discount"], m)},
          else: %{}
      )
      |> Map.put("resource", ref(r, "resource", m))
      |> Map.put(
        "offers",
        Enum.map(offers, &Map.update!(&1, "item", fn i -> ref(i, "item", m) end))
      )

  def expand(%{"quantity" => _, "outgoing" => _, "incoming" => _} = x, m) do
    x
    |> Map.update!("npc", &ref(&1, "npc", m))
    |> Map.update!("outgoing", &Enum.map(&1, fn i -> ref(i, "item", m) end))
    |> Map.update!("incoming", &Enum.map(&1, fn i -> ref(i, "item", m) end))
    |> Map.update!("contribution", &ref(&1, "fact", m))
    |> Map.update!("faction", &ref(&1, "fact", m))
  end

  def expand(%{"items" => _, "label" => _, "narration" => _} = h, m),
    do:
      h
      |> Map.update!("items", &Enum.map(&1, fn i -> ref(i, "item", m) end))
      |> Map.merge(if h["careful"], do: %{"careful" => expand(h["careful"], m)}, else: %{})

  # Recipe costs and thresholds expand only their owned reference fields.
  def expand(%{"kind" => "attribute_threshold", "attribute" => a} = n, m),
    do: Map.put(n, "attribute", ref(a, "attribute", m))

  def expand(%{"discovered" => f} = n, m), do: Map.put(n, "discovered", ref(f, "fact", m))

  def expand(%{"label" => _, "fact" => f} = n, m),
    do: Map.put(n, "fact", ref(f, "fact", m))

  def expand(%{"skill" => s} = n, m) when is_binary(s),
    do: n |> Map.delete("skill") |> expand(m) |> Map.put("skill", ref(s, "skill", m))

  def expand(%{"effect" => e} = n, m) when is_binary(e),
    do: n |> Map.delete("effect") |> expand(m) |> Map.put("effect", ref(e, "bleed", m))

  def expand(%{"cures" => c} = e, m) when is_list(c),
    do: Map.put(expand(Map.delete(e, "cures"), m), "cures", Enum.map(c, &ref(&1, "status", m)))

  def expand(%{"resource" => r} = n, m) when is_binary(r),
    do: Map.put(n, "resource", ref(r, "resource", m))

  def expand(%{"at" => _, "trust_fact" => _} = deadline, m),
    do:
      deadline
      |> Map.update!("fact", &ref(&1, "fact", m))
      |> Map.update!("trust_fact", &ref(&1, "fact", m))

  # A story point's trigger (StoryPointDefinition outcome): its short dialogue.
  def expand(%{"dialogue" => d, "choice" => c} = t, m) when is_binary(c),
    do: Map.put(t, "dialogue", ref(d, "dialogue", m))

  def expand(%{"scene" => s} = t, m) when is_binary(s),
    do: Map.put(t, "scene", ref(s, "scene", m))

  def expand(%{"fact" => f, "value" => _} = t, m) when is_binary(f),
    do: Map.put(t, "fact", ref(f, "fact", m))

  def expand(%{"accept" => k, "narration" => _} = o, m) when is_binary(k),
    do: o |> Map.delete("accept") |> expand(m) |> Map.put("accept", ref(k, "quest", m))

  def expand(%{"npc" => _, "quest" => q, "transition" => _} = escort, m),
    do: Map.put(escort, "quest", ref(q, "quest", m))

  # A dialogue (DialogueDefinition, its prompt a text key): its short speaker and quest.
  def expand(%{"npc" => n, "prompt" => p} = d, m) when is_binary(p) do
    q = Map.new(Map.take(d, ["quest"]), fn {k, v} -> {k, ref(v, "quest", m)} end)
    d |> Map.drop(~w(npc quest)) |> expand(m) |> Map.merge(Map.put(q, "npc", ref(n, "npc", m)))
  end

  # A chapter marker: its title and outcome are keys, its story point a reference.
  def expand(%{"story_point" => p, "title" => t} = chapter, m) when is_binary(t),
    do: Map.put(chapter, "story_point", ref(p, "story_point", m))

  def expand(%{"story_point" => p, "outcome" => o} = trigger, m) when is_binary(o),
    do:
      trigger
      |> Map.delete("story_point")
      |> expand(m)
      |> Map.put("story_point", ref(p, "story_point", m))

  def expand(%{"quest" => q, "outcome" => o} = trigger, m) when is_binary(o),
    do: trigger |> Map.delete("quest") |> expand(m) |> Map.put("quest", ref(q, "quest", m))

  def expand(%{"action" => a, "room" => r, "detail" => _} = trigger, m) when is_binary(a),
    do: trigger |> Map.put("action", ref(a, "recipe", m)) |> Map.put("room", ref(r, "room", m))

  def expand(%{"player_corpse" => _, "npc_corpse" => _, "shrine" => _} = death, m),
    do: Loka.Content.Death.expand(death, m)

  def expand(%{"bell_cue" => cue} = world, m),
    do:
      world
      |> Map.delete("bell_cue")
      |> expand(m)
      |> Map.put("bell_cue", %{
        "fact" => ref(cue["fact"], "fact", m),
        "rooms" => Enum.map(cue["rooms"], &ref(&1, "room", m)),
        "text" => cue["text"]
      })

  def expand(%{"death_credit" => credits} = world, m) when is_list(credits),
    do:
      world
      |> Map.delete("death_credit")
      |> expand(m)
      |> Map.put("death_credit", Enum.map(credits, &Loka.Content.Combat.expand(&1, m)))

  # Vessel initial rows and detail sources own only their precise liquid reference fields.
  def expand(%{"kind" => k, "quantity" => _} = row, m) when is_binary(k),
    do: Map.put(row, "kind", ref(k, "liquid", m))

  def expand(%{"liquid_source" => k} = detail, m) when is_binary(k),
    do:
      detail
      |> Map.delete("liquid_source")
      |> expand(m)
      |> Map.put("liquid_source", ref(k, "liquid", m))

  def expand(v, m) when is_map(v),
    do: v |> Map.new(fn {k, x} -> {k, expand(x, m)} end) |> Loka.Content.Services.bed(m)

  def expand(v, m) when is_list(v), do: Enum.map(v, &expand(&1, m))
  def expand(v, _), do: v

  defp scheduled(schedule, m), do: Map.new(schedule, fn {h, r} -> {h, ref(r, "room", m)} end)

  @doc """
  Diagnostics across the schema-valid definitions (`kind => key => {rel, steps, value}`):
  nesting depth, and, given a valid manifest, commands, policy ops and references.
  """
  @spec check(map() | nil, map(), [map()]) :: [map()]
  def check(manifest, defs, registry) do
    all = for {_, ds} <- defs, is_map(ds), {_, {_, _, _} = d} <- ds, do: d

    Enum.flat_map(all, &depth/1) ++
      Loka.Content.Requires.features(manifest, all) ++
      Loka.Content.Exchanges.check(manifest, defs) ++
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

  @doc """
  Diagnostics for a v2 source (`{entry, text}`; nil for v1): the entry is present, each room's,
  item's and NPC's owning capability is required, exits and the entry name rooms of this
  cartridge, items' locations and NPCs' rooms name definitions of their kind, items and NPCs
  start without a containment cycle or over capacity, each room's, item's, NPC's and action's
  text keys have a catalog entry (unless the catalog was rejected, `:unknown`). Recipes and
  rooms' action contributions are `Loka.Content.Recipes.check/4`.
  """
  @spec rooms(map() | nil, map(), {map() | nil, map() | :unknown} | nil, [map()]) :: [map()]
  def rooms(_, _, nil, _), do: []

  def rooms(m, defs, {entry, text}, registry) do
    rooms = for {_, {rel, [], r}} <- defs["room"], do: {rel, r}

    entry(m, entry, defs) ++
      texts(defs, text) ++
      if(m,
        do:
          Enum.flat_map(rooms, &room(&1, m, defs, registry)) ++
            Barriers.check(m, entry, defs, registry) ++
            entities(m, defs, registry) ++ locations(m, defs),
        else: []
      )
  end

  defp entities(m, defs, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    Entities.holders(defs) ++
      for {kind, rel, e} <- Entities.all(defs),
          {steps, k} <- Entities.parts(e, kind),
          d <- owned(at(rel, steps), k, required),
          do: d
  end

  defp locations(m, defs),
    do: Enum.flat_map(Entities.all(defs), fn {_, rel, e} -> located(rel, e, m, defs) end)

  defp located(_, %{"location" => %{"in" => "template"}}, _, _), do: []

  defp located(rel, %{"location" => %{"in" => k} = loc}, m, defs),
    do: reference(rel, ["location"], {k, k}, loc, m, defs)

  defp located(rel, npc, m, defs) do
    schedule = Map.get(npc, "daily_schedule", %{})

    reference(rel, [], {"room", "room"}, npc, m, defs) ++
      for {h, _} <- schedule,
          d <- reference(rel, ["daily_schedule"], {h, "room"}, schedule, m, defs),
          do: d
  end

  defp texts(defs, text) do
    for(
      {kind, fields} <- [
        {"room", ~w(title description)},
        {"action", ~w(label accessibility)},
        {"barrier", ["short"]}
      ],
      {_, {rel, [], def}} <- defs[kind],
      d <- text_keys({rel, def}, fields, text),
      do: d
    ) ++
      RoomParts.details(defs, text) ++
      RoomParts.variant_texts(defs, text) ++ Entities.texts(defs, text)
  end

  # Without a valid manifest the entry is unknown, not missing.
  defp entry(nil, _, _), do: []

  defp entry(_, nil, _),
    do: [diag("SCHEMA_VIOLATION", "cartridge.entry", %{"error" => "missing_property"})]

  defp entry(m, ref, defs),
    do: reference("cartridge.json", [], {"entry", "room"}, %{"entry" => ref}, m, defs)

  # ponytail: the one exit check keeps corpse ingress beside barrier and destination refs. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  defp room({rel, r}, m, defs, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    Enum.flat_map(RoomParts.parts(r), fn {steps, kind} ->
      owned(at(rel, steps), kind, required)
    end) ++
      Enum.flat_map(r["exits"], fn {dir, exit} ->
        reference(rel, ["exits", dir], {"to", "room"}, exit, m, defs) ++
          if(exit["corpse_ingress"],
            do:
              reference(
                rel,
                ["exits", dir, "corpse_ingress"],
                {"fact", "fact"},
                exit["corpse_ingress"],
                m,
                defs
              ),
            else: []
          )
      end)
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

    Enum.flat_map(actions, fn {rel, a} ->
      command(rel, a["command"], required, m["time_policy"] != nil)
    end) ++
      Enum.flat_map(
        trees(defs, actions),
        &Loka.Content.Policies.tree(&1, {m, defs, required})
      )
  end

  # Every located policy root from the source definitions.
  defp trees(defs, actions) do
    Enum.concat([
      for({_, {rel, [], p}} <- defs["policy"], do: {rel, ["root"], p["root"]}),
      for({rel, a} <- actions, do: {rel, ["policy", "root"], a["policy"]["root"]}),
      RoomParts.conditions(defs),
      Entities.conditions(defs),
      Recipes.conditions(defs),
      Quests.conditions(defs),
      Reactions.conditions(defs),
      Dialogues.conditions(defs),
      Loka.Content.Skills.conditions(defs)
    ])
  end

  defp expand_attack(npc, m) do
    if npc["attack"], do: Map.put(npc, "attack", expand(npc["attack"], m)), else: npc
  end

  # run_job is authority-internal (04 §1): no action builds it.
  defp command(rel, name, required, elapsed?) do
    if name in commands() and name not in ["run_job", "elapsed"] and
         not (elapsed? and name == "wait"),
       do: owned(at(rel, ["command"]), name, required),
       else: [diag("UNKNOWN_COMMAND", at(rel, ["command"]))]
  end

  defp exit_field({k, v}, m) when k in ~w(corpse_ingress knock), do: {k, expand(v, m)}
  defp exit_field({k, v}, m), do: {k, ref(v, if(k == "to", do: "room", else: k), m)}
end
