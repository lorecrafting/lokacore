defmodule Loka.ContentRecipesTest do
  # Action recipes and rooms' action contributions in the compiler (R5 S5; action.schema.json
  # ActionRecipe, ActionContribution; 06 §19-§20; 05 §28). Expected diagnostics are hand-written
  # from protocol/cartridge.schema.json DiagnosticCode; the known answer is
  # protocol/fixtures/cartridge_bell_hash.json (Python).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_bell_hash.json"))
  @src "cartridges/ashmere_bell"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  # ashmere_bell's source with `files` merged over it (nil removes a file).
  defp compile(dir, files) do
    base =
      for rel <- Path.wildcard("#{@src}/**/*.json"),
          not String.contains?(rel, "transcripts"),
          into: %{},
          do: {Path.relative_to(rel, @src), JSON.decode!(File.read!(rel))}

    for {rel, v} <- Map.merge(base, files), v != nil do
      File.mkdir_p!(Path.join(dir, Path.dirname(rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))
  defp recipe(path, v), do: put_in(src("recipes/ring_bell.json"), path, v)

  defp d(code, path, data \\ %{}, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  defp full(kind, key),
    do: %{
      "cartridge_id" => "ashmere_bell",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

  # Breaks: the recipe dropped or reshaped, its short target room or fact references left short,
  # or the recipes map emitted under another name.
  test "ashmere_bell compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Owner decision 2026-09-25 (short references). Breaks: full target-room and fact.assign
  # references rejected or compiled differently from short ones.
  test "full target and fact references compile to the same artifact", %{tmp_dir: dir} do
    seq = [
      %{"op" => "fact.assign", "fact" => full("fact", "chapel_bell_rung"), "value" => true},
      %{"op" => "event.emit", "event" => "bell_rung"}
    ]

    r =
      src("recipes/ring_bell.json")
      |> put_in(["target", "room"], full("room", "belfry"))
      |> put_in(["outcomes", "success", "sequence"], seq)

    assert compile(dir, %{"recipes/ring_bell.json" => r}) == {:ok, @expected, []}
  end

  # Breaks: a recipe naming a room, detail or fact that does not exist compiles, or a wrongly
  # typed value compiles and only faults at play time (brief item 7).
  test "a recipe's unknown room, detail or fact or mistyped value fails", %{tmp_dir: dir} do
    seq = ["outcomes", "success", "sequence"]

    cases = [
      {recipe(["target", "room"], "crypt"),
       d("UNRESOLVED_REFERENCE", "recipes/ring_bell.target.room", %{
         "target" => "ashmere_bell@0.0.1:room/crypt"
       })},
      {recipe(["target", "detail"], "gong"),
       d("UNRESOLVED_REFERENCE", "recipes/ring_bell.target.detail", %{"target" => "gong"})},
      {recipe(seq, [%{"op" => "fact.assign", "fact" => "bell_tolled", "value" => true}]),
       d("UNRESOLVED_REFERENCE", "recipes/ring_bell.outcomes.success.sequence[0].fact", %{
         "target" => "ashmere_bell@0.0.1:fact/bell_tolled"
       })},
      {recipe(seq, [%{"op" => "fact.assign", "fact" => "chapel_bell_rung", "value" => "yes"}]),
       d("FACT_TYPE_MISMATCH", "recipes/ring_bell.outcomes.success.sequence[0].value")}
    ]

    for {r, diag} <- cases,
        do: assert(compile(dir, %{"recipes/ring_bell.json" => r}) == {:error, [diag]})
  end

  # Breaks: a label or narration key without catalog text compiles (the player sees a raw key).
  test "a recipe's label and narration need catalog entries", %{tmp_dir: dir} do
    text = Map.drop(src("text.json"), ["actions.ring_bell", "narration.ring_bell.observers"])

    assert compile(dir, %{"text.json" => text}) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "recipes/ring_bell.label", %{
                  "target" => "actions.ring_bell"
                }),
                d(
                  "UNRESOLVED_REFERENCE",
                  "recipes/ring_bell.outcomes.success.narration.observers",
                  %{"target" => "narration.ring_bell.observers"}
                )
              ]}
  end

  # Breaks: a recipe or a step's operation compiles without its owner required (05 §6), or a
  # recipe shares an action's key, one ActionSet identity with two definitions.
  test "recipes need their owners and a key no action has", %{tmp_dir: dir} do
    caps = src("cartridge.json")["requires"]["capabilities"]

    manifest = fn drop ->
      put_in(src("cartridge.json"), ["requires", "capabilities"], Map.drop(caps, drop))
    end

    owner = fn path ->
      d("UNDECLARED_CAPABILITY", path, %{"capability" => "action_recipe"}, ["action_recipe@1"])
    end

    assert compile(dir, %{"cartridge.json" => manifest.(["action_recipe"])}) ==
             {:error,
              [
                owner.("recipes/ring_bell"),
                owner.("recipes/ring_bell.outcomes.success.sequence[1].op")
              ]}

    action = %{
      "label" => "actions.ring_bell",
      "target" => %{"kind" => "none"},
      "command" => "look",
      "priority" => 0,
      "input" => [],
      "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}},
      "accessibility" => "actions.ring_bell"
    }

    assert compile(dir, %{"actions/ring_bell.json" => action}) ==
             {:error, [d("DUPLICATE_DEFINITION", "recipes/ring_bell")]}
  end

  # Breaks: the fact capability not required by a recipe that assigns a fact.
  test "a fact.assign step needs fact", %{tmp_dir: dir} do
    caps = Map.delete(src("cartridge.json")["requires"]["capabilities"], "fact")
    m = put_in(src("cartridge.json"), ["requires", "capabilities"], caps)
    {:error, diags} = compile(dir, %{"cartridge.json" => m})

    assert d(
             "UNDECLARED_CAPABILITY",
             "recipes/ring_bell.outcomes.success.sequence[0].op",
             %{"capability" => "fact"},
             ["fact@1"]
           ) in diags
  end

  # Breaks: a room's contribution naming nothing compiles (a typo that silently changes
  # nothing), or an engine verb, action or recipe key is refused.
  test "a room's action contribution names a verb, action or recipe", %{tmp_dir: dir} do
    room = fn keys ->
      Map.put(src("rooms/belfry.json"), "actions", [%{"op" => "subtract", "actions" => keys}])
    end

    assert {:ok, _, []} = compile(dir, %{"rooms/belfry.json" => room.(["take", "ring_bell"])})

    assert compile(dir, %{"rooms/belfry.json" => room.(["look", "ring_gong"])}) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "rooms/belfry.actions[0].actions[1]", %{
                  "target" => "ring_gong"
                })
              ]}
  end
end
