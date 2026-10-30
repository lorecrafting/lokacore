defmodule Loka.ContentStepsTest do
  use ExUnit.Case, async: true
  alias Loka.Content.{CheckKinds, Steps}

  # One cartridge whose fact and npc resolve and whose fact_changed owner is declared, so each
  # case's only diagnostic is the context refusal under test.
  @m %{"id" => "c", "version" => "1"}
  defp ref(kind, key),
    do: %{"cartridge_id" => "c", "cartridge_version" => "1", "kind" => kind, "key" => key}

  @ctx %{
    m: @m,
    defs: %{
      "fact" => %{"bell" => {"facts/bell.json", [], %{"value_type" => %{"type" => "bool"}}}},
      "npc" => %{"guard" => %{}}
    },
    events: {%{"fact" => true}, %{"fact_changed" => {"fact", "fact@1"}}}
  }
  defp refused(path),
    do: [Loka.Content.Source.diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})]

  # Breaks: a reaction runs an op only a scripted action runs (damage added to the reaction set).
  test "a reaction refuses an action-only op" do
    assert Steps.check("reactions/bell.json", ["steps"], [%{"op" => "damage"}], :reaction, @ctx) ==
             refused("reactions/bell.steps[0].op")
  end

  # Breaks: a scripted action's fact.assign runs a field only a reaction's runs (field rule dropped).
  test "a scripted action's fact.assign refuses npc" do
    step = %{
      "op" => "fact.assign",
      "fact" => ref("fact", "bell"),
      "value" => true,
      "npc" => ref("npc", "guard")
    }

    assert Steps.check("scripted_actions/ring.json", ["sequence"], [step], :action, @ctx) ==
             refused("scripted_actions/ring.sequence[0].npc")
  end

  # Breaks: a scripted action's status.apply runs co_present, which only a reaction's runs.
  test "a scripted action's status.apply refuses co_present" do
    step = %{
      "op" => "status.apply",
      "status" => ref("status", "stunned"),
      "npc" => ref("npc", "guard"),
      "co_present" => true
    }

    ctx = put_in(@ctx.defs["status"], %{"stunned" => %{}})

    assert Steps.check("scripted_actions/ring.json", ["sequence"], [step], :action, ctx) ==
             refused("scripted_actions/ring.sequence[0].co_present")
  end

  # Breaks: a dialogue choice runs a check kind other than opposed.
  test "a dialogue choice refuses a luck check" do
    check = %{"kind" => "luck", "key" => "guess", "chance" => 0.5}

    assert CheckKinds.context("dialogues/guard.json", ["choices", "ask", "check"], check, :choice) ==
             refused("dialogues/guard.choices.ask.check.kind")
  end

  # Breaks: a scripted action's check runs failure or rating, which only a dialogue choice's runs.
  test "a scripted action's check refuses failure" do
    check = %{"kind" => "opposed", "key" => "guess", "failure" => "narration.x", "rating" => 1}

    assert CheckKinds.context("scripted_actions/ring.json", ["check"], check, :action) ==
             refused("scripted_actions/ring.check.failure") ++
               refused("scripted_actions/ring.check.rating")
  end

  # Breaks: a dialogue choice's opposed check runs without failure narration.
  test "a dialogue choice's opposed check needs failure" do
    check = %{"kind" => "opposed", "key" => "ask", "rating" => 1}

    assert CheckKinds.context("dialogues/g.json", ["check"], check, :choice) ==
             refused("dialogues/g.check.failure")
  end
end
