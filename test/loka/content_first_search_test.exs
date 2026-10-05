defmodule Loka.ContentFirstSearchTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp compile(dir, change) do
    File.cp_r!("cartridges/ashmere_missing_child", dir)

    for path <- Path.wildcard("#{dir}/**/*.json") do
      rel = Path.relative_to(path, dir)
      File.write!(path, JSON.encode!(change.(rel, JSON.decode!(File.read!(path)))))
    end

    Loka.Content.compile(dir)
  end

  # Breaks: new short quest refs remain strings, missing definitions/owner locks compile,
  # or activation is accepted under an actorless legacy trigger or an older API.
  test "quest reaction references, owners and restricted activation are checked", %{tmp_dir: dir} do
    cases = [
      {"source quest", "UNRESOLVED_REFERENCE",
       fn
         "reactions/start_search.json", r -> put_in(r, ["on", "quest"], "absent")
         _, r -> r
       end},
      {"malformed source", "SCHEMA_VIOLATION",
       fn
         "reactions/start_search.json", r -> put_in(r, ["on", "quest"], "bad key")
         _, r -> r
       end},
      {"target quest", "UNRESOLVED_REFERENCE",
       fn
         "reactions/start_search.json", r -> put_in(r, ["apply", Access.at(0), "quest"], "absent")
         _, r -> r
       end},
      {"actorless", "OUTCOME_MISMATCH",
       fn
         "reactions/start_search.json", r ->
           Map.put(r, "on", %{"event" => "entity_entered_room", "room" => "reed_bank"})

         _, r ->
           r
       end},
      {"quest owner", "UNDECLARED_CAPABILITY",
       fn
         "cartridge.json", r ->
           update_in(r, ["requires", "capabilities"], &Map.delete(&1, "quest"))

         _, r ->
           r
       end},
      {"reaction owner", "UNDECLARED_CAPABILITY",
       fn
         "cartridge.json", r ->
           update_in(r, ["requires", "capabilities"], &Map.delete(&1, "reaction"))

         _, r ->
           r
       end},
      {"API", "KERNEL_API_RANGE_INVALID",
       fn
         "cartridge.json", r -> put_in(r, ["requires", "kernel_api", "at_least"], "1.7")
         _, r -> r
       end}
    ]

    for {name, code, change} <- cases do
      assert {:error, diagnostics} = compile(Path.join(dir, name), change)
      assert Enum.any?(diagnostics, &(&1["code"] == code)), name
    end
  end
end
