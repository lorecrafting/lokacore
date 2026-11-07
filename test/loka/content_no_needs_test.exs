defmodule Loka.ContentNoNeedsTest do
  use ExUnit.Case, async: true

  # Breaks (owner 2026-11-04, loka-vduxr.61): a shipped cartridge brings back a hunger or thirst
  # pool; food and drink only boost regen now (the drain fixture lives under test/fixtures).
  test "no shipped cartridge declares a need pool" do
    files = Path.wildcard("cartridges/**/resources.json")
    assert files != []

    needs =
      for file <- files,
          pool <- Map.keys(JSON.decode!(File.read!(file))["resources"] || %{}),
          pool in ~w(hunger thirst),
          do: {file, pool}

    assert needs == []
  end
end
