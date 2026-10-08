defmodule Loka.ContentJournalTest do
  # Quest journal texts cross the compiler boundary (c1-journal; cartridge.md Compiler).
  # Known answer: independent Python extension of the frozen ferry artifact, never a kernel.
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_journal")}
  @src "cartridges/ashmere_journal"
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_journal_hash.json"))
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  defp compile(dir, file, change), do: compile(dir, [{file, change}])

  defp diagnostic(code, path, data) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => []
    }
  end

  # Breaks: a journal stage/outcome, event objective or item lost/reshaped during compilation.
  test "journal source compiles exactly to the independent known answer" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: the compiler skips a journal's text checks, producing undefined journal text; the
  # loader's matching cases are in fixtures/cartridge_loader.json with literal paths/data.
  test "journal stage and outcome texts need catalog entries", %{dir: dir} do
    for {key, suffix} <- [
          {"quest.lantern.return", "objectives_met"},
          {"quest.lantern.carried", "outcomes.carry"}
        ] do
      assert compile(dir, "text.json", &Map.delete(&1, key)) ==
               {:error,
                [
                  diagnostic("UNRESOLVED_REFERENCE", "quests/lantern.journal." <> suffix, %{
                    "target" => key
                  })
                ]}
    end
  end

  # Breaks: a journal without failed text passes schema validation and has no terminal fallback.
  test "the failed stage is required", %{dir: dir} do
    assert compile(
             dir,
             "quests/lantern.json",
             &update_in(&1, ["journal"], fn j ->
               Map.delete(j, "failed")
             end)
           ) ==
             {:error,
              [
                diagnostic("SCHEMA_VIOLATION", "quests/lantern.journal.failed", %{
                  "error" => "missing_property"
                })
              ]}
  end
end
