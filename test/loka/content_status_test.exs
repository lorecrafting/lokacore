defmodule Loka.ContentStatusTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/status_sampler")}

  # Breaks: a status with an unknown pool, a tick at or past its end, a zero amount or missing
  # text, an applier or cure naming no status, or an old API floor compiles.
  test "status, applier and cure declarations keep their boundaries", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    cases =
      [
        {"statuses/poison.json", &Map.put(&1, "resource", "missing")},
        {"statuses/poison.json", &Map.put(&1, "tick_every", 300)},
        {"statuses/poison.json", &Map.put(&1, "per_tick", 0)},
        {"statuses/poison.json", &put_in(&1, ["narration", "tick"], "missing.text")},
        {"reactions/dart.json", &put_in(&1, ["apply", Access.at(0), "status"], "missing")},
        {"items/antidote.json", &put_in(&1, ["edible", "cures"], ["missing"])},
        {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.37")},
        {"statuses/poison.json", &Map.put(&1, "per_tick", "-1")},
        {"statuses/poison.json", &Map.put(&1, "duration", 0)},
        {"statuses/poison.json", &Map.put(&1, "extra", 1)},
        {"statuses/poison.json", &put_in(&1, ["narration", "cured"], "narration.poison.tick")},
        {"reactions/dart.json", &put_in(&1, ["apply"], [%{"op" => "status.apply"}])},
        {"items/antidote.json", &put_in(&1, ["edible", "cures"], [])}
      ] ++
        for(
          field <- ~w(duration tick_every resource per_tick label narration),
          do: {"statuses/poison.json", &Map.delete(&1, field)}
        ) ++
        for(
          field <- ~w(applied tick expired),
          do:
            {"statuses/poison.json",
             &update_in(&1, ["narration"], fn n -> Map.delete(n, field) end)}
        )

    for {file, change} <- cases do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, change}]), file
    end
  end
end
