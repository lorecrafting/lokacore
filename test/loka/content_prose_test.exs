defmodule Loka.ContentProseTest do
  use ExUnit.Case, async: true

  # speech_sampler writes 21 of its 23 lines inline in this bundle (its KAT is the byte gate).
  @bundle "areas/village.json"
  @elder ["npcs", "elder"]
  defp triples(diags), do: Enum.map(diags, &{&1["code"], &1["path"], &1["data"]})

  defp speech(changes) do
    dir = Loka.ContentSource.copy("cartridges/speech_sampler")
    Loka.ContentSource.compile(dir, changes)
  end

  # Breaks: a generated key silently replaces an authored or an earlier generated line.
  test "a generated key already in the catalog is DUPLICATE_KEY at the marker" do
    assert {:error, diags} = speech([{"text.json", &Map.put(&1, "npc.elder.short", "x")}])

    assert triples(diags) == [
             {"DUPLICATE_KEY", "areas/village.npcs.elder.short", %{"target" => "npc.elder.short"}}
           ]

    room = &put_in(&1, @elder ++ ["room"], %{"prose" => "x"})
    assert {:error, diags} = speech([{@bundle, room}])

    clash =
      {"DUPLICATE_KEY", "areas/village.npcs.elder.room_line", %{"target" => "npc.elder.room"}}

    assert clash in triples(diags)
  end

  # Breaks: with no text.json the generated lines are dropped, or an undecodable text.json
  # crashes the stage instead of standing as INVALID_JSON.
  test "markers make the catalog when text.json is absent; an undecodable one takes nothing" do
    choice = ["dialogues", "elder_ward", "choices", "thank"]

    words = %{
      "label" => %{"prose" => "Thank her"},
      "narration" => %{"prose" => "The elder nods."}
    }

    inline = &put_in(&1, choice, words)
    assert {:ok, bytes, []} = speech([{@bundle, inline}, {"text.json", nil}])
    text = JSON.decode!(bytes)["cartridge"]["text"]
    assert text["dialogue.elder_ward.choices.thank.label"] == "Thank her"
    assert text["dialogue.elder_ward.choices.thank.narration"] == "The elder nods."

    dir = Loka.ContentSource.copy("cartridges/speech_sampler")
    File.write!(Path.join(dir, "text.json"), "{")
    assert {:error, diags} = Loka.Content.compile(dir)
    assert {"INVALID_JSON", "text", %{}} in triples(diags)
  end

  # Breaks: a marker inside a list is not lowered, or a near-marker is taken as prose instead
  # of being reported by the schema at its own site.
  test "a marker in a list is lowered; any other prose shape is the schema's to report" do
    narrate = [%{"op" => "narrate", "text" => %{"prose" => "She hears."}}]
    apply = &update_in(&1, ["reactions", "elder_hears", "apply"], fn a -> a ++ narrate end)
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.103")}
    assert {:ok, bytes, []} = speech([{@bundle, apply}, api])

    assert JSON.decode!(bytes)["cartridge"]["text"]["reaction.elder_hears.apply.1.text"] ==
             "She hears."

    for shape <- [%{"prose" => ""}, %{"prose" => 1}, %{"prose" => "x", "y" => 1}] do
      assert {:error, diags} = speech([{@bundle, &put_in(&1, @elder ++ ["short"], shape)}])
      site = {"SCHEMA_VIOLATION", "areas/village.npcs.elder.short", %{"error" => "invalid_type"}}
      assert triples(diags) == [site], inspect(shape)
    end
  end

  # Breaks: a plain file (steps []) is not lowered, or prose is lowered before `extends`
  # flattens, so the line belongs to the prototype instead of each child.
  test "a plain file and an inherited field get the child's key" do
    dir = Loka.ContentSource.copy("cartridges/shoo_sampler")
    coin = &JSON.decode!(&1)["cartridge"]["items"]["shoo_sampler@0.0.1:item/old_coin"]
    text = &JSON.decode!(&1)["cartridge"]["text"]
    untext = {"text.json", &Map.delete(&1, "item.old_coin.short")}

    own = {"items/old_coin.json", &Map.put(&1, "short", %{"prose" => "an old coin"})}
    assert {:ok, bytes, []} = Loka.ContentSource.compile(dir, [own, untext])
    assert coin.(bytes)["short"] == "item.old_coin.short"
    assert text.(bytes)["item.old_coin.short"] == "an old coin"

    parent = %{"abstract" => true, "short" => %{"prose" => "a coin"}}
    child = &(&1 |> Map.delete("short") |> Map.put("extends", "coinish"))
    changes = [{"items/coinish.json", parent}, {"items/old_coin.json", child}, untext]
    assert {:ok, bytes, []} = Loka.ContentSource.compile(dir, changes)
    assert coin.(bytes)["short"] == "item.old_coin.short"
    assert text.(bytes)["item.old_coin.short"] == "a coin"
    refute Map.has_key?(text.(bytes), "item.coinish.short")
  end
end
