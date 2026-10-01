defmodule Loka.ContentFerryTest do
  # The calendar start and an NPC's daily schedule in the compiler (Early R7/R8 S;
  # cartridge.schema.json Calendar, entity.schema.json NpcDefinition daily_schedule). Expected
  # diagnostics are hand-written from protocol/cartridge.schema.json DiagnosticCode, with the
  # loader's paths in kernel/ts/test/schedule.test.ts; the known answer is
  # protocol/fixtures/cartridge_ferry_hash.json (Python).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_ferry_hash.json"))
  @src "cartridges/ashmere_ferry"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  # ashmere_ferry's source with `files` merged over it.
  defp compile(dir, files) do
    base =
      for rel <- Path.wildcard("#{@src}/**/*.json"),
          not String.contains?(rel, "transcripts"),
          into: %{},
          do: {Path.relative_to(rel, @src), JSON.decode!(File.read!(rel))}

    for {rel, v} <- Map.merge(base, files) do
      File.mkdir_p!(Path.join(dir, Path.dirname(rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp ref(key),
    do: %{
      "cartridge_id" => "ashmere_ferry",
      "cartridge_version" => "0.0.1",
      "kind" => "room",
      "key" => key
    }

  defp d(code, path, data, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  defp schedule(s), do: %{"npcs/bram.json" => Map.put(src("npcs/bram.json"), "daily_schedule", s)}

  # Breaks: the calendar or a daily schedule dropped, misplaced or reshaped in the artifact.
  test "ashmere_ferry compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a schedule's short room left short (Checks.expand; the loader would reject it).
  test "full schedule rooms compile to the same artifact", %{tmp_dir: dir} do
    full = %{"6" => ref("ferry_landing"), "19" => ref("village_green")}
    assert compile(dir, schedule(full)) == {:ok, @expected, []}
  end

  # Breaks: a schedule naming a room the cartridge lacks compiling (run_job would crash).
  test "a schedule's unknown room is UNRESOLVED_REFERENCE", %{tmp_dir: dir} do
    assert compile(dir, schedule(%{"6" => "ferry_landing", "19" => "shed"})) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "npcs/bram.daily_schedule.19", %{
                  "target" => "ashmere_ferry@0.0.1:room/shed"
                })
              ]}
  end

  # Breaks: a daily schedule compiling without behavior@1, or a calendar without calendar@1, in
  # the manifest (capability_registry.json definitions).
  test "a schedule needs behavior@1 and a calendar calendar@1", %{tmp_dir: dir} do
    m = src("cartridge.json")
    without = &update_in(m, ["requires", "capabilities"], fn c -> Map.delete(c, &1) end)

    assert compile(Path.join(dir, "a"), %{"cartridge.json" => without.("behavior")}) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "npcs/bram.daily_schedule",
                  %{"capability" => "behavior"},
                  ["behavior@1"]
                )
              ]}

    assert compile(Path.join(dir, "b"), %{"cartridge.json" => without.("calendar")}) ==
             {:error,
              [
                d("UNDECLARED_CAPABILITY", "cartridge.calendar", %{"capability" => "calendar"}, [
                  "calendar@1"
                ])
              ]}
  end

  # Breaks: an hour outside 0-23 (or with a leading zero), a calendar without start or a start
  # past day 1 (its first job's due time could leave the safe integers) compiling.
  test "schedule hours and the calendar are schema-checked", %{tmp_dir: dir} do
    assert compile(Path.join(dir, "a"), schedule(%{"06" => "ferry_landing"})) ==
             {:error,
              [
                d("SCHEMA_VIOLATION", "npcs/bram.daily_schedule.06", %{
                  "error" => "pattern_mismatch"
                })
              ]}

    late = Map.put(src("cartridge.json"), "calendar", %{"start" => 86_400})

    assert compile(Path.join(dir, "c"), %{"cartridge.json" => late}) ==
             {:error,
              [d("SCHEMA_VIOLATION", "cartridge.calendar.start", %{"error" => "above_maximum"})]}

    m = Map.put(src("cartridge.json"), "calendar", %{})

    assert compile(Path.join(dir, "b"), %{"cartridge.json" => m}) ==
             {:error,
              [
                d("SCHEMA_VIOLATION", "cartridge.calendar.start", %{
                  "error" => "missing_property"
                })
              ]}
  end

  # Breaks: an action built on run_job compiling (authority-internal, 04 §1: a dead action).
  test "an action's command is never run_job", %{tmp_dir: dir} do
    action = %{
      "label" => "actions.coil_rope",
      "accessibility" => "actions.coil_rope",
      "target" => %{"kind" => "none"},
      "command" => "run_job",
      "priority" => 0,
      "input" => [],
      "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}
    }

    assert compile(dir, %{"actions/hurry.json" => action}) ==
             {:error, [d("UNKNOWN_COMMAND", "actions/hurry.command", %{})]}
  end
end
