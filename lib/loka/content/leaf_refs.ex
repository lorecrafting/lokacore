defmodule Loka.Content.LeafRefs do
  @moduledoc """
  Each policy leaf's reference field, named for its definition kind, or the list of a leaf's
  alternative subject fields (mechanics.md policy leaf set); short refs expand to that kind.
  Twin of LEAF_REFS in kernel/ts/src/content/cartridge_refs.ts. No dependencies: the compiler's
  checks read it at compile time.
  """
  def all,
    do: %{
      "fact_compare" => "fact",
      "has_item" => "item",
      "quest_state" => "quest",
      "escort_state" => "quest",
      "barrier_state" => "barrier",
      "stat_compare" => "attribute",
      "resource_compare" => "resource",
      "has_tag" => ~w(item barrier room)
    }
end
