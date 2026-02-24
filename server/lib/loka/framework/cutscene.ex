defmodule Loka.Framework.Cutscene do
  @moduledoc """
  Minimal cutscene player.

  Loads a cutscene definition and schedules timed messages to a channel process.
  Each line arrives as `{:cutscene_line, text, class}` at the accumulated delay,
  followed by `:cutscene_end` after the final line.
  """

  alias Loka.Content

  @doc """
  Plays a cutscene by scheduling delayed messages to the given process.

  Lines are sent as `{:cutscene_line, text, class}` messages.
  A final `:cutscene_end` message is sent after all lines.
  """
  @spec play(pid(), String.t()) :: :ok | {:error, :not_found}
  def play(target_pid, cutscene_key) when is_pid(target_pid) and is_binary(cutscene_key) do
    case Content.Cutscene.get(cutscene_key) do
      {:ok, cutscene} ->
        lines = Content.Cutscene.sequence(cutscene)
        schedule_lines(target_pid, lines)

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  defp schedule_lines(target_pid, lines) do
    total_delay =
      Enum.reduce(lines, 0, fn line, acc ->
        delay = line["delay"] || 1000
        accumulated = acc + delay
        text = line["text"] || ""
        class = line["class"] || "cutscene"

        Process.send_after(target_pid, {:cutscene_line, text, class}, accumulated)
        accumulated
      end)

    # Send end marker after final line + small buffer
    Process.send_after(target_pid, :cutscene_end, total_delay + 500)
    :ok
  end
end
