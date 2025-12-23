defmodule Exmud.Framework.Combat.ElementsTest do
  use ExUnit.Case, async: false

  alias Exmud.Framework.Combat.Elements

  # Start a fresh GenServer for each test with unique name
  setup do
    name = :"elements_test_#{System.unique_integer([:positive])}"
    {:ok, pid} = Elements.start_link(name: name)
    on_exit(fn -> Process.exit(pid, :normal) end)
    {:ok, server: name}
  end

  describe "get/2" do
    test "returns fire element definition", %{server: server} do
      assert {:ok, element} = Elements.get(:fire, server)
      assert element.key == :fire
      assert element.name == "Fire"
      assert :ice in element.strong_against
      assert :water in element.weak_against
    end

    test "returns water element definition", %{server: server} do
      assert {:ok, element} = Elements.get(:water, server)
      assert element.key == :water
      assert :fire in element.strong_against
      assert :lightning in element.weak_against
    end

    test "returns error for unknown element", %{server: server} do
      assert {:error, :not_found} = Elements.get(:unknown, server)
    end

    test "handles string key input", %{server: server} do
      assert {:ok, element} = Elements.get("fire", server)
      assert element.key == :fire
    end
  end

  describe "all/1" do
    test "returns all default elements", %{server: server} do
      elements = Elements.all(server)
      assert length(elements) == 10
      keys = Enum.map(elements, & &1.key)
      assert :fire in keys
      assert :water in keys
      assert :lightning in keys
      assert :earth in keys
      assert :ice in keys
      assert :plant in keys
      assert :poison in keys
      assert :metal in keys
      assert :light in keys
      assert :shadow in keys
    end
  end

  describe "calculate_modifier/3" do
    test "returns strong multiplier for fire vs ice", %{server: server} do
      assert Elements.calculate_modifier(:fire, :ice, server) == 1.5
    end

    test "returns strong multiplier for fire vs plant", %{server: server} do
      assert Elements.calculate_modifier(:fire, :plant, server) == 1.5
    end

    test "returns weak multiplier for fire vs water", %{server: server} do
      assert Elements.calculate_modifier(:fire, :water, server) == 0.5
    end

    test "returns neutral multiplier for fire vs lightning", %{server: server} do
      assert Elements.calculate_modifier(:fire, :lightning, server) == 1.0
    end

    test "returns neutral for nil attack element", %{server: server} do
      assert Elements.calculate_modifier(nil, :fire, server) == 1.0
    end

    test "returns neutral for nil target element", %{server: server} do
      assert Elements.calculate_modifier(:fire, nil, server) == 1.0
    end

    test "returns neutral for unknown attack element", %{server: server} do
      assert Elements.calculate_modifier(:unknown, :fire, server) == 1.0
    end
  end

  describe "apply_modifier/4" do
    test "applies strong modifier to base damage", %{server: server} do
      assert Elements.apply_modifier(20, :fire, :ice, server) == 30
    end

    test "applies weak modifier to base damage", %{server: server} do
      assert Elements.apply_modifier(20, :fire, :water, server) == 10
    end

    test "applies neutral modifier to base damage", %{server: server} do
      assert Elements.apply_modifier(20, :fire, :lightning, server) == 20
    end

    test "rounds to nearest integer", %{server: server} do
      # 15 * 1.5 = 22.5 -> 23
      assert Elements.apply_modifier(15, :fire, :ice, server) == 23
    end
  end

  describe "get_relationship/3" do
    test "returns strong for fire vs ice", %{server: server} do
      assert Elements.get_relationship(:fire, :ice, server) == :strong
    end

    test "returns weak for fire vs water", %{server: server} do
      assert Elements.get_relationship(:fire, :water, server) == :weak
    end

    test "returns neutral for fire vs lightning", %{server: server} do
      assert Elements.get_relationship(:fire, :lightning, server) == :neutral
    end

    test "returns neutral for nil attack element", %{server: server} do
      assert Elements.get_relationship(nil, :fire, server) == :neutral
    end

    test "returns neutral for nil target element", %{server: server} do
      assert Elements.get_relationship(:fire, nil, server) == :neutral
    end
  end

  describe "get_color/2" do
    test "returns color for fire", %{server: server} do
      assert Elements.get_color(:fire, server) == "red"
    end

    test "returns color for water", %{server: server} do
      assert Elements.get_color(:water, server) == "blue"
    end

    test "returns gray for unknown element", %{server: server} do
      assert Elements.get_color(:unknown, server) == "gray"
    end
  end

  describe "multipliers/0" do
    test "returns multiplier values" do
      mult = Elements.multipliers()
      assert mult.strong == 1.5
      assert mult.weak == 0.5
      assert mult.neutral == 1.0
    end
  end

  describe "element relationships" do
    test "water is strong against fire and earth", %{server: server} do
      assert Elements.get_relationship(:water, :fire, server) == :strong
      assert Elements.get_relationship(:water, :earth, server) == :strong
    end

    test "lightning is strong against water and metal", %{server: server} do
      assert Elements.get_relationship(:lightning, :water, server) == :strong
      assert Elements.get_relationship(:lightning, :metal, server) == :strong
    end

    test "earth is strong against lightning and poison", %{server: server} do
      assert Elements.get_relationship(:earth, :lightning, server) == :strong
      assert Elements.get_relationship(:earth, :poison, server) == :strong
    end

    test "ice is strong against water and plant", %{server: server} do
      assert Elements.get_relationship(:ice, :water, server) == :strong
      assert Elements.get_relationship(:ice, :plant, server) == :strong
    end

    test "light is strong against shadow", %{server: server} do
      assert Elements.get_relationship(:light, :shadow, server) == :strong
    end

    test "shadow is strong against light and mind", %{server: server} do
      assert Elements.get_relationship(:shadow, :light, server) == :strong
      assert Elements.get_relationship(:shadow, :mind, server) == :strong
    end
  end
end
