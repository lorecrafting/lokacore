defmodule LokaWeb.CharacterCreationLive do
  @moduledoc """
  LiveView for character creation.

  Shown to new players after they confirm their account via magic link.
  Collects character name, gender, and background before allowing game access.
  """
  use LokaWeb, :live_view

  alias Loka.Framework.Player.GameState, as: PlayerGameState

  @impl true
  def mount(_params, _session, socket) do
    player = socket.assigns.current_scope.player

    # Get or create game state
    {:ok, game_state} = PlayerGameState.get_or_create_state(player.id)

    # If character already created, redirect (admins to /admin/play, others to login)
    if PlayerGameState.character_created?(game_state) do
      redirect_path = if player.is_admin, do: ~p"/admin/play", else: ~p"/players/log-in"
      {:ok, push_navigate(socket, to: redirect_path)}
    else
      changeset = PlayerGameState.character_creation_changeset(game_state, %{})
      backgrounds = PlayerGameState.available_backgrounds()

      {:ok,
       socket
       |> assign(:game_state, game_state)
       |> assign(:changeset, changeset)
       |> assign(:backgrounds, backgrounds)
       |> assign(:selected_background, nil)
       |> assign(:form, to_form(changeset))}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="ebook-page">
      <div class="ebook-auth ebook-auth--wide">
        <h1 class="ebook-auth-title">Create Your Character</h1>

        <p class="ebook-prose ebook-auth-intro">
          Before you begin your journey, tell us about yourself.
        </p>

        <.form for={@form} phx-change="validate" phx-submit="create" class="ebook-char-form">
          <div class="ebook-form-group">
            <label class="ebook-label">What is your name?</label>
            <input
              type="text"
              name={@form[:character_name].name}
              value={@form[:character_name].value}
              class="ebook-input"
              placeholder="Enter your name"
              autocomplete="off"
              phx-debounce="300"
            />
            <.field_error field={@form[:character_name]} />
          </div>

          <div class="ebook-form-group">
            <label class="ebook-label">How shall others address you?</label>
            <div class="ebook-radio-group">
              <label class="ebook-radio-option">
                <input
                  type="radio"
                  name={@form[:gender].name}
                  value="he/him"
                  checked={@form[:gender].value == "he/him"}
                />
                <span class="ebook-radio-label">He / Him</span>
              </label>
              <label class="ebook-radio-option">
                <input
                  type="radio"
                  name={@form[:gender].name}
                  value="she/her"
                  checked={@form[:gender].value == "she/her"}
                />
                <span class="ebook-radio-label">She / Her</span>
              </label>
              <label class="ebook-radio-option">
                <input
                  type="radio"
                  name={@form[:gender].name}
                  value="they/them"
                  checked={@form[:gender].value == "they/them"}
                />
                <span class="ebook-radio-label">They / Them</span>
              </label>
            </div>
            <.field_error field={@form[:gender]} />
          </div>

          <div class="ebook-form-group">
            <label class="ebook-label">What is your background?</label>
            <div class="ebook-background-options">
              <label
                :for={bg <- @backgrounds}
                class={"ebook-background-option #{if @selected_background == bg.id, do: "ebook-background-option--selected"}"}
              >
                <input
                  type="radio"
                  name={@form[:background].name}
                  value={bg.id}
                  checked={@form[:background].value == bg.id}
                  class="ebook-background-radio"
                />
                <span class="ebook-background-name">{bg.name}</span>
                <span class="ebook-background-desc">{bg.description}</span>
                <span class="ebook-background-bonus">{bg.bonus}</span>
              </label>
            </div>
            <.field_error field={@form[:background]} />
          </div>

          <button type="submit" class="ebook-submit ebook-submit--center">
            Begin Your Journey
          </button>
        </.form>
      </div>
    </div>
    """
  end

  defp field_error(assigns) do
    errors =
      case assigns.field do
        %Phoenix.HTML.FormField{errors: errors} -> errors
        _ -> []
      end

    assigns = assign(assigns, :errors, errors)

    ~H"""
    <p :for={{msg, _opts} <- @errors} class="ebook-field-error">
      {msg}
    </p>
    """
  end

  @impl true
  def handle_event("validate", %{"game_state" => params}, socket) do
    changeset =
      socket.assigns.game_state
      |> PlayerGameState.character_creation_changeset(params)
      |> Map.put(:action, :validate)

    selected_background = params["background"]

    {:noreply,
     socket
     |> assign(:changeset, changeset)
     |> assign(:selected_background, selected_background)
     |> assign(:form, to_form(changeset))}
  end

  @impl true
  def handle_event("create", %{"game_state" => params}, socket) do
    game_state = socket.assigns.game_state

    changeset = PlayerGameState.character_creation_changeset(game_state, params)

    case Loka.Repo.update(changeset) do
      {:ok, _updated_state} ->
        player = socket.assigns.current_scope.player
        redirect_path = if player.is_admin, do: ~p"/admin/play", else: ~p"/players/log-in"
        {:noreply, push_navigate(socket, to: redirect_path)}

      {:error, changeset} ->
        {:noreply,
         socket
         |> assign(:changeset, changeset)
         |> assign(:form, to_form(changeset))}
    end
  end
end
