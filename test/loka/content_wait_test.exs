defmodule Loka.ContentWaitTest do
  use ExUnit.Case, async: true

  # Source shortcut wait (docs/system/cartridge.md, Source shortcuts).
  @raid "cartridges/raid_sampler"
  @rule "reactions/aftershock.json"
  @ref "raid_sampler@0.0.1:reaction/"

  defp adjust(n), do: %{"op" => "fact.adjust", "fact" => "aftershocks", "amount" => n}
  defp wait(n), do: %{"op" => "wait", "seconds" => n}
  defp steps(list), do: fn r -> r |> Map.delete("after") |> Map.put("steps", list) end

  setup_all do
    %{dir: Loka.ContentSource.copy(@raid)}
  end

  defp reactions(dir, changes) do
    assert {:ok, json, []} = Loka.ContentSource.compile(dir, changes)
    Jason.decode!(json)["cartridge"]["reactions"]
  end

  defp refused(dir, changes) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    Enum.map(diags, &{&1["path"], &1["data"]["why"]})
  end

  # Breaks: the split changes what the artifact says (a key, an `after` that is not cumulative,
  # a dropped `when`): the wait form must equal the rules an author would write by hand.
  test "a list with waits compiles to the same bytes as hand-written delayed rules", %{dir: dir} do
    assert {:ok, waited, []} =
             Loka.ContentSource.compile(dir, [
               {@rule, steps([adjust(1), wait(10), adjust(2), wait(20), adjust(3)])}
             ])

    base = dir |> Path.join(@rule) |> File.read!() |> Jason.decode!()
    late = fn n, s -> Map.merge(base, %{"after" => s, "steps" => [adjust(n)]}) end

    assert {:ok, hand, []} =
             Loka.ContentSource.compile(dir, [
               {@rule, steps([adjust(1)])},
               {"reactions/aftershock_wait_1.json", late.(2, 10)},
               {"reactions/aftershock_wait_2.json", late.(3, 30)}
             ])

    assert waited == hand
  end

  # Breaks: the gate: the sampler's delayed rule, rewritten with a leading wait, changes the
  # artifact (a save's reaction job would not find its rule again).
  test "the sampler rewritten with a leading wait keeps its bytes", %{dir: dir} do
    assert {:ok, hand, []} = Loka.ContentSource.compile(dir, [])

    assert {:ok, ^hand, []} =
             Loka.ContentSource.compile(dir, [
               {@rule,
                &(&1
                  |> Map.delete("after")
                  |> Map.update!("steps", fn steps -> [wait(600) | steps] end))}
             ])
  end

  # Breaks: a wait on a rule with its own `after` restarts the clock instead of adding to it.
  test "a rule's own after counts before its waits", %{dir: dir} do
    rules =
      reactions(dir, [
        {@rule, &Map.merge(&1, %{"after" => 600, "steps" => [adjust(1), wait(5), adjust(2)]})}
      ])

    assert [rules["#{@ref}aftershock"]["after"], rules["#{@ref}aftershock_wait_1"]["after"]] == [
             600,
             605
           ]
  end

  # Breaks: each refusal lost: the list compiles to something else, or the fault points at a
  # sibling's renumbered step instead of the line the author wrote.
  test "a list that cannot lower is refused at the authored step", %{dir: dir} do
    bound = %{"op" => "event.emit", "event" => "x"}
    co = %{"op" => "status.apply", "status" => "x", "co_present" => true}
    tag = %{"op" => "status.apply", "status" => "x"}
    subject = %{"op" => "status_active", "status" => "x", "subject" => "subject"}

    for {list, want} <- [
          {[adjust(1), wait(0), adjust(2)],
           {"reactions/aftershock.steps[1].seconds", "wait_seconds"}},
          {[wait(1.5), adjust(2)], {"reactions/aftershock.steps[0].seconds", "wait_seconds"}},
          {[wait("10m"), adjust(2)], {"reactions/aftershock.steps[0].seconds", "wait_seconds"}},
          {[%{"op" => "wait"}, adjust(2)],
           {"reactions/aftershock.steps[0].seconds", "wait_seconds"}},
          {[Map.put(wait(1), "x", 1), adjust(2)],
           {"reactions/aftershock.steps[0].seconds", "wait_seconds"}},
          {[wait(2_147_483_647), adjust(1), wait(1), adjust(2)],
           {"reactions/aftershock.steps[2].seconds", "wait_seconds"}},
          {[adjust(1), wait(5)], {"reactions/aftershock.steps[1]", "wait_empty"}},
          {[wait(5), wait(5), adjust(1)], {"reactions/aftershock.steps[0]", "wait_empty"}},
          {[adjust(1), wait(5), adjust(2), bound],
           {"reactions/aftershock.steps[3].op", "wait_event"}},
          {[wait(5), co], {"reactions/aftershock.steps[1].op", "wait_event"}},
          {[wait(5), Map.put(tag, "tag", "x")],
           {"reactions/aftershock.steps[1].op", "wait_event"}}
        ] do
      assert refused(dir, [{@rule, steps(list)}]) == [want]
    end

    assert refused(dir, [
             {@rule,
              &(&1 |> steps([adjust(1), wait(5), adjust(2)]).() |> Map.put("when", subject))}
           ]) == [{"reactions/aftershock.when.subject", "wait_subject"}]
  end

  # Breaks: a step before the first wait runs at once, so the event is still there: refusing it
  # would take away a legal rule.
  test "an event step before the first wait still lowers", %{dir: dir} do
    bound = %{"op" => "npc.move"}
    rules = reactions(dir, [{@rule, steps([bound, wait(5), adjust(2)])}])
    assert rules["#{@ref}aftershock"]["steps"] == [bound]
  end

  # Breaks: a wait outside a reaction is dropped or reaches the generic schema error.
  test "a wait outside a reaction is refused in plain words", %{dir: dir} do
    action = %{"command" => "x", "steps" => [wait(5)]}

    assert refused(dir, [{"actions/stall.json", action}]) ==
             [{"actions/stall.steps[0]", "wait_outside"}]

    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"actions/stall.json", action}])
    assert [line] = Loka.Content.Explain.lines(diags, dir) |> Enum.filter(&(&1 =~ "stall"))
    assert line =~ "`wait` only works in a reaction's `steps`"
  end

  # Breaks: a text key `op` holding the word "wait" is read as a misplaced step.
  test "a text catalog's words are not steps", %{dir: dir} do
    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, [{"text.json", &Map.put(&1, "op", "wait")}])
  end

  # Breaks: a bad `after` is overwritten by the waits' total and ships with the wrong timing; a step
  # that is no object crashes the compiler instead of reaching the schema.
  test "what the schema refuses still reaches it", %{dir: dir} do
    for {change, path} <- [
          {&Map.merge(&1, %{"after" => "soon", "steps" => [wait(5), adjust(1)]}),
           "reactions/aftershock.after"},
          {&Map.merge(&1, %{"after" => 0, "steps" => [wait(5), adjust(1)]}),
           "reactions/aftershock.after"},
          {steps([wait(5), "narrate"]), "reactions/aftershock.steps[1]"}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{@rule, change}])
      assert path in Enum.map(diags, & &1["path"]), inspect(diags)
    end
  end

  # Breaks: an authored rule already named like a generated one is silently replaced.
  test "a generated rule that repeats a definition key is refused", %{dir: dir} do
    existing = File.read!(Path.join(dir, @rule)) |> Jason.decode!()

    assert {:error, [%{"code" => "DUPLICATE_DEFINITION"}, %{"code" => "DUPLICATE_DEFINITION"}]} =
             Loka.ContentSource.compile(dir, [
               {@rule, steps([adjust(1), wait(5), adjust(2)])},
               {"reactions/aftershock_wait_1.json", existing}
             ])
  end

  # Breaks: a stretch with no line of its own trips the silent-write lint although the list says
  # its line in another stretch.
  test "lint reads the list as a whole" do
    dir = Loka.ContentSource.copy(@raid)
    rule = Path.join(dir, @rule)

    write = fn list ->
      File.write!(rule, Jason.encode!(steps(list).(Jason.decode!(File.read!(rule)))))
    end

    found = fn -> Enum.filter(Loka.Content.Lint.run(dir), &(&1 =~ "aftershock")) end

    write.([%{"op" => "narrate", "text" => "x"}, wait(5), adjust(1)])
    assert found.() == []

    write.([adjust(1), wait(5), adjust(2)])

    # Breaks: lint keeps only the last stretch of the file, so a finding in an earlier one is lost.
    assert [
             "reactions/aftershock.json: writes state with no narrate step and no \"silent\": true",
             "reactions/aftershock_wait_1.json: writes state with no narrate step and no \"silent\": true"
           ] = found.()
  end
end
