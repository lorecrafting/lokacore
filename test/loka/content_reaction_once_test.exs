defmodule Loka.ContentReactionOnceTest do
  # A reaction's source-only `once` and `cooldown` (docs/design/story-tooling.md K2), lowered to
  # engine facts and a policy guard beside the authored `when` as a choice's `once` is. Expected
  # values are hand-written, never rebuilt from the lowering.
  # One copied source per module, mutated and restored per case: not async, or a case restores
  # the file under another case's compile.
  use ExUnit.Case, async: false
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/reactions_sampler")}

  # The sampler's bone_drop rule with the given source fields added.
  defp field(fields), do: {"reactions/bone_drop.json", &Map.merge(&1, fields)}

  defp compile(dir, change) do
    assert {:ok, out, diags} = Loka.ContentSource.compile(dir, [change])
    {out, diags}
  end

  defp json(out), do: JSON.decode!(out)

  defp rule(out) do
    rules = json(out)["cartridge"]["reactions"]
    Enum.find_value(rules, fn {k, v} -> if String.ends_with?(k, "reaction/bone_drop"), do: v end)
  end

  defp fact(out, key) do
    facts = json(out)["cartridge"]["facts"]
    Enum.find_value(facts, fn {k, v} -> if String.ends_with?(k, "fact/#{key}"), do: v end)
  end

  # The artifact holds full DefinitionRefs, so every lowered key reads back expanded.
  defp ref(key),
    do: %{
      "cartridge_id" => "reactions_sampler",
      "cartridge_version" => "0.0.1",
      "kind" => "fact",
      "key" => key
    }

  defp done(ref),
    do: %{"op" => "not", "item" => %{"op" => "fact_compare", "fact" => ref, "equals" => true}}

  defp assign(ref), do: %{"op" => "fact.assign", "fact" => ref, "value" => true}

  # Break: `once` reaches the artifact (the loader rejects it) or lowers to a step only, so an
  # `after` rule whose job runs later fires twice.
  test "once guards the when and sets its fact last", %{dir: dir} do
    {out, _} = compile(dir, field(%{"once" => true}))
    lowered = rule(out)

    refute Map.has_key?(lowered, "once")
    assert lowered["when"] == done(ref("bone_drop_done"))
    assert List.last(lowered["steps"]) == assign(ref("bone_drop_done"))
    assert fact(out, "bone_drop_done")["value_type"] == %{"type" => "bool", "default" => false}
  end

  # Break: the guard replaces the authored `when` instead of joining it, so the rule fires when its
  # own condition fails.
  test "once sits beside an authored when under all", %{dir: dir} do
    authored = %{"op" => "fact_compare", "fact" => ref("crow_drawn"), "equals" => true}
    {out, _} = compile(dir, field(%{"when" => authored, "once" => true}))

    assert rule(out)["when"] == %{
             "op" => "all",
             "items" => [authored, done(ref("bone_drop_done"))]
           }
  end

  # Break: an authored `all` is wrapped in a second `all`, so the guard is not a sibling leaf.
  test "an authored all gains one leaf rather than nesting", %{dir: dir} do
    leaf = %{"op" => "fact_compare", "fact" => ref("crow_drawn"), "equals" => true}

    {out, _} =
      compile(dir, field(%{"when" => %{"op" => "all", "items" => [leaf]}, "once" => true}))

    assert rule(out)["when"] == %{"op" => "all", "items" => [leaf, done(ref("bone_drop_done"))]}
  end

  # Break: `cooldown` lowers to a fact but no time_since leaf, so the rule never rests.
  test "cooldown rests the rule for its seconds", %{dir: dir} do
    {out, _} = compile(dir, field(%{"cooldown" => 60}))
    lowered = rule(out)

    refute Map.has_key?(lowered, "cooldown")

    assert lowered["when"] == %{
             "op" => "time_since",
             "fact" => ref("bone_drop_at"),
             "at_least" => 60
           }

    assert List.last(lowered["steps"]) == %{"op" => "fact.stamp", "fact" => ref("bone_drop_at")}

    # A stamp fact takes no maximum (step.schema.json fact.stamp).
    assert fact(out, "bone_drop_at")["value_type"] == %{
             "type" => "int",
             "default" => 0,
             "minimum" => 0
           }
  end

  # Break: either lowered step goes before the rule's effect, so an `after` rule stamps the time it
  # was queued rather than the time it fired.
  test "the lowered steps come after the authored ones", %{dir: dir} do
    {out, _} = compile(dir, field(%{"once" => true, "cooldown" => 30}))

    assert rule(out)["steps"] == [
             %{
               "op" => "fact.assign",
               "fact" => ref("crow_drawn"),
               "value" => true
             },
             %{"op" => "fact.stamp", "fact" => ref("bone_drop_at")},
             assign(ref("bone_drop_done"))
           ]
  end

  # Break: the two guards overwrite each other, or one is nested instead of joined.
  test "once and cooldown put both leaves beside the when", %{dir: dir} do
    rested = %{"op" => "time_since", "fact" => ref("bone_drop_at"), "at_least" => 30}
    {out, _} = compile(dir, field(%{"once" => true, "cooldown" => 30}))

    assert rule(out)["when"] ==
             %{"op" => "all", "items" => [done(ref("bone_drop_done")), rested]}

    # The stamp goes first: an `after` rule records the time it fired, after the effect it records.
    assert Enum.take(rule(out)["steps"], -2) == [
             %{"op" => "fact.stamp", "fact" => ref("bone_drop_at")},
             assign(ref("bone_drop_done"))
           ]
  end

  # Break: the source schema accepts any value for the two fields, so `cooldown: 0` or a string
  # `once` reaches the lowering and becomes a fact or a guard the author did not mean.
  test "an out-of-range cooldown and a non-bool once are schema refusals", %{dir: dir} do
    for {patch, path} <- [
          {%{"cooldown" => 0}, "reactions/bone_drop.cooldown"},
          {%{"once" => "yes"}, "reactions/bone_drop.once"}
        ] do
      assert {:error, [%{"code" => "SCHEMA_VIOLATION", "path" => ^path} | _]} =
               Loka.ContentSource.compile(dir, [field(patch)])
    end
  end

  # Break: a sampler rule stops showing the fields (an example is deleted, or its field drifts),
  # so the fields compile but no shipped cartridge proves them.
  test "the sampler ships one rule per field" do
    rules = "cartridges/reactions_sampler/reactions" |> Path.join("*.json") |> Path.wildcard()

    assert Enum.any?(rules, &String.ends_with?(&1, "/bone_taken.json")), "once has no sampler"

    assert Enum.any?(rules, &String.ends_with?(&1, "/bone_rested.json")),
           "cooldown has no sampler"
  end

  # Break: a writer may write the engine's fact by name, so the rule's own bookkeeping is
  # overwritten by a step the author wrote.
  test "a write to a lowered fact is refused", %{dir: dir} do
    both = fn r ->
      r
      |> Map.put("once", true)
      |> Map.update!(
        "steps",
        &(&1 ++ [%{"op" => "fact.assign", "fact" => "bone_drop_done", "value" => true}])
      )
    end

    r = Loka.ContentSource.compile(dir, [{"reactions/bone_drop.json", both}])
    assert {:error, diags} = r

    # The author's own step is the second one; the rule's `once` claims the same fact.
    assert [%{"code" => "RESERVED_FACT", "path" => path}] = diags
    assert path == "reactions/bone_drop.steps[1].fact"
  end

  # Break: the skip in Position.sites is too broad (it drops every write of the reserved name in
  # every reaction, not just the lowering's own), so another rule writing that fact compiles.
  test "another rule writing a lowered fact of a different rule is refused", %{dir: dir} do
    other = fn r ->
      r
      |> Map.put("steps", [%{"op" => "fact.assign", "fact" => "bone_taken_done", "value" => true}])
    end

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [{"reactions/bone_drop.json", other}])

    assert [%{"code" => "RESERVED_FACT"}] = diags
  end

  # Break: a writer may declare the engine's fact itself, so the rule reads a fact it also writes.
  test "an authored fact of the lowered name is refused at the rule", %{dir: dir} do
    shadow = {"facts.json", &put_in(&1, ["facts", "bone_drop_done"], bool_fact("mine"))}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [field(%{"once" => true}), shadow])

    assert [%{"code" => "RESERVED_FACT", "path" => path} | _] = diags

    assert path =~ "once"
  end

  # Break: the fault names the facts file instead of the field that lowered the name.
  test "the name is refused at the field that lowered it", %{dir: dir} do
    shadow = {"facts.json", &put_in(&1, ["facts", "bone_drop_at"], int_fact("mine"))}

    assert {:error, [%{"path" => path}]} =
             Loka.ContentSource.compile(dir, [field(%{"cooldown" => 5}), shadow])

    assert path =~ "bone_drop.cooldown"
  end

  # Break: the key comes from the file's basename, so in an area bundle (one file, many rules) a
  # rule's own write is measured against the bundle's name; the refusal then names the wrong fact
  # or is not raised at all. The area file is a change, so the copy is restored after the case.
  test "an area bundle's rule is guarded under its own key", %{dir: dir} do
    this = "elder_hears"

    declare = {"cartridge.json", &put_in(&1, ["requires", "capabilities", "speech"], 1)}

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               declare,
               {"areas/village.json",
                %{
                  "rooms" => %{},
                  "reactions" => %{
                    this => %{
                      "on" => %{"event" => "spoken"},
                      "once" => true,
                      "steps" => [
                        %{"op" => "fact.assign", "fact" => this <> "_done", "value" => true}
                      ]
                    }
                  }
                }}
             ])

    assert [%{"code" => "RESERVED_FACT", "data" => %{"field" => fact}}] = diags
    assert fact == this <> "_done"
  end

  # Break: the fault's data carries no name, so Explain's `{reserved}` reads the path's last step
  # (`fact`) and every RESERVED_FACT names the literal word `fact` (a real compile showed it).
  test "a reserved-write fault names the fact", %{dir: dir} do
    other = fn r ->
      r
      |> Map.put("steps", [%{"op" => "fact.assign", "fact" => "bone_taken_done", "value" => true}])
    end

    assert {:error, [%{"code" => "RESERVED_FACT", "data" => data}]} =
             Loka.ContentSource.compile(dir, [{"reactions/bone_drop.json", other}])

    assert data["field"] == "bone_taken_done"

    # And the sentence names it: `field` alone is the path's last step, the word `fact`.
    assert [line] =
             Loka.Content.Explain.lines(
               [
                 %{
                   "code" => "RESERVED_FACT",
                   "path" => "reactions/x.steps[0].fact",
                   "data" => data
                 }
               ],
               dir
             )

    assert line =~ "`bone_taken_done`"
  end

  # Break: a lowered name past 64 characters is refused with a `why` Explain has no sentence for,
  # so `Map.fetch!` raises and the compile crashes with a MatchError instead of reporting it (a
  # real compile crashed exactly so).
  test "a lowered name past 64 characters is worded, not a crash", %{dir: dir} do
    long = String.duplicate("k", 60)
    src = Path.join(dir, "reactions/#{long}.json")
    File.write!(src, ~s({"on":{"event":"spoken"},"once":true,"steps":[]}))

    try do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [])
      assert Enum.any?(diags, &(&1["data"]["why"] == "reaction_key_long")), inspect(diags)
    after
      File.rm!(src)
    end
  end

  defp bool_fact(meaning),
    do: %{
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["instance"],
      "meaning" => meaning
    }

  defp int_fact(meaning) do
    %{
      "version" => 1,
      "value_type" => %{"type" => "int", "default" => 0, "minimum" => 0, "maximum" => 9},
      "scopes" => ["instance"],
      "meaning" => meaning
    }
  end
end
