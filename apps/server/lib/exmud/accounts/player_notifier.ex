defmodule Exmud.Accounts.PlayerNotifier do
  import Swoosh.Email
  require Logger

  alias Exmud.Mailer
  alias Exmud.Accounts.Player

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body) do
    from_config = Application.get_env(:exmud, :mailer_from, [])
    from_name = Keyword.get(from_config, :name, "ExMUD")
    from_email = Keyword.get(from_config, :email, "noreply@example.com")
    mailer_config = Application.get_env(:exmud, Exmud.Mailer, [])

    Logger.info(
      "[PlayerNotifier] Attempting to send email: to=#{recipient}, subject=#{subject}, from=#{from_email}, adapter=#{inspect(Keyword.get(mailer_config, :adapter))}"
    )

    email =
      new()
      |> to(recipient)
      |> from({from_name, from_email})
      |> subject(subject)
      |> text_body(body)

    case Mailer.deliver(email) do
      {:ok, metadata} ->
        Logger.info("[PlayerNotifier] Email sent successfully: #{inspect(metadata)}")
        {:ok, email}

      {:error, reason} ->
        Logger.error("[PlayerNotifier] Failed to send email: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Deliver instructions to update a player email.
  """
  def deliver_update_email_instructions(player, url) do
    deliver(player.email, "Update email instructions", """

    ==============================

    Hi #{player.email},

    You can change your email by visiting the URL below:

    #{url}

    If you didn't request this change, please ignore this.

    ==============================
    """)
  end

  @doc """
  Deliver instructions to log in with a magic link.
  """
  def deliver_login_instructions(player, url) do
    Logger.warning("[PlayerNotifier] deliver_login_instructions called for #{player.email}")

    case player do
      %Player{confirmed_at: nil} ->
        Logger.warning("[PlayerNotifier] Player not confirmed, sending confirmation email")
        deliver_confirmation_instructions(player, url)

      _ ->
        Logger.warning("[PlayerNotifier] Player confirmed, sending magic link email")
        deliver_magic_link_instructions(player, url)
    end
  end

  defp deliver_magic_link_instructions(player, url) do
    deliver(player.email, "Log in instructions", """

    ==============================

    Hi #{player.email},

    You can log into your account by visiting the URL below:

    #{url}

    If you didn't request this email, please ignore this.

    ==============================
    """)
  end

  defp deliver_confirmation_instructions(player, url) do
    deliver(player.email, "Confirmation instructions", """

    ==============================

    Hi #{player.email},

    You can confirm your account by visiting the URL below:

    #{url}

    If you didn't create an account with us, please ignore this.

    ==============================
    """)
  end
end
