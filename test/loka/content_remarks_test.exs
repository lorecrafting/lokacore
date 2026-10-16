defmodule Loka.ContentRemarksTest do
  use ExUnit.Case, async: true

  @hal "remarks_sampler@0.0.1:npc/hal"

  # Breaks (toolbox row FD10; twin of remarks.test.ts): the compiler stops expanding or walking
  # an NPC's asides (a short fact key ships unexpanded, an undeclared fact or text key compiles
  # and fails in play), lets a spawn template carry them, or drops the 1.107 floor.
  test "NPC asides: expansion, references, text, template and floor" do
    dir = Loka.ContentSource.copy("cartridges/remarks_sampler")
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])

    fact =
      get_in(Jason.decode!(artifact), [
        "cartridge",
        "npcs",
        @hal,
        "asides",
        Access.at(0),
        "when",
        "root",
        "items"
      ])

    assert %{"kind" => "fact", "key" => "in_group"} = hd(fact)["fact"]

    hal = fn path, v -> {"npcs/hal.json", &put_in(&1, ["asides", Access.at(0) | path], v)} end

    for {change, code, path} <- [
          {hal.(["text"], "nope"), "UNRESOLVED_REFERENCE", "npcs/hal.asides[0].text"},
          {{"npcs/hal.json",
            &update_in(
              &1,
              ["asides", Access.at(0), "when", "root", "items", Access.at(0)],
              fn f ->
                %{f | "fact" => "ghost"}
              end
            )}, "UNRESOLVED_REFERENCE", "npcs/hal.asides[0].when.root.items[0].fact"},
          {{"npcs/bram.json", &Map.put(&1, "spawn_template", true)}, "SCHEMA_VIOLATION",
           "npcs/bram.asides"},
          {{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.106")},
           "KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [change])

      assert Enum.any?(diags, &(&1["code"] == code and &1["path"] == path)), inspect(diags)
    end
  end
end
