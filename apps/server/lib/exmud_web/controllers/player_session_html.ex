defmodule ExmudWeb.PlayerSessionHTML do
  use ExmudWeb, :html

  embed_templates "player_session_html/*"

  defp local_mail_adapter? do
    Application.get_env(:exmud, Exmud.Mailer)[:adapter] == Swoosh.Adapters.Local
  end
end
