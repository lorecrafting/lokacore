defmodule Loka.Core.ComposeQuestTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Compose

  # Breaks (toolbox row W23): activation drops started_at, or a transition keeps the old stage's
  # started_at (with none on the op) or ignores the new one.
  test "quest ops store, replace and remove the stage's started_at" do
    q = %{"cartridge_id" => "c", "cartridge_version" => "1.0.0", "kind" => "quest", "key" => "q"}
    scope = %{"kind" => "player", "character_id" => "10000000-0000-4000-8000-000000000001"}
    id = "30000000-0000-4000-8000-000000000001"
    t = %{"op" => "quest.transition", "writer_group" => 0, "instance_id" => id}
    row = fn ops -> Compose.compose(%{"clock" => 0}, %{"ops" => ops}) end

    activate = %{
      "op" => "quest.activate",
      "writer_group" => 0,
      "quest" => q,
      "scope" => scope,
      "instance_id" => id,
      "started_at" => 7
    }

    met = Map.merge(t, %{"from" => "active", "to" => "objectives_complete", "started_at" => 9})
    done = Map.merge(t, %{"from" => "objectives_complete", "to" => "resolved", "outcome" => "ok"})
    rows = fn r -> for %{"value" => v} <- r["changes"], do: v["started_at"] end

    assert rows.(row.([activate])) == [7]
    assert rows.(row.([activate, met])) == [9]
    assert rows.(row.([activate, met, done])) == [nil]
  end
end
