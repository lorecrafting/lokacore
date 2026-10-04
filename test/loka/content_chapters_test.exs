defmodule Loka.ContentChaptersTest do
  # Chapter references and structure (mechanics.md Chapters). Literal expected diagnostics
  # follow DiagnosticCode; the compiled answer is independently written by Python.
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @src "cartridges/ashmere_chapters"
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_chapters_hash.json"))
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp compile(dir, files) do
    File.cp_r!(@src, dir)
    for {rel, value} <- files, do: File.write!(Path.join(dir, rel), JSON.encode!(value))
    Loka.Content.compile(dir)
  end

  defp ref(kind, key),
    do: %{
      "cartridge_id" => "ashmere_chapters",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

  defp d(code, path, data \\ %{}),
    do: %{
      "severity" => "error",
      "code" => code,
      "path" => "cartridge.chapters" <> path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => []
    }

  defp marker(m, i, field, value),
    do:
      Map.update!(
        m,
        "chapters",
        &List.update_at(&1, i, fn c ->
          if value == nil, do: Map.delete(c, field), else: Map.put(c, field, value)
        end)
      )

  # Breaks: chapter settings misplaced/lost, or a source short story_point left unexpanded.
  test "chapters compile to the independent answer with either reference spelling", %{
    tmp_dir: dir
  } do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
    m = src("cartridge.json")

    full =
      Enum.reduce(
        [1, 2],
        m,
        &marker(&2, &1, "story_point", ref("story_point", "lantern_resolved"))
      )

    assert compile(dir, %{"cartridge.json" => full}) == {:ok, @expected, []}
  end

  # Breaks: the source manifest uses a weaker array shape than the artifact and admits no opening chapter.
  test "empty source chapters are rejected", %{tmp_dir: dir} do
    assert compile(dir, %{"cartridge.json" => Map.put(src("cartridge.json"), "chapters", [])}) ==
             {:error, [d("SCHEMA_VIOLATION", "", %{"error" => "too_few_items"})]}
  end

  # Breaks: a chapter title, point or outcome bypasses reference checking, or opening/later
  # structural restrictions are skipped in the compiler's settings path.
  test "chapter references and opening structure fail closed", %{tmp_dir: dir} do
    m = src("cartridge.json")

    for {i, field, value, code, data} <- [
          {1, "story_point", "nope", "UNRESOLVED_REFERENCE",
           %{"target" => "ashmere_chapters@0.0.1:story_point/nope"}},
          {2, "outcome", "stay", "UNRESOLVED_REFERENCE", %{"target" => "stay"}},
          {0, "story_point", "lantern_resolved", "UNKNOWN_FIELD", %{}},
          {0, "outcome", "carry", "UNKNOWN_FIELD", %{}},
          {1, "story_point", nil, "SCHEMA_VIOLATION", %{"error" => "missing_property"}}
        ] do
      assert compile(Path.join(dir, "#{i}-#{field}"), %{
               "cartridge.json" => marker(m, i, field, value)
             }) ==
               {:error, [d(code, "[#{i}].#{field}", data)]}
    end

    assert compile(Path.join(dir, "text"), %{
             "text.json" => Map.delete(src("text.json"), "chapter.dusk")
           }) ==
             {:error, [d("UNRESOLVED_REFERENCE", "[1].title", %{"target" => "chapter.dusk"})]}
  end

  # Breaks: the same quest/choice in another dialogue silently reaches a marker, or rejecting
  # every multi-dialogue quest rather than only ambiguous counted triggers.
  test "only ambiguity in a counted quest choice is rejected", %{tmp_dir: dir} do
    dialogue = src("dialogues/bram.json")
    take = Map.take(dialogue["choices"], ["take_it"])
    leave = Map.take(dialogue["choices"], ["leave_it"])
    other = Map.put(dialogue, "choices", take)

    assert compile(Path.join(dir, "both"), %{"dialogues/bram_again.json" => other}) ==
             {:error,
              [d("OUTCOME_MISMATCH", "[1].story_point"), d("OUTCOME_MISMATCH", "[2].story_point")]}

    assert compile(Path.join(dir, "leave"), %{
             "dialogues/bram_again.json" => Map.put(other, "choices", leave)
           }) ==
             {:error, [d("OUTCOME_MISMATCH", "[1].story_point")]}

    unrelated = Map.put(other, "choices", %{"unrelated_choice" => take["take_it"]})

    assert {:ok, _, []} =
             compile(Path.join(dir, "unrelated"), %{"dialogues/bram_again.json" => unrelated})

    different = Map.put(other, "quest", "other")

    assert {:ok, _, []} =
             compile(Path.join(dir, "different"), %{
               "dialogues/bram_again.json" => different,
               "quests/other.json" => src("quests/lantern.json")
             })
  end
end
