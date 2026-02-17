defmodule LokaWeb.Channels.BuilderCommands.Economy do
  @moduledoc """
  Builder commands for the economy system.

  ## Commands

  - `economy status` — Show money supply and daily summary
  - `economy grant <player_key> <amount> [source]` — Mint gold to a player
  - `economy charge <player_key> <amount> [sink]` — Burn gold from a player
  - `economy history [days]` — Show daily summaries
  - `economy balance <player_key>` — Check a player's gold
  """

  require Logger

  alias Loka.Engine.Entities
  alias Loka.Framework.Economy

  @known_sources ~w(admin_grant quest_reward mob_kill vendor_sell gathering login_bonus script)a
  @known_sinks ~w(admin_charge shop_buy repair fast_travel crafting_fee tax death_penalty script)a

  def execute(:economy, params, socket) do
    args = String.split(params, ~r/\s+/, trim: true)

    case args do
      ["status" | _] -> economy_status(socket)
      ["grant", player_key, amount | rest] -> economy_grant(player_key, amount, rest, socket)
      ["charge", player_key, amount | rest] -> economy_charge(player_key, amount, rest, socket)
      ["balance", player_key | _] -> economy_balance(player_key, socket)
      ["history" | rest] -> economy_history(rest, socket)
      _ -> {:error, usage(), socket}
    end
  end

  defp economy_status(socket) do
    supply = Economy.money_supply()
    summary = Economy.daily_summary()

    faucet_lines =
      summary.faucets
      |> Enum.map(fn {cat, total} -> "  #{cat}: #{total}g" end)
      |> Enum.join("\n")

    sink_lines =
      summary.sinks
      |> Enum.map(fn {cat, total} -> "  #{cat}: #{total}g" end)
      |> Enum.join("\n")

    text = """
    [Economy Status]
    Money Supply: #{supply}g
    Today's Net Flow: #{if summary.net_flow >= 0, do: "+", else: ""}#{summary.net_flow}g
    Minted Today: #{summary.total_minted}g
    Burned Today: #{summary.total_burned}g
    #{if faucet_lines != "", do: "\nFaucets:\n#{faucet_lines}", else: ""}
    #{if sink_lines != "", do: "\nSinks:\n#{sink_lines}", else: ""}
    """

    {:ok, String.trim(text), socket}
  end

  defp economy_grant(player_key, amount_str, rest, socket) do
    source = List.first(rest) || "admin_grant"

    with {amount, _} <- Integer.parse(amount_str),
         true <- amount > 0,
         {:ok, entity} <- find_player(player_key) do
      case Economy.mint(entity.id, amount, validated_atom(source, @known_sources), %{
             via: :builder
           }) do
        {:ok, result} ->
          {:ok, "Granted #{amount}g to #{player_key}. Balance: #{result.balance}g", socket}

        {:error, reason} ->
          {:error, "Failed: #{inspect(reason)}", socket}
      end
    else
      :error -> {:error, "Invalid amount: #{amount_str}", socket}
      false -> {:error, "Amount must be positive", socket}
      {:error, :not_found} -> {:error, "Player '#{player_key}' not found", socket}
    end
  end

  defp economy_charge(player_key, amount_str, rest, socket) do
    sink = List.first(rest) || "admin_charge"

    with {amount, _} <- Integer.parse(amount_str),
         true <- amount > 0,
         {:ok, entity} <- find_player(player_key) do
      case Economy.burn(entity.id, amount, validated_atom(sink, @known_sinks), %{via: :builder}) do
        {:ok, result} ->
          {:ok, "Charged #{amount}g from #{player_key}. Balance: #{result.balance}g", socket}

        {:error, :insufficient_funds} ->
          {:error, "#{player_key} doesn't have enough gold", socket}

        {:error, reason} ->
          {:error, "Failed: #{inspect(reason)}", socket}
      end
    else
      :error -> {:error, "Invalid amount: #{amount_str}", socket}
      false -> {:error, "Amount must be positive", socket}
      {:error, :not_found} -> {:error, "Player '#{player_key}' not found", socket}
    end
  end

  defp economy_balance(player_key, socket) do
    case find_player(player_key) do
      {:ok, entity} ->
        balance = Economy.balance(entity.id)
        {:ok, "#{player_key}: #{balance}g", socket}

      {:error, :not_found} ->
        {:error, "Player '#{player_key}' not found", socket}
    end
  end

  defp economy_history(args, socket) do
    days =
      case args do
        [n | _] ->
          case Integer.parse(n) do
            {val, _} when val > 0 -> min(val, 365)
            _ -> 7
          end

        _ ->
          7
      end

    lines =
      for offset <- 0..(days - 1) do
        date = Date.add(Date.utc_today(), -offset)
        summary = Economy.EconomyLog.daily_summary(date)

        "#{date}: +#{summary.total_minted}g / -#{summary.total_burned}g (net: #{summary.net_flow}g)"
      end

    text = "[Economy History — Last #{days} days]\n" <> Enum.join(lines, "\n")
    {:ok, text, socket}
  end

  defp find_player(key) do
    case Entities.find_one(key: key, type: :character) do
      {:ok, entity} -> {:ok, entity}
      _ -> {:error, :not_found}
    end
  end

  defp validated_atom(str, allowlist) do
    atom = String.to_existing_atom(str)
    if atom in allowlist, do: atom, else: hd(allowlist)
  rescue
    ArgumentError -> hd(allowlist)
  end

  defp usage do
    """
    Usage:
      economy status                     — Money supply & daily summary
      economy grant <player> <amount> [source] — Mint gold
      economy charge <player> <amount> [sink]  — Burn gold
      economy balance <player>           — Check balance
      economy history [days]             — Daily summaries
    """
    |> String.trim()
  end
end
