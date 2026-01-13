defmodule Loka.Plugins.Guilds.Commands.GuildCommand do
  @moduledoc """
  Guild management command.

  Usage:
    guild create <name>  - Create a new guild
    guild join <name>    - Request to join a guild
    guild leave          - Leave your current guild
    guild info [name]    - View guild information
    guild donate <amount> - Donate gold to guild treasury
    guild list           - List all guilds
  """

  use Loka.Engine.Command

  alias Loka.Plugins.Guilds.Guilds

  @impl true
  def key, do: "guild"

  @impl true
  def aliases, do: ["g"]

  @impl true
  def help do
    """
    Guild Management Commands:
      guild create <name>   - Create a new guild (costs gold)
      guild join <name>     - Request to join a guild
      guild leave           - Leave your current guild
      guild info [name]     - View guild information (yours if no name given)
      guild donate <amount> - Donate gold to guild treasury
      guild list            - List all guilds
    """
  end

  @impl true
  def parse(args, _context) do
    tokens = String.split(args)

    case parse_subcommand(tokens) do
      {:error, msg} -> {:error, msg}
      :help -> {:ok, %{subcommand: :help}}
      {:create, name} -> {:ok, %{subcommand: :create, name: name}}
      {:join, name} -> {:ok, %{subcommand: :join, name: name}}
      :leave -> {:ok, %{subcommand: :leave}}
      {:info, name} -> {:ok, %{subcommand: :info, name: name}}
      {:donate, amount} -> {:ok, %{subcommand: :donate, amount: amount}}
      :list -> {:ok, %{subcommand: :list}}
    end
  end

  @impl true
  def execute(parsed, context) do
    actor = Map.get(context, :actor)
    actor_id = if actor, do: Map.get(actor, :id), else: nil

    # Validate player context exists for commands that need it
    case parsed.subcommand do
      :help ->
        {:ok, [{:message, help()}]}

      :list ->
        handle_list()

      _ when is_nil(actor) or is_nil(actor_id) ->
        {:error, "No player context available."}

      :create ->
        handle_create(actor, parsed.name)

      :join ->
        handle_join(actor, parsed.name)

      :leave ->
        handle_leave(actor)

      :info ->
        handle_info(actor, parsed.name)

      :donate ->
        handle_donate(actor, parsed.amount)
    end
  end

  # =============================================================================
  # Subcommand Parsing
  # =============================================================================

  defp parse_subcommand([]), do: :help
  defp parse_subcommand([""]), do: :help
  defp parse_subcommand(["help" | _]), do: :help

  defp parse_subcommand(["create" | rest]) when length(rest) > 0 do
    {:create, Enum.join(rest, " ")}
  end

  defp parse_subcommand(["create"]), do: {:error, "Usage: guild create <name>"}

  defp parse_subcommand(["join" | rest]) when length(rest) > 0 do
    {:join, Enum.join(rest, " ")}
  end

  defp parse_subcommand(["join"]), do: {:error, "Usage: guild join <name>"}

  defp parse_subcommand(["leave" | _]), do: :leave

  defp parse_subcommand(["info"]), do: {:info, nil}

  defp parse_subcommand(["info" | rest]) when length(rest) > 0 do
    {:info, Enum.join(rest, " ")}
  end

  defp parse_subcommand(["donate", amount_str | _]) do
    case Integer.parse(amount_str) do
      {amount, ""} when amount > 0 -> {:donate, amount}
      _ -> {:error, "Invalid amount. Usage: guild donate <amount>"}
    end
  end

  defp parse_subcommand(["donate"]), do: {:error, "Usage: guild donate <amount>"}

  defp parse_subcommand(["list" | _]), do: :list

  defp parse_subcommand([unknown | _]) do
    {:error, "Unknown subcommand: #{unknown}. Type 'guild help' for usage."}
  end

  # =============================================================================
  # Command Handlers
  # =============================================================================

  defp handle_create(entity, name) do
    case Guilds.create(entity, name) do
      {:ok, guild} ->
        {:ok, [{:message, "You have founded the guild '#{guild.name}'!"}]}

      {:error, :already_in_guild} ->
        {:error, "You must leave your current guild first."}

      {:error, :already_exists} ->
        {:error, "A guild with that name already exists."}

      {:error, :name_too_short} ->
        {:error, "Guild name must be at least 3 characters."}

      {:error, :name_too_long} ->
        {:error, "Guild name must be at most 24 characters."}

      {:error, :invalid_characters} ->
        {:error, "Guild name can only contain letters, numbers, and spaces."}

      {:error, :insufficient_funds} ->
        {:error, "You don't have enough gold to create a guild."}

      {:error, reason} ->
        {:error, "Failed to create guild: #{inspect(reason)}"}
    end
  end

  defp handle_join(entity, name) do
    case Guilds.join(entity, name) do
      {:ok, guild} ->
        {:ok, [{:message, "You have joined '#{guild.name}'!"}]}

      {:error, :already_in_guild} ->
        {:error, "You must leave your current guild first."}

      {:error, :not_found} ->
        {:error, "No guild found with that name."}

      {:error, :guild_full} ->
        {:error, "That guild is full."}

      {:error, :already_member} ->
        {:error, "You are already a member of that guild."}

      {:error, reason} ->
        {:error, "Failed to join guild: #{inspect(reason)}"}
    end
  end

  defp handle_leave(entity) do
    case Guilds.leave(entity) do
      :ok ->
        {:ok, [{:message, "You have left your guild."}]}

      {:error, :not_in_guild} ->
        {:error, "You are not in a guild."}

      {:error, reason} ->
        {:error, "Failed to leave guild: #{inspect(reason)}"}
    end
  end

  defp handle_info(entity, nil) do
    case Guilds.info(entity) do
      {:ok, guild} ->
        {:ok, [{:message, format_guild_info(guild)}]}

      {:error, :not_in_guild} ->
        {:error, "You are not in a guild. Use 'guild info <name>' to view another guild."}

      {:error, :not_found} ->
        {:error, "You are not in a guild."}
    end
  end

  defp handle_info(_entity, name) do
    case Guilds.info(name) do
      {:ok, guild} ->
        {:ok, [{:message, format_guild_info(guild)}]}

      {:error, :not_found} ->
        {:error, "No guild found with that name."}
    end
  end

  defp handle_donate(entity, amount) do
    case Guilds.donate(entity, amount) do
      {:ok, guild} ->
        {:ok,
         [{:message, "You donated #{amount} gold to #{guild.name}. Treasury: #{guild.treasury}"}]}

      {:error, :not_in_guild} ->
        {:error, "You must be in a guild to donate."}

      {:error, :not_found} ->
        {:error, "You are not in a guild."}

      {:error, :insufficient_funds} ->
        {:error, "You don't have enough gold."}

      {:error, :invalid_amount} ->
        {:error, "Invalid donation amount."}

      {:error, reason} ->
        {:error, "Failed to donate: #{inspect(reason)}"}
    end
  end

  defp handle_list do
    guilds = Loka.Plugins.Guilds.GuildRegistry.list_guilds()

    if Enum.empty?(guilds) do
      {:ok, [{:message, "No guilds exist yet. Be the first to create one!"}]}
    else
      lines =
        guilds
        |> Enum.sort_by(& &1.level, :desc)
        |> Enum.map(fn g ->
          "  #{g.name} (Level #{g.level}) - #{length(g.members)} members"
        end)

      message = ["Guilds:" | lines] |> Enum.join("\n")
      {:ok, [{:message, message}]}
    end
  end

  # =============================================================================
  # Formatting
  # =============================================================================

  defp format_guild_info(guild) do
    """
    === #{guild.name} ===
    Level: #{guild.level}
    XP: #{guild.xp}
    Treasury: #{guild.treasury} gold
    Members: #{length(guild.members)}
    Founded: #{format_date(guild.created_at)}
    """
    |> String.trim()
  end

  defp format_date(%DateTime{} = dt) do
    Calendar.strftime(dt, "%Y-%m-%d")
  end

  defp format_date(_), do: "Unknown"
end
