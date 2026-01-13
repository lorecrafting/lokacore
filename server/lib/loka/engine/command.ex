defmodule Loka.Engine.Command do
  @moduledoc """
  Command behaviour for the Loka engine.

  Commands are the primary way players interact with the world.
  They are parsed, validated, and executed in a pipeline.
  """

  alias Loka.Engine.Event

  @type parse_result :: {:ok, map()} | {:error, String.t()}
  @type execute_result :: {:ok, [Event.t()]} | {:error, String.t()}
  @type context :: %{
          actor: map(),
          location: map(),
          session: pid()
        }

  @doc """
  Returns the primary command key (e.g., "look", "say", "move").
  """
  @callback key() :: String.t()

  @doc """
  Returns a list of command aliases (e.g., ["l"] for "look").
  """
  @callback aliases() :: [String.t()]

  @doc """
  Returns the help text for the command.
  """
  @callback help() :: String.t()

  @doc """
  Returns required permissions/locks for this command.
  """
  @callback locks() :: [atom()]

  @doc """
  Returns required context keys for this command.

  If implemented, the CommandRegistry will validate that all required
  keys are present in the context before calling parse/2 or execute/2.

  This provides compile-time documentation and runtime validation of
  command dependencies.

  ## Examples

      # Command requires actor and location
      def required_context, do: [:actor, :location]

      # Command requires game_state for entity lookups
      def required_context, do: [:actor, :location, :game_state]
  """
  @callback required_context() :: [atom()]

  @doc """
  Parses the command arguments and returns structured data.
  """
  @callback parse(args :: String.t(), context :: context()) :: parse_result()

  @doc """
  Executes the command and returns events to emit.
  """
  @callback execute(parsed :: map(), context :: context()) :: execute_result()

  @optional_callbacks [aliases: 0, locks: 0, required_context: 0]

  @doc """
  Default implementations for optional callbacks.
  """
  defmacro __using__(_opts) do
    quote do
      @behaviour Loka.Engine.Command

      def aliases, do: []
      def locks, do: []
      def required_context, do: []

      defoverridable aliases: 0, locks: 0, required_context: 0
    end
  end
end
