defmodule ArchitectureTest do
  @moduledoc """
  Tests to enforce architectural layer separation.

  ## Layer Hierarchy (inner -> outer)

  ```
  ┌─────────────────────────────────────────────────┐
  │ Web (LokaWeb) - Controllers, LiveView, Channels │
  ├─────────────────────────────────────────────────┤
  │ Framework (Loka.Framework) - Game systems       │
  ├─────────────────────────────────────────────────┤
  │ Engine (Loka.Engine) - Core entity system       │
  ├─────────────────────────────────────────────────┤
  │ Primitives (Loka.Primitives) - Data types       │
  └─────────────────────────────────────────────────┘
  ```

  ## Rules

  - Inner layers MUST NOT depend on outer layers
  - Engine MUST NOT depend on Framework or Web
  - Framework MUST NOT depend on Web
  - Primitives should have minimal dependencies (only stdlib)

  Layer separation is also documented in lib/loka.ex.
  """

  use ExUnit.Case

  @engine_path "lib/loka/engine"
  @framework_path "lib/loka/framework"
  @primitives_path "lib/loka/primitives"

  describe "layer separation - Engine" do
    test "Engine modules do not import Framework modules" do
      violations = find_layer_imports(@engine_path, "Loka.Framework")
      assert_no_violations(violations, "Engine", "Framework")
    end

    test "Engine modules do not import Web modules" do
      violations = find_layer_imports(@engine_path, "LokaWeb")
      assert_no_violations(violations, "Engine", "Web")
    end
  end

  describe "layer separation - Framework" do
    test "Framework modules do not import Web modules" do
      violations = find_layer_imports(@framework_path, "LokaWeb")
      assert_no_violations(violations, "Framework", "Web")
    end
  end

  describe "layer separation - Primitives" do
    test "Primitives do not import Engine modules" do
      violations = find_layer_imports(@primitives_path, "Loka.Engine")
      assert_no_violations(violations, "Primitives", "Engine")
    end

    test "Primitives do not import Framework modules" do
      violations = find_layer_imports(@primitives_path, "Loka.Framework")
      assert_no_violations(violations, "Primitives", "Framework")
    end
  end

  describe "module organization" do
    test "all Engine modules are under Loka.Engine namespace" do
      violations =
        Path.wildcard("#{@engine_path}/**/*.ex")
        |> Enum.flat_map(&check_namespace(&1, "Loka.Engine"))

      if violations != [] do
        flunk(
          "Engine files should define Loka.Engine.* modules:\n#{format_violations(violations)}"
        )
      end
    end

    test "all Framework modules are under Loka.Framework namespace" do
      violations =
        Path.wildcard("#{@framework_path}/**/*.ex")
        |> Enum.flat_map(&check_namespace(&1, "Loka.Framework"))

      if violations != [] do
        flunk(
          "Framework files should define Loka.Framework.* modules:\n#{format_violations(violations)}"
        )
      end
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp find_layer_imports(source_path, forbidden_namespace) do
    Path.wildcard("#{source_path}/**/*.ex")
    |> Enum.flat_map(&check_file_for_imports(&1, forbidden_namespace))
  end

  defp check_file_for_imports(file_path, forbidden_namespace) do
    content = File.read!(file_path)
    content_without_docs = remove_doc_strings(content)

    content_without_docs
    |> String.split("\n")
    |> Enum.with_index(1)
    |> Enum.filter(fn {line, _num} ->
      (String.contains?(line, "alias #{forbidden_namespace}") or
         String.contains?(line, "import #{forbidden_namespace}") or
         String.contains?(line, "require #{forbidden_namespace}")) and
        not comment?(line)
    end)
    |> Enum.map(fn {line, num} ->
      {relative_path(file_path), num, line}
    end)
  end

  defp check_namespace(file_path, expected_prefix) do
    content = File.read!(file_path)

    # Find the first defmodule declaration
    case Regex.run(~r/defmodule\s+([A-Z][\w.]+)/, content) do
      [_, module_name] ->
        if String.starts_with?(module_name, expected_prefix) do
          []
        else
          [{relative_path(file_path), 1, "defines #{module_name}, expected #{expected_prefix}.*"}]
        end

      nil ->
        # No module definition found (might be a script or config file)
        []
    end
  end

  defp assert_no_violations(violations, source_layer, forbidden_layer) do
    if violations != [] do
      flunk("""
      #{source_layer} layer must not depend on #{forbidden_layer} layer!

      Found #{length(violations)} violation(s):

      #{format_violations(violations)}

      To fix: Use Hooks to extend behavior from outer layers,
      or move shared code to a lower layer.
      """)
    end
  end

  defp format_violations(violations) do
    violations
    |> Enum.map(fn {file, line, code} ->
      "  #{file}:#{line}\n    #{String.trim(code)}"
    end)
    |> Enum.join("\n\n")
  end

  defp remove_doc_strings(content) do
    content
    |> String.replace(~r/@moduledoc\s+""".*?"""/s, "@moduledoc false")
    |> String.replace(~r/@doc\s+""".*?"""/s, "@doc false")
    |> String.replace(~r/@doc\s+~S""".*?"""/s, "@doc false")
  end

  defp comment?(line) do
    trimmed = String.trim_leading(line)
    String.starts_with?(trimmed, "#")
  end

  defp relative_path(path) do
    Path.relative_to_cwd(path)
  end
end
