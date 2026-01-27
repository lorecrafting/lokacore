defmodule Mix.Tasks.Loka.Gen.ChannelSchemaJson do
  @moduledoc """
  Generates a JSON schema file from Elixir channel event definitions for Godot.

  ## Usage

      mix loka.gen.channel_schema_json

  ## Output

  Generates `godot-client/data/channel_schema.json` containing:
  - Server event schemas (what Godot receives)
  - Client event schemas (what Godot sends)
  - Type definitions for validation

  ## When to Run

  Run this task whenever you modify `lib/loka/channel/events.ex`.
  The generated file should be committed to the repository.
  """

  use Mix.Task

  @output_path "../godot-client/data/channel_schema.json"

  @shortdoc "Generate JSON schema from channel event definitions for Godot"

  @impl Mix.Task
  def run(_args) do
    # Ensure the Events module is available
    Code.ensure_loaded!(Loka.Channel.Events)

    content = generate_json()
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
  # JSON Generation
  # ===========================================================================

  defp generate_json do
    schema = %{
      "_generated" => DateTime.utc_now() |> DateTime.to_iso8601(),
      "_source" => "server/lib/loka/channel/events.ex",
      "_version" => "1.0.0",
      "server_events" => convert_events(Loka.Channel.Events.server_events()),
      "client_events" => convert_events(Loka.Channel.Events.client_events())
    }

    Jason.encode!(schema, pretty: true)
  end

  defp convert_events(events) do
    events
    |> Enum.map(fn {name, schema} ->
      {name, convert_schema(schema)}
    end)
    |> Enum.into(%{})
  end

  defp convert_schema(schema) when is_map(schema) do
    schema
    |> Enum.map(fn {key, type} ->
      {to_string(key), convert_type(type)}
    end)
    |> Enum.into(%{})
  end

  defp convert_type(:string), do: %{"type" => "string", "required" => true}
  defp convert_type(:integer), do: %{"type" => "integer", "required" => true}
  defp convert_type(:boolean), do: %{"type" => "boolean", "required" => true}
  defp convert_type(:map), do: %{"type" => "map", "required" => true}
  defp convert_type(:list), do: %{"type" => "list", "required" => true}

  defp convert_type({:optional, inner_type}) do
    inner = convert_type(inner_type)
    Map.put(inner, "required", false)
  end

  defp convert_type({:enum, values}) do
    %{
      "type" => "enum",
      "required" => true,
      "values" => values
    }
  end

  defp convert_type(%{} = nested_schema) do
    %{
      "type" => "object",
      "required" => true,
      "fields" => convert_schema(nested_schema)
    }
  end

  defp convert_type(unknown) do
    %{"type" => "unknown", "raw" => inspect(unknown)}
  end
end
