defmodule LokaWeb.PlayerSessionHTML do
  use LokaWeb, :html

  embed_templates "player_session_html/*"

  defp local_mail_adapter? do
    Application.get_env(:loka, Loka.Mailer)[:adapter] == Swoosh.Adapters.Local
  end
end
