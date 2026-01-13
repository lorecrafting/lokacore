defmodule Loka.EngineFixtures do
  @moduledoc """
  Test helpers for creating entities and scripts.
  """

  alias Loka.Engine.Entities
  alias Loka.Engine.Scripts

  def unique_entity_key, do: "entity_#{System.unique_integer([:positive])}"
  def unique_script_name, do: "script_#{System.unique_integer([:positive])}"

  def valid_entity_attrs(attrs \\ %{}) do
    Enum.into(attrs, %{
      type: "room",
      key: unique_entity_key(),
      short_desc: "Test Room",
      extra_desc: "A test room description"
    })
  end

  def valid_script_attrs(attrs \\ %{}) do
    Enum.into(attrs, %{
      name: unique_script_name(),
      description: "A test script",
      source: "return true",
      hook: "on_enter",
      enabled: true
    })
  end

  def entity_fixture(attrs \\ %{}) do
    {:ok, entity} =
      attrs
      |> valid_entity_attrs()
      |> Entities.create_entity()

    entity
  end

  def room_fixture(attrs \\ %{}) do
    entity_fixture(Map.merge(%{type: "room"}, attrs))
  end

  def npc_fixture(attrs \\ %{}) do
    entity_fixture(Map.merge(%{type: "npc", short_desc: "Test NPC"}, attrs))
  end

  def item_fixture(attrs \\ %{}) do
    entity_fixture(Map.merge(%{type: "item", short_desc: "Test Item"}, attrs))
  end

  def script_fixture(attrs \\ %{}) do
    {:ok, script} =
      attrs
      |> valid_script_attrs()
      |> Scripts.create_script()

    script
  end
end
