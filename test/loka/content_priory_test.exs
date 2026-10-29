defmodule Loka.ContentPrioryTest do
  use ExUnit.Case, async: true

  @dir "cartridges/codex_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/codex_sampler_hash.json"))

  # Breaks: an item-readable or topic short ref left a string, or a book reshaped in the
  # artifact (protocol/fixtures/codex_sampler_hash.json, pinned compiler output).
  test "codex_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Break: item-readable short refs, its text or readable@1 bypass the compiler boundary.
  test "book authoring rejects malformed metadata and undeclared topic references" do
    dir = Loka.ContentSource.copy(@dir)
    fact = %{"cartridge_id" => "codex_sampler", "cartridge_version" => "0.0.1"}
    fact = Map.merge(fact, %{"kind" => "fact", "key" => "topic_mill_known"})

    for {rel, keys, value, code} <- [
          {"items/mill_ledger.json", ["readable", "topic"], "missing", "UNRESOLVED_REFERENCE"},
          {"items/mill_ledger.json", ["readable", "topic"], fact, "UNRESOLVED_REFERENCE"},
          {"items/mill_ledger.json", ["readable", "label"], "missing", "UNRESOLVED_REFERENCE"},
          {"items/mill_ledger.json", ["readable", "text"], "missing", "UNRESOLVED_REFERENCE"},
          {"items/mill_ledger.json", ["readable"], %{"label" => "actions.read_book"},
           "SCHEMA_VIOLATION"},
          {"items/mill_ledger.json", ["readable"], %{"text" => "readable.mill_ledger"},
           "SCHEMA_VIOLATION"}
        ] do
      change = &put_in(&1, Enum.map(keys, fn k -> Access.key!(k) end), value)
      assert {:error, errors} = Loka.ContentSource.compile(dir, [{rel, change}])
      assert Enum.any?(errors, &(&1["code"] == code)), inspect({rel, keys, errors})
    end

    drop = &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "readable") end)
    assert {:error, errors} = Loka.ContentSource.compile(dir, [{"cartridge.json", drop}])
    found = for e <- errors, do: {e["code"], e["path"]}
    assert {"UNDECLARED_CAPABILITY", "items/mill_ledger.readable"} in found, inspect(errors)
  end
end
