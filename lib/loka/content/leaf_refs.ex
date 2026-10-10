defmodule Loka.Content.LeafRefs do
  @moduledoc """
  Each policy leaf's reference fields, each mapped to the definition kind a short ref expands
  to (mechanics.md policy leaf set). Twin of LEAF_REFS in kernel/ts/src/content/cartridge_leaf_refs.ts;
  kernel/ts/test/tags.test.ts checks both against policy.schema.json. No dependencies: the
  compiler's checks read it at compile time.
  """
  def all,
    do: %{
      "fact_compare" => %{"fact" => "fact"},
      "has_item" => %{"item" => "item"},
      "quest_state" => %{"quest" => "quest"},
      "escort_state" => %{"quest" => "quest"},
      "barrier_state" => %{"barrier" => "barrier"},
      "stat_compare" => %{"attribute" => "attribute"},
      "resource_compare" => %{"resource" => "resource"},
      "has_tag" => %{"item" => "item", "barrier" => "barrier", "room" => "room"},
      "visited_count" => %{"room" => "room"}
    }
end
