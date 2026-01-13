defmodule Loka.Engine.Commands.HelpCommand do
  @moduledoc """
  Command for displaying help information.

  ## Usage

      # Show all commands
      {:ok, parsed} = HelpCommand.parse("", context)
      {:ok, events} = HelpCommand.execute(parsed, context)

      # Show help for a specific command
      {:ok, parsed} = HelpCommand.parse("look", context)
      {:ok, events} = HelpCommand.execute(parsed, context)
  """

  use Loka.Engine.Command

  alias Loka.Engine.CommandRegistry

  @impl true
  def key, do: "help"

  @impl true
  def aliases, do: ["?", "commands"]

  @impl true
  def help do
    "Display help for commands. Use 'help <command>' for specific help."
  end

  @impl true
  def parse(args, _context) do
    topic = String.trim(args)
    {:ok, %{topic: topic}}
  end

  @impl true
  def execute(%{topic: ""}, _context) do
    # Show all available commands
    commands = CommandRegistry.command_info()

    text = build_command_list(commands)

    event = %{
      type: :help,
      data: %{commands: commands},
      text: text,
      timestamp: DateTime.utc_now()
    }

    {:ok, [event]}
  end

  def execute(%{topic: topic}, _context) do
    case CommandRegistry.help(topic) do
      {:ok, help_text} ->
        aliases =
          case CommandRegistry.aliases(topic) do
            {:ok, alias_list} when alias_list != [] ->
              " (aliases: #{Enum.join(alias_list, ", ")})"

            _ ->
              ""
          end

        event = %{
          type: :help,
          text: "#{String.upcase(topic)}#{aliases}\n\n#{help_text}",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}

      {:error, :not_found} ->
        event = %{
          type: :help,
          text: "Unknown command: #{topic}. Type 'help' for a list of commands.",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp build_command_list(commands) do
    header = "Available Commands:\n\n"

    command_lines =
      commands
      |> Enum.sort_by(& &1.key)
      |> Enum.map(fn cmd ->
        aliases =
          if cmd.aliases != [] do
            " (#{Enum.join(cmd.aliases, ", ")})"
          else
            ""
          end

        "  #{cmd.key}#{aliases} - #{cmd.help}"
      end)
      |> Enum.join("\n")

    footer = "\n\nType 'help <command>' for more information on a specific command."

    header <> command_lines <> footer
  end
end
