defmodule Loka.ContentWearTest do
  # equipment@1 item slots in the compiler (c1-equipment; entity.schema.json SlotKey). The known
  # answer is protocol/fixtures/cartridge_wear_hash.json (Python); diagnostics are hand-written
  # from protocol/cartridge.schema.json DiagnosticCode, twins of the loader corpus slot_* cases.
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_wear")}
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_wear_hash.json"))
  @src "cartridges/ashmere_wear"

  # ashmere_wear's source in `dir` with `files` (relative path => JSON value) written over it.

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp d(code, item, data, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => "items/#{item}.slot",
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  # Breaks: an item's slot dropped or reshaped in the artifact.
  test "ashmere_wear compiles to its Python known answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@src) == {:ok, expected, []}
  end

  # Breaks: a slot accepted without its owner equipment@1, or outside the twelve SlotKeys, so the
  # compiler writes an artifact the loader rejects.
  test "a slot without equipment@1, or a finger slot, is rejected", %{dir: dir} do
    manifest =
      update_in(src("cartridge.json"), ["requires", "capabilities"], &Map.delete(&1, "equipment"))

    undeclared = &d("UNDECLARED_CAPABILITY", &1, %{"capability" => "equipment"}, ["equipment@1"])

    assert compile(dir, %{"cartridge.json" => manifest}) ==
             {:error, Enum.map(~w(lantern leather_cap straw_hat wool_cloak), undeclared)}

    finger = %{src("items/lantern.json") | "slot" => "finger"}

    assert compile(dir, %{"items/lantern.json" => finger}) ==
             {:error, [d("SCHEMA_VIOLATION", "lantern", %{"error" => "not_in_enum"})]}
  end
end
