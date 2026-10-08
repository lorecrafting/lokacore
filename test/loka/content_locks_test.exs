defmodule Loka.ContentLocksTest do
  # barrier@1 on items (c1-locks; entity.schema.json ItemDefinition barrier) in the compiler. The
  # known answer is protocol/fixtures/containers_cartridge_locks_hash.json (Python); diagnostics are
  # hand-written from protocol/cartridge.schema.json DiagnosticCode, twins of the loader cases in
  # kernel/ts/test/locks.test.ts.
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_locks")}
  @kat JSON.decode!(File.read!("protocol/fixtures/containers_cartridge_locks_hash.json"))
  @src "cartridges/ashmere_locks"

  # ashmere_locks' source in `dir` with `files` (relative path => JSON value) written over it.

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))
  defp item(key, f), do: {"items/#{key}.json", f.(src("items/#{key}.json"))}
  defp lid(key, v), do: {"barriers/#{key}.json", Map.merge(src("barriers/#{key}.json"), v)}
  defp inside(i, box), do: %{i | "location" => %{"in" => "item", "item" => box}}

  defp d(code, path, data \\ %{}) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => []
    }
  end

  defp errors({:error, ds}), do: Enum.sort_by(ds, & &1["path"])
  defp errors(other), do: other

  # Breaks: an item's barrier dropped, or left a short key, in the artifact (Checks.expand).
  test "ashmere_locks compiles to its Python known answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@src) == {:ok, expected, []}
  end

  # Breaks: lockout treating a locked chest's contents as in reach, skipping item barriers or a
  # missing key_item, or rejecting a key that is reachable.
  test "only keys that can never be reached are rejected", %{dir: dir} do
    run = fn _case, files -> errors(compile(dir, Map.new(files))) end
    unreachable = &d("BARRIER_UNREACHABLE_KEY", "barriers/#{&1}")

    assert run.("own", [item("brass_key", &inside(&1, "trunk"))]) == [unreachable.("trunk_lid")]

    circular = [lid("box_lid", %{"initial" => "locked", "key_item" => "letter"})]
    assert run.("circular", circular) == [unreachable.("box_lid"), unreachable.("trunk_lid")]

    keyless = [lid("coffer_lid", %{"initial" => "locked"})]
    assert run.("keyless", keyless) == [unreachable.("coffer_lid")]

    keyed = [lid("coffer_lid", %{"initial" => "locked", "key_item" => "letter"})]
    assert {:ok, _, []} = compile(dir, Map.new(keyed))

    up = src("rooms/inn_rooms.json")
    down = src("rooms/inn_attic.json")

    hatch = [
      {"barriers/hatch.json",
       %{
         "keywords" => ["hatch"],
         "short" => "barrier.box_lid.short",
         "initial" => "locked",
         "key_item" => "brass_key"
       }},
      {"rooms/inn_rooms.json", put_in(up, ["exits", "up", "barrier"], "hatch")},
      {"rooms/inn_attic.json", put_in(down, ["exits", "down", "barrier"], "hatch")}
      | circular
    ]

    assert run.("hatch", hatch) == [unreachable.("box_lid"), unreachable.("hatch")]
  end

  # Breaks: an item's barrier not a checked reference, or shared with an exit.
  test "an item's barrier names a barrier no exit names", %{dir: dir} do
    up = put_in(src("rooms/inn_rooms.json"), ["exits", "up", "barrier"], "trunk_lid")
    down = put_in(src("rooms/inn_attic.json"), ["exits", "down", "barrier"], "trunk_lid")
    files = %{"rooms/inn_rooms.json" => up, "rooms/inn_attic.json" => down}

    assert errors(compile(dir, files)) == [
             d("BARRIER_MISMATCH", "items/trunk.barrier")
           ]

    unknown = Map.new([item("trunk", &%{&1 | "barrier" => "nope"})])

    assert errors(compile(dir, unknown)) == [
             d("UNRESOLVED_REFERENCE", "items/trunk.barrier", %{
               "target" => "ashmere_locks@0.0.1:barrier/nope"
             })
           ]
  end
end
