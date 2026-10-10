Code.require_file("bin/system_graph.exs")

defmodule Loka.SystemPagesTest do
  # bin/system_pages.exs on controlled Markdown; `elixir bin/contracts.exs --check` keeps
  # docs/checks.gen.json and docs/toolbox.gen.json current.
  use ExUnit.Case, async: true

  alias SystemGraph.Pages

  # Breaks: a continuation line dropped, the colon name missed, or a Markdown link left raw.
  test "each top-level CHECKS.md bullet is one named check" do
    md = """
    # Checks

    Prose: not a check.

    - `mix credo --strict`: nesting 2,
      see [the lessons](lessons/checks.md).
    - Size: 300 lines.
    """

    assert Pages.checks(md) == [
             %{"name" => "mix credo --strict", "text" => "nesting 2, see the lessons."},
             %{"name" => "Size", "text" => "300 lines."}
           ]
  end

  # Breaks: a cell read from the wrong column, depends not split ("–" is none), the status's
  # state missed, a `toolbox rows 5 and G5` heading linked to only one row, a row's own rules link
  # (W1: its heading names no row) dropped, a link in the Today cell taken as the row's rules (29), or a short row kept.
  test "each Ranked toolbox row keeps its batch, depends, state and mechanics.md section" do
    md = """
    ## Ranked toolbox

    | # | Rank | Mechanic | Today | Size | Depends on | Reuse | Sampler | Status |
    |---|---|---|---|---|---|---|---|---|
    | 5 | M4 | Skill growth | missing | M | 2, G1 | – | – | done #351: [rules](reviews/x.md) |
    | G5 | M4 | Opposed checks | missing | S | – | – | – | in progress #360 |
    | 9 | M6 | Hirelings | missing | M | – | – | – | todo |
    | W1 | M3 | Reactions | missing | S | 1,G1 | – | – | done #351: [rules](system/mechanics.md#reaction1) |
    | 29 | M3 | Stances | [D1](system/mechanics.md#d1) | S | – | – | – | todo |

    ## Next
    """

    mechanics = "## Skill growth and opposed checks (toolbox rows 5 and G5)\n"
    section = "docs/system/mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5"

    assert Pages.toolbox(md, mechanics) == [
             %{
               "id" => "5",
               "batch" => "M4",
               "title" => "Skill growth",
               "depends" => ["2", "G1"],
               "status" => "done #351: rules",
               "state" => "done",
               "section" => section
             },
             %{
               "id" => "G5",
               "batch" => "M4",
               "title" => "Opposed checks",
               "depends" => [],
               "status" => "in progress #360",
               "state" => "in progress",
               "section" => section
             },
             %{
               "id" => "9",
               "batch" => "M6",
               "title" => "Hirelings",
               "depends" => [],
               "status" => "todo",
               "state" => "todo",
               "section" => nil
             },
             %{
               "id" => "W1",
               "batch" => "M3",
               "title" => "Reactions",
               "depends" => ["1", "G1"],
               "status" => "done #351: rules",
               "state" => "done",
               "section" => "docs/system/mechanics.md#reaction1"
             },
             %{
               "id" => "29",
               "batch" => "M3",
               "title" => "Stances",
               "depends" => [],
               "status" => "todo",
               "state" => "todo",
               "section" => nil
             }
           ]

    short = String.replace(md, "| S | – |", "|")
    assert_raise RuntimeError, ~r/not 9 cells/, fn -> Pages.toolbox(short, mechanics) end
  end
end
