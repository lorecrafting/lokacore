defmodule Loka.ContentParamsTest do
  @moduledoc """
  Source parameters (docs/system/cartridge.md, Source shortcuts): toolbox_showcase's 30
  `wheel_*_x_shows_*` reactions extend the abstract `reactions/wheel_shows.json` with `with`
  (the unchanged artifact is pinned by content_showcase_test); behaviours take `with` per
  attachment, on a copy of fishing_sampler.
  """
  use ExUnit.Case, async: true
  alias Loka.ContentSource, as: Source

  @shows "reactions/wheel_shows.json"
  @child "reactions/wheel_1_x_shows_0.json"
  @spoils "behaviours/spoils.json"
  @trout "items/trout_01.json"

  setup_all do
    %{showcase: Source.copy("cartridges/toolbox_showcase"), fishing: fishing()}
  end

  defp diags(dir, changes) do
    {:error, ds} = Source.compile(dir, changes)
    Enum.sort(for d <- ds, do: {d["code"], d["path"], d["data"]})
  end

  defp cartridge(dir, changes) do
    {:ok, bytes, []} = Source.compile(dir, changes)
    JSON.decode!(bytes)["cartridge"]
  end

  # fishing_sampler with API 1.120 (narrate needs 1.103) and `spoils` taking a `line` it narrates.
  defp fishing do
    dir = Source.copy("cartridges/fishing_sampler")
    spoils_line(dir)

    for {fish, line} <- [
          trout_01: %{"prose" => "The trout slaps the bank."},
          eel_01: %{"prose" => "The eel coils round your wrist."},
          trout_02: "room.bank.title",
          salmon_01: "room.bank.title"
        ] do
      rel = "items/#{fish}.json"
      held = [%{"behaviour" => "spoils", "with" => %{"line" => line}}]
      File.write!(Path.join(dir, rel), JSON.encode!(Map.put(read(dir, rel), "behaviours", held)))
    end

    dir
  end

  defp spoils_line(dir) do
    for {rel, change} <- [
          {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.120")},
          {@spoils,
           fn s ->
             s
             |> Map.put("params", ["line"])
             |> update_in(
               ["reactions", "take", "apply"],
               &(&1 ++ [narrate(%{"param" => "line"})])
             )
           end}
        ],
        do: File.write!(Path.join(dir, rel), JSON.encode!(change.(read(dir, rel))))
  end

  defp read(dir, rel), do: JSON.decode!(File.read!(Path.join(dir, rel)))
  defp narrate(text), do: %{"op" => "narrate", "text" => text}
  defp attach(with), do: &Map.put(&1, "behaviours", [%{"behaviour" => "spoils", "with" => with}])

  # Breaks: `with` filling the parent after the merge (an object argument merged into the marker
  # leaves a two-member object), `with` or `params` reaching the artifact.
  test "a child's with fills its parent's markers before the child merges over it", %{
    showcase: dir
  } do
    parent = %{
      "abstract" => true,
      "params" => ["on"],
      "on" => %{"param" => "on"},
      "apply" => [narrate("narration.wheel_1.0")]
    }

    child = %{
      "extends" => "picky",
      "with" => %{"on" => %{"event" => "action_completed"}},
      "on" => %{"action" => "turn_wheel_1"}
    }

    rs = cartridge(dir, [{"reactions/picky.json", parent}, {"reactions/picky_1.json", child}])

    assert rs["reactions"]["toolbox_showcase@0.0.1:reaction/picky_1"]["on"] ==
             %{"event" => "action_completed", "action" => "turn_wheel_1"}
  end

  # Breaks: an argument no parameter declares accepted silently.
  test "with naming an undeclared parameter is UNKNOWN_FIELD", %{showcase: s, fishing: f} do
    assert diags(s, [{@child, &put_in(&1, ["with", "colour"], "red")}]) ==
             [{"UNKNOWN_FIELD", "reactions/wheel_1_x_shows_0.with.colour", %{}}]

    assert diags(f, [{@trout, attach(%{"line" => "room.bank.title", "colour" => "red"})}]) ==
             [{"UNKNOWN_FIELD", "items/trout_01.behaviours[0].with.colour", %{}}]
  end

  # Breaks: a missing argument left as an unfilled marker (reported by the schema at the parent's
  # site, or not at all), or one diagnostic per missing name.
  test "a declared parameter missing from with is refused once at with", %{
    showcase: s,
    fishing: f
  } do
    missing = %{"error" => "missing_property"}

    for change <- [
          &Map.delete(&1, "with"),
          &update_in(&1, ["with"], fn w -> Map.drop(w, ~w(n line)) end)
        ] do
      assert diags(s, [{@child, change}]) ==
               [{"SCHEMA_VIOLATION", "reactions/wheel_1_x_shows_0.with", missing}]
    end

    for held <- [["spoils"], [%{"behaviour" => "spoils"}]] do
      assert diags(f, [{@trout, &Map.put(&1, "behaviours", held)}]) ==
               [{"SCHEMA_VIOLATION", "items/trout_01.behaviours[0].with", missing}]
    end
  end

  # Breaks: a marker naming no parameter reported once per child or holder (or not at all).
  test "a marker naming no declared parameter is unresolved at its site", %{
    showcase: s,
    fishing: f
  } do
    colour = %{"param" => "colour"}

    assert diags(s, [{@shows, &put_in(&1, ["apply"], [narrate(colour)])}]) == [
             {"UNRESOLVED_REFERENCE", "reactions/wheel_shows.apply[0].text",
              %{"target" => "colour"}}
           ]

    take = ["reactions", "take", "apply"]

    assert diags(f, [{@spoils, &update_in(&1, take, fn a -> a ++ [narrate(colour)] end)}]) == [
             {"UNRESOLVED_REFERENCE", "behaviours/spoils.reactions.take.apply[2].text",
              %{"target" => "colour"}}
           ]
  end

  # Breaks: a malformed params list or with accepted, or `holder` declared in a behaviour.
  test "params that are not Keys, holder in a behaviour, and a with that is not an object", %{
    showcase: s,
    fishing: f
  } do
    type = %{"error" => "invalid_type"}

    for params <- ["action", [1], ["Action!"]] do
      assert diags(s, [{@shows, &Map.put(&1, "params", params)}]) ==
               [{"SCHEMA_VIOLATION", "reactions/wheel_shows.params", type}]
    end

    assert diags(f, [{@spoils, &Map.put(&1, "params", ["line", "holder"])}]) ==
             [{"SCHEMA_VIOLATION", "behaviours/spoils.params", %{"error" => "invalid_value"}}]

    assert diags(s, [{@child, &Map.put(&1, "with", "turn_wheel_1")}]) ==
             [{"SCHEMA_VIOLATION", "reactions/wheel_1_x_shows_0.with", type}]

    assert diags(f, [{@trout, attach(3)}]) ==
             [{"SCHEMA_VIOLATION", "items/trout_01.behaviours[0].with", type}]
  end

  # Breaks: params on a concrete definition dropped (it compiles silently) or checked as a
  # declaration (invalid_type, and the definition's children dropped).
  test "params on a definition that is not abstract stays for the schema", %{showcase: s} do
    for params <- [["x"], 5] do
      assert diags(s, [{"reactions/wheel_1_turn.json", &Map.put(&1, "params", params)}]) ==
               [{"UNKNOWN_FIELD", "reactions/wheel_1_turn.params", %{}}]
    end
  end

  # Break: a child of a concrete parent whose params is not a list crashes Params.check.
  test "a child of a concrete parent with non-list params is refused at the parent's params", %{
    showcase: s
  } do
    assert diags(s, [
             {"items/apple.json", &Map.put(&1, "params", "x")},
             {"items/kid.json", %{"extends" => "apple"}}
           ]) == [
             {"SCHEMA_VIOLATION", "items/apple.params", %{"error" => "invalid_type"}},
             {"UNKNOWN_FIELD", "items/apple.params", %{}}
           ]
  end

  # Breaks: an object with a member besides `param` taken for a marker (reported as unresolved
  # instead of left for the schema), or an attachment object with an extra member accepted.
  test "only a one-member param object is a marker, and an attachment has only behaviour and with",
       %{fishing: f} do
    take = ["reactions", "take", "apply"]
    loose = narrate(%{"param" => "colour", "x" => 1})

    codes =
      for {c, _, _} <- diags(f, [{@spoils, &update_in(&1, take, fn a -> a ++ [loose] end)}]),
          do: c

    refute "UNRESOLVED_REFERENCE" in codes

    extra =
      &Map.put(&1, "behaviours", [
        %{"behaviour" => "spoils", "with" => %{"line" => "room.bank.title"}, "x" => 1}
      ])

    assert diags(f, [{@trout, extra}]) ==
             [{"SCHEMA_VIOLATION", "items/trout_01.behaviours", %{"error" => "invalid_type"}}]
  end

  # Breaks: a second attachment of one behaviour with other arguments dropped without a word.
  test "one behaviour attached twice with different arguments is a duplicate", %{fishing: f} do
    twice =
      for line <- ["room.bank.title", "room.bank.title.x"],
          do: %{"behaviour" => "spoils", "with" => %{"line" => line}}

    assert diags(f, [{@trout, &Map.put(&1, "behaviours", twice)}]) ==
             [{"DUPLICATE_DEFINITION", "behaviours/spoils.reactions.take", %{}}]
  end

  # Breaks: one line shared by every holder, the line under the behaviour's key, or the argument
  # not reaching the copy.
  test "a behaviour's with gives each holder its own prose line", %{fishing: f} do
    c = cartridge(f, [])
    take = &c["reactions"]["fishing_sampler@0.0.1:reaction/take_" <> &1]["apply"]

    for {fish, words} <- [
          {"trout_01", "The trout slaps the bank."},
          {"eel_01", "The eel coils round your wrist."}
        ] do
      key = "item.#{fish}.behaviours.0.with.line"
      assert c["text"][key] == words
      assert List.last(take.(fish)) == narrate(key)
    end

    assert List.last(take.("salmon_01")) == narrate("room.bank.title")
  end
end
