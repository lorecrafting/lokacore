defmodule Mix.Tasks.Loka.Gen.ChannelTypes do
  @moduledoc """
  Generates TypeScript types from Elixir channel event definitions.

  ## Usage

      mix loka.gen.channel_types

  ## Output

  Generates `mobile/src/types/channel.generated.ts` containing:
  - Interface for each server event payload
  - Interface for each client event request
  - Union types for event names
  - Runtime schemas for client-side validation

  ## When to Run

  Run this task whenever you modify `lib/loka/channel/events.ex`.
  The CI pipeline will fail if the generated file is out of sync.
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @output_path "../mobile/src/types/channel.generated.ts"

  @shortdoc "Generate TypeScript types from channel event definitions"

  @impl Mix.Task
  def run(_args) do
    # Ensure the Events module is available
    Code.ensure_loaded!(Loka.Channel.Events)

    content = generate_typescript()
    output_path = Path.expand(@output_path, File.cwd!())

    # Ensure directory exists
    output_path |> Path.dirname() |> File.mkdir_p!()

    File.write!(output_path, content)
    Mix.shell().info("Generated #{output_path}")

    # Show stats
    server_count = length(Loka.Channel.Events.server_event_names())
    client_count = length(Loka.Channel.Events.client_event_names())
    Mix.shell().info("  Server events: #{server_count}")
    Mix.shell().info("  Client events: #{client_count}")
  end

  # ===========================================================================
  # TypeScript Generation
  # ===========================================================================

  defp generate_typescript do
    timestamp = DateTime.utc_now() |> DateTime.to_iso8601()

    [
      generate_header(timestamp),
      generate_server_event_payloads(),
      generate_client_event_requests(),
      generate_event_name_unions(),
      generate_runtime_schemas(),
      generate_payload_maps()
    ]
    |> Enum.join("\n")
  end

  defp generate_header(timestamp) do
    """
    // =============================================================================
    // AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
    // =============================================================================
    //
    // Generated from: server/lib/loka/channel/events.ex
    // Generated at: #{timestamp}
    //
    // To regenerate: cd server && mix loka.gen.channel_types
    //
    // This file defines all channel events between server and client.
    // The source of truth is the Elixir events.ex file.
    // =============================================================================
    """
  end

  defp generate_server_event_payloads do
    events = Loka.Channel.Events.server_events()

    header = """
    // =============================================================================
    // Server -> Client Event Payloads
    // =============================================================================
    """

    interfaces =
      events
      |> Enum.sort_by(fn {name, _} -> name end)
      |> Enum.map(fn {name, schema} ->
        interface_name = to_pascal_case(name) <> "Payload"
        generate_interface(interface_name, schema)
      end)
      |> Enum.join("\n\n")

    header <> "\n" <> interfaces
  end

  defp generate_client_event_requests do
    events = Loka.Channel.Events.client_events()

    header = """
    // =============================================================================
    // Client -> Server Event Requests
    // =============================================================================
    """

    interfaces =
      events
      |> Enum.sort_by(fn {name, _} -> name end)
      |> Enum.map(fn {name, schema} ->
        interface_name = to_pascal_case(name) <> "Request"
        generate_interface(interface_name, schema)
      end)
      |> Enum.join("\n\n")

    header <> "\n" <> interfaces
  end

  defp generate_interface(name, schema) when map_size(schema) == 0 do
    "export interface #{name} {}"
  end

  defp generate_interface(name, schema) do
    fields =
      schema
      |> Enum.sort_by(fn {key, _} -> to_string(key) end)
      |> Enum.map(fn {key, type} ->
        optional = is_optional?(type)
        ts_type = type_to_typescript(type)
        "  #{key}#{if optional, do: "?", else: ""}: #{ts_type};"
      end)
      |> Enum.join("\n")

    "export interface #{name} {\n#{fields}\n}"
  end

  defp generate_event_name_unions do
    server_names =
      Loka.Channel.Events.server_event_names()
      |> Enum.sort()
      |> Enum.map(&"  | \"#{&1}\"")
      |> Enum.join("\n")

    client_names =
      Loka.Channel.Events.client_event_names()
      |> Enum.sort()
      |> Enum.map(&"  | \"#{&1}\"")
      |> Enum.join("\n")

    """
    // =============================================================================
    // Event Name Types
    // =============================================================================

    export type ServerEventName =
    #{server_names};

    export type ClientEventName =
    #{client_names};
    """
  end

  defp generate_runtime_schemas do
    server_schemas =
      generate_schema_object(Loka.Channel.Events.server_events(), "SERVER_EVENT_SCHEMAS")

    client_schemas =
      generate_schema_object(Loka.Channel.Events.client_events(), "CLIENT_EVENT_SCHEMAS")

    """
    // =============================================================================
    // Runtime Schemas - for client-side validation
    // =============================================================================

    export interface FieldSchema {
      type: 'string' | 'integer' | 'boolean' | 'map' | 'list' | 'enum' | 'object';
      required: boolean;
      enumValues?: string[];
      nested?: Record<string, FieldSchema>;
    }

    export type EventSchema = Record<string, FieldSchema>;

    #{server_schemas}

    #{client_schemas}
    """
  end

  defp generate_schema_object(events, const_name) do
    schemas =
      events
      |> Enum.sort_by(fn {name, _} -> name end)
      |> Enum.map(fn {name, schema} ->
        schema_ts = schema_to_runtime_ts(schema)
        "  \"#{name}\": #{schema_ts}"
      end)
      |> Enum.join(",\n")

    "export const #{const_name}: Record<string, EventSchema> = {\n#{schemas}\n};"
  end

  defp generate_payload_maps do
    server_mappings =
      Loka.Channel.Events.server_event_names()
      |> Enum.sort()
      |> Enum.map(fn name ->
        interface_name = to_pascal_case(name) <> "Payload"
        "  #{name}: #{interface_name}"
      end)
      |> Enum.join(";\n")

    client_mappings =
      Loka.Channel.Events.client_event_names()
      |> Enum.sort()
      |> Enum.map(fn name ->
        interface_name = to_pascal_case(name) <> "Request"
        "  #{name}: #{interface_name}"
      end)
      |> Enum.join(";\n")

    """
    // =============================================================================
    // Payload Type Maps - for type-safe handlers
    // =============================================================================

    export interface ServerEventPayloads {
    #{server_mappings};
    }

    export interface ClientEventPayloads {
    #{client_mappings};
    }
    """
  end

  # ===========================================================================
  # Type Conversion Helpers
  # ===========================================================================

  defp type_to_typescript(:string), do: "string"
  defp type_to_typescript(:integer), do: "number"
  defp type_to_typescript(:boolean), do: "boolean"
  defp type_to_typescript(:map), do: "Record<string, unknown>"
  defp type_to_typescript(:list), do: "unknown[]"

  defp type_to_typescript({:optional, inner_type}) do
    type_to_typescript(inner_type)
  end

  defp type_to_typescript({:enum, values}) do
    values
    |> Enum.map(&"\"#{&1}\"")
    |> Enum.join(" | ")
  end

  defp type_to_typescript(%{} = nested_schema) when map_size(nested_schema) == 0 do
    "{}"
  end

  defp type_to_typescript(%{} = nested_schema) do
    fields =
      nested_schema
      |> Enum.sort_by(fn {key, _} -> to_string(key) end)
      |> Enum.map(fn {key, type} ->
        optional = is_optional?(type)
        ts_type = type_to_typescript(type)
        "#{key}#{if optional, do: "?", else: ""}: #{ts_type}"
      end)
      |> Enum.join("; ")

    "{ #{fields} }"
  end

  defp schema_to_runtime_ts(schema) when map_size(schema) == 0 do
    "{}"
  end

  defp schema_to_runtime_ts(schema) do
    fields =
      schema
      |> Enum.sort_by(fn {key, _} -> to_string(key) end)
      |> Enum.map(fn {key, type} ->
        field_schema = type_to_runtime_schema(type)
        "    \"#{key}\": #{field_schema}"
      end)
      |> Enum.join(",\n")

    "{\n#{fields}\n  }"
  end

  defp type_to_runtime_schema(:string), do: "{ type: 'string', required: true }"
  defp type_to_runtime_schema(:integer), do: "{ type: 'integer', required: true }"
  defp type_to_runtime_schema(:boolean), do: "{ type: 'boolean', required: true }"
  defp type_to_runtime_schema(:map), do: "{ type: 'map', required: true }"
  defp type_to_runtime_schema(:list), do: "{ type: 'list', required: true }"

  defp type_to_runtime_schema({:optional, inner_type}) do
    inner = type_to_runtime_schema(inner_type)
    String.replace(inner, "required: true", "required: false")
  end

  defp type_to_runtime_schema({:enum, values}) do
    values_str = Enum.map(values, &"\"#{&1}\"") |> Enum.join(", ")
    "{ type: 'enum', required: true, enumValues: [#{values_str}] }"
  end

  defp type_to_runtime_schema(%{} = nested_schema) do
    nested = schema_to_runtime_ts(nested_schema)
    "{ type: 'object', required: true, nested: #{nested} }"
  end

  defp is_optional?({:optional, _}), do: true
  defp is_optional?(_), do: false

  defp to_pascal_case(string) do
    string
    |> String.split("_")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join("")
  end
end
