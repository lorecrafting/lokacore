defmodule Mix.Tasks.Loka.Generate.ChannelTypes do
  @moduledoc """
  Generates TypeScript type definitions from channel event schemas.

  This ensures the mobile app's types stay in sync with the server's
  schema definitions.

  ## Usage

      # Generate types to default location (../mobile/src/types/channel.ts)
      mix loka.generate.channel_types

      # Generate to custom location
      mix loka.generate.channel_types --output /path/to/types.ts

      # Print to stdout (dry run)
      mix loka.generate.channel_types --stdout

  ## Generated Types

  The output includes:
  - `ChannelEvent` union type of all event names
  - Payload types for each event (e.g., `NavigatePayload`)
  - `ChannelPayloads` type mapping events to their payloads
  - Helper types from definitions (UUID, Direction, etc.)

  ## Workflow

  1. Edit `priv/schemas/channel_events.json`
  2. Run `mix loka.generate.channel_types`
  3. Mobile app rebuilds with new types
  4. TypeScript compiler catches any mismatches
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  alias LokaWeb.Channels.ChannelSchema

  @shortdoc "Generate TypeScript types from channel schema"

  @default_output "../mobile/src/types/channel.generated.ts"

  @switches [
    output: :string,
    stdout: :boolean
  ]

  @impl Mix.Task
  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: @switches)

    Mix.Task.run("app.start")

    typescript = generate_typescript()

    if opts[:stdout] do
      IO.puts(typescript)
    else
      output_path = opts[:output] || @default_output

      # Ensure directory exists
      output_path
      |> Path.dirname()
      |> File.mkdir_p!()

      File.write!(output_path, typescript)
      Mix.shell().info("Generated TypeScript types: #{output_path}")
    end
  end

  defp generate_typescript do
    schema = ChannelSchema.schema()
    events = schema["events"]
    definitions = schema["definitions"]

    """
    /**
     * AUTO-GENERATED FILE - DO NOT EDIT
     *
     * Generated from: priv/schemas/channel_events.json
     * Run `mix loka.generate.channel_types` to regenerate
     *
     * Schema version: #{schema["version"]}
     * Generated at: #{DateTime.utc_now() |> DateTime.to_iso8601()}
     */

    // =============================================================================
    // Shared Types (from definitions)
    // =============================================================================

    #{generate_definitions(definitions)}

    // =============================================================================
    // Event Names
    // =============================================================================

    export type ChannelEvent = #{generate_event_union(events)};

    // =============================================================================
    // Event Payloads
    // =============================================================================

    #{generate_payload_types(events)}

    // =============================================================================
    // Event-to-Payload Mapping
    // =============================================================================

    export interface ChannelPayloads {
    #{generate_payload_mapping(events)}
    }

    // =============================================================================
    // Type-safe push helper
    // =============================================================================

    export type PushEvent<E extends ChannelEvent> = E extends keyof ChannelPayloads
      ? ChannelPayloads[E]
      : never;
    """
  end

  defp generate_definitions(definitions) do
    definitions
    |> Enum.map(fn {name, schema} ->
      type_name = camelize(name)
      ts_type = json_schema_to_typescript(schema)
      "export type #{type_name} = #{ts_type};"
    end)
    |> Enum.join("\n\n")
  end

  defp generate_event_union(events) do
    events
    |> Map.keys()
    |> Enum.sort()
    |> Enum.map(&"'#{&1}'")
    |> Enum.join(" | ")
  end

  defp generate_payload_types(events) do
    events
    |> Enum.sort_by(fn {name, _} -> name end)
    |> Enum.map(fn {name, event_schema} ->
      type_name = "#{camelize(name)}Payload"
      description = event_schema["description"] || ""
      payload_schema = event_schema["payload"]

      ts_type = json_schema_to_typescript(payload_schema)

      """
      /**
       * #{description}
       * Event: "#{name}"
       */
      export type #{type_name} = #{ts_type};
      """
    end)
    |> Enum.join("\n")
  end

  defp generate_payload_mapping(events) do
    events
    |> Enum.sort_by(fn {name, _} -> name end)
    |> Enum.map(fn {name, _} ->
      type_name = "#{camelize(name)}Payload"
      "  '#{name}': #{type_name};"
    end)
    |> Enum.join("\n")
  end

  defp json_schema_to_typescript(schema) when is_map(schema) do
    cond do
      Map.has_key?(schema, "oneOf") ->
        schema["oneOf"]
        |> Enum.map(&json_schema_to_typescript/1)
        |> Enum.join(" | ")

      Map.has_key?(schema, "$ref") ->
        ref = schema["$ref"]
        name = String.replace_prefix(ref, "#/definitions/", "")
        camelize(name)

      Map.has_key?(schema, "const") ->
        "'#{schema["const"]}'"

      Map.has_key?(schema, "enum") ->
        schema["enum"]
        |> Enum.map(&"'#{&1}'")
        |> Enum.join(" | ")

      schema["type"] == "object" ->
        properties = schema["properties"] || %{}
        required = MapSet.new(schema["required"] || [])

        if map_size(properties) == 0 do
          "Record<string, never>"
        else
          props =
            properties
            |> Enum.map(fn {key, prop_schema} ->
              optional = if MapSet.member?(required, key), do: "", else: "?"
              ts_type = json_schema_to_typescript(prop_schema)
              "  #{key}#{optional}: #{ts_type};"
            end)
            |> Enum.join("\n")

          "{\n#{props}\n}"
        end

      schema["type"] == "string" ->
        if Map.has_key?(schema, "enum") do
          schema["enum"]
          |> Enum.map(&"'#{&1}'")
          |> Enum.join(" | ")
        else
          "string"
        end

      schema["type"] == "integer" ->
        "number"

      schema["type"] == "number" ->
        "number"

      schema["type"] == "boolean" ->
        "boolean"

      schema["type"] == "array" ->
        item_type = json_schema_to_typescript(schema["items"] || %{})
        "#{item_type}[]"

      true ->
        "unknown"
    end
  end

  defp json_schema_to_typescript(_), do: "unknown"

  defp camelize(string) do
    string
    |> String.split("_")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join("")
  end
end
