defmodule Loka.Engine.SocialRegistry do
  @moduledoc """
  Registers social commands dynamically with the CommandRegistry.

  At application startup, this module reads all socials from the SocialLoader
  and registers each one as a command. This allows players to use social
  commands like "smile", "wave", "hug" etc. without hardcoding each one.

  ## How It Works

  1. Reads all socials from SocialLoader
  2. For each social, creates a dynamic command module
  3. Registers with CommandRegistry including aliases
  4. The SocialCommand module handles actual execution

  ## Usage

      # Called at application startup
      SocialRegistry.register_all()

      # After adding new socials to YAML and reloading
      SocialLoader.reload()
      SocialRegistry.register_all()
  """

  require Logger

  alias Loka.Engine.SocialLoader
  alias Loka.Engine.CommandRegistry

  @doc """
  Registers all loaded socials as commands.

  Should be called after SocialLoader is started.

  ## Returns

  - `{:ok, count}` - Number of socials registered
  - `{:error, reason}` - If registration fails
  """
  def register_all(command_registry \\ CommandRegistry, social_loader \\ SocialLoader) do
    socials = social_loader.all()

    registered =
      Enum.reduce(socials, 0, fn {key, social}, count ->
        case register_social(key, social, command_registry) do
          :ok -> count + 1
          {:error, _} -> count
        end
      end)

    Logger.info("SocialRegistry registered #{registered} social commands")
    {:ok, registered}
  end

  @doc """
  Registers a single social as a command.

  Creates a dynamic command module that delegates to SocialCommand.
  """
  def register_social(key, social, command_registry \\ CommandRegistry) do
    # Create a dynamic module for this social
    module_name = create_module_name(key)

    # Define the module if it doesn't exist
    unless Code.ensure_loaded?(module_name) do
      define_social_module(module_name, key, social)
    end

    # Register with CommandRegistry
    command_registry.register(module_name)
  end

  @doc """
  Unregisters all social commands.

  Useful for cleanup before re-registration.
  """
  def unregister_all(command_registry \\ CommandRegistry, social_loader \\ SocialLoader) do
    socials = social_loader.all()

    Enum.each(socials, fn {key, social} ->
      # Unregister primary key
      command_registry.unregister(key)

      # Unregister aliases
      Enum.each(social.aliases, fn alias_key ->
        command_registry.unregister(alias_key)
      end)
    end)

    :ok
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp create_module_name(key) do
    # Convert "smile" to Loka.Engine.Commands.Socials.SmileCommand
    camelized = key |> Macro.camelize()
    Module.concat([Loka.Engine.Commands.Socials, "#{camelized}Command"])
  end

  defp define_social_module(module_name, key, social) do
    # Build the help text
    help_text = build_help_text(key, social)

    # Define the module at runtime
    Module.create(
      module_name,
      quote do
        use Loka.Engine.Command

        alias Loka.Engine.Commands.SocialCommand
        alias Loka.Engine.SocialLoader

        @social_key unquote(key)
        @social_aliases unquote(Macro.escape(social.aliases))
        @help_text unquote(help_text)

        @impl true
        def key, do: @social_key

        @impl true
        def aliases, do: @social_aliases

        @impl true
        def help, do: @help_text

        @impl true
        def parse(args, context) do
          SocialCommand.parse(args, context)
        end

        @impl true
        def execute(parsed, context) do
          # Add the social key to context for SocialCommand
          context_with_social = Map.put(context, :social_key, @social_key)
          SocialCommand.execute(parsed, context_with_social)
        end
      end,
      Macro.Env.location(__ENV__)
    )
  end

  defp build_help_text(key, social) do
    target_hint =
      if social.requires_target do
        " <target>"
      else
        " [target]"
      end

    position_hint =
      case social.min_position do
        :standing -> ""
        :sitting -> " (requires sitting or standing)"
        :resting -> " (can do while resting)"
        :sleeping -> " (can do while sleeping)"
        _ -> ""
      end

    aliases_hint =
      if Enum.empty?(social.aliases) do
        ""
      else
        " (aliases: #{Enum.join(social.aliases, ", ")})"
      end

    "#{key}#{target_hint} - Perform the #{key} emote.#{position_hint}#{aliases_hint}"
  end
end
