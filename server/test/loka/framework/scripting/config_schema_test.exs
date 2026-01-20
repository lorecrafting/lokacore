defmodule Loka.Framework.Scripting.ConfigSchemaTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Scripting.ConfigSchema

  describe "validate/2" do
    test "passes validation with valid config" do
      schema = %{
        route: %{type: :list, required: true},
        interval: %{type: :integer, default: 300}
      }

      config = %{route: ["a", "b", "c"]}

      assert {:ok, validated} = ConfigSchema.validate(config, schema)
      assert validated.route == ["a", "b", "c"]
      assert validated.interval == 300
    end

    test "fails when required field is missing" do
      schema = %{
        route: %{type: :list, required: true}
      }

      config = %{}

      assert {:error, errors} = ConfigSchema.validate(config, schema)
      assert "route is required" in errors
    end

    test "applies default for optional field" do
      schema = %{
        interval: %{type: :integer, default: 300}
      }

      config = %{}

      assert {:ok, validated} = ConfigSchema.validate(config, schema)
      assert validated.interval == 300
    end

    test "validates integer type" do
      schema = %{
        count: %{type: :integer}
      }

      assert {:ok, _} = ConfigSchema.validate(%{count: 5}, schema)
      assert {:error, errors} = ConfigSchema.validate(%{count: "five"}, schema)
      assert Enum.any?(errors, &String.contains?(&1, "must be integer"))
    end

    test "validates string type" do
      schema = %{
        name: %{type: :string}
      }

      assert {:ok, _} = ConfigSchema.validate(%{name: "test"}, schema)
      assert {:error, errors} = ConfigSchema.validate(%{name: 123}, schema)
      assert Enum.any?(errors, &String.contains?(&1, "must be string"))
    end

    test "validates list type" do
      schema = %{
        items: %{type: :list}
      }

      assert {:ok, _} = ConfigSchema.validate(%{items: [1, 2, 3]}, schema)
      assert {:error, errors} = ConfigSchema.validate(%{items: "not a list"}, schema)
      assert Enum.any?(errors, &String.contains?(&1, "must be list"))
    end

    test "validates boolean type" do
      schema = %{
        enabled: %{type: :boolean}
      }

      assert {:ok, _} = ConfigSchema.validate(%{enabled: true}, schema)
      assert {:ok, _} = ConfigSchema.validate(%{enabled: false}, schema)
      assert {:error, errors} = ConfigSchema.validate(%{enabled: "yes"}, schema)
      assert Enum.any?(errors, &String.contains?(&1, "must be boolean"))
    end

    test "validates min constraint" do
      schema = %{
        interval: %{type: :integer, min: 60}
      }

      assert {:ok, _} = ConfigSchema.validate(%{interval: 60}, schema)
      assert {:ok, _} = ConfigSchema.validate(%{interval: 100}, schema)
      assert {:error, errors} = ConfigSchema.validate(%{interval: 30}, schema)
      assert Enum.any?(errors, &String.contains?(&1, "must be >= 60"))
    end

    test "validates max constraint" do
      schema = %{
        interval: %{type: :integer, max: 3600}
      }

      assert {:ok, _} = ConfigSchema.validate(%{interval: 3600}, schema)
      assert {:ok, _} = ConfigSchema.validate(%{interval: 100}, schema)
      assert {:error, errors} = ConfigSchema.validate(%{interval: 5000}, schema)
      assert Enum.any?(errors, &String.contains?(&1, "must be <= 3600"))
    end

    test "handles string keys in schema" do
      schema = %{
        "route" => %{"type" => "list", "required" => true}
      }

      config = %{"route" => ["a", "b"]}

      assert {:ok, validated} = ConfigSchema.validate(config, schema)
      assert validated.route == ["a", "b"]
    end

    test "handles nil schema" do
      assert {:ok, config} = ConfigSchema.validate(%{foo: "bar"}, nil)
      assert config.foo == "bar"
    end

    test "handles empty schema" do
      assert {:ok, config} = ConfigSchema.validate(%{foo: "bar"}, %{})
      assert config.foo == "bar"
    end

    test "collects multiple errors" do
      schema = %{
        name: %{type: :string, required: true},
        count: %{type: :integer, required: true}
      }

      config = %{}

      assert {:error, errors} = ConfigSchema.validate(config, schema)
      assert length(errors) == 2
    end
  end

  describe "apply_defaults/2" do
    test "applies defaults without validation" do
      schema = %{
        interval: %{default: 300},
        enabled: %{default: true}
      }

      config = %{}

      result = ConfigSchema.apply_defaults(config, schema)
      assert result.interval == 300
      assert result.enabled == true
    end

    test "preserves existing values" do
      schema = %{
        interval: %{default: 300}
      }

      config = %{interval: 600}

      result = ConfigSchema.apply_defaults(config, schema)
      assert result.interval == 600
    end
  end

  describe "validate!/2" do
    test "returns validated config on success" do
      schema = %{
        name: %{type: :string, default: "default"}
      }

      result = ConfigSchema.validate!(%{}, schema)
      assert result.name == "default"
    end

    test "raises on validation error" do
      schema = %{
        name: %{type: :string, required: true}
      }

      assert_raise RuntimeError, ~r/Config validation failed/, fn ->
        ConfigSchema.validate!(%{}, schema)
      end
    end
  end
end
