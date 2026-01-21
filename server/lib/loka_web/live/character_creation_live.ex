defmodule LokaWeb.CharacterCreationLive do
  @moduledoc """
  LiveView for character creation.

  Shown to new players after they confirm their account via magic link.
  Collects character name, gender, background, and Spark personality traits
  before allowing game access.
  """
  use LokaWeb, :live_view

  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.Spark

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
      spark_traits = Spark.trait_options()

      {:ok,
       socket
       |> assign(:game_state, game_state)
       |> assign(:changeset, changeset)
       |> assign(:backgrounds, backgrounds)
       |> assign(:selected_background, nil)
       |> assign(:spark_traits, spark_traits)
       |> assign(:selected_traits, [])
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

          <div class="ebook-form-group">
            <label class="ebook-label">
              Choose two traits for your Spark companion
              <span class="ebook-label-hint">(Select exactly 2)</span>
            </label>
            <p class="ebook-prose ebook-prose--small">
              A fragment of ancient light has chosen to accompany you. Its personality will emerge from the traits you sense in it.
            </p>
            <div class="ebook-trait-options">
              <label
                :for={trait <- @spark_traits}
                class={"ebook-trait-option #{if trait.id in @selected_traits, do: "ebook-trait-option--selected"} #{if length(@selected_traits) >= 2 and trait.id not in @selected_traits, do: "ebook-trait-option--disabled"}"}
              >
                <input
                  type="checkbox"
                  name="spark_traits[]"
                  value={trait.id}
                  checked={trait.id in @selected_traits}
                  disabled={length(@selected_traits) >= 2 and trait.id not in @selected_traits}
                  phx-click="toggle_trait"
                  phx-value-trait={trait.id}
                  class="ebook-trait-checkbox"
                />
                <span class="ebook-trait-name">{trait.name}</span>
                <span class="ebook-trait-desc">{trait.description}</span>
              </label>
            </div>
            <%= if length(@selected_traits) != 2 do %>
              <p class="ebook-field-error">Please select exactly 2 traits</p>
            <% end %>
          </div>

          <button
            type="submit"
            class="ebook-submit ebook-submit--center"
            disabled={length(@selected_traits) != 2}
          >
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
  def handle_event("toggle_trait", %{"trait" => trait}, socket) do
    selected = socket.assigns.selected_traits

    new_selected =
      if trait in selected do
        List.delete(selected, trait)
      else
        if length(selected) < 2 do
          [trait | selected]
        else
          selected
        end
      end

    {:noreply, assign(socket, :selected_traits, new_selected)}
  end

  @impl true
  def handle_event("create", %{"game_state" => params}, socket) do
    game_state = socket.assigns.game_state
    player = socket.assigns.current_scope.player
    selected_traits = socket.assigns.selected_traits

    # Validate trait selection
    if length(selected_traits) != 2 do
      {:noreply,
       socket
       |> put_flash(:error, "Please select exactly 2 Spark traits")}
    else
      changeset = PlayerGameState.character_creation_changeset(game_state, params)

      case Loka.Repo.update(changeset) do
        {:ok, _updated_state} ->
          # Create the Spark for this player
          case Spark.create_for_player(player.id, selected_traits) do
            {:ok, _spark} ->
              redirect_path = if player.is_admin, do: ~p"/admin/play", else: ~p"/players/log-in"
              {:noreply, push_navigate(socket, to: redirect_path)}

            {:error, _spark_changeset} ->
              # Log but don't block - Spark can be created later if needed
              require Logger
              Logger.warning("Failed to create Spark for player #{player.id}")
              redirect_path = if player.is_admin, do: ~p"/admin/play", else: ~p"/players/log-in"
              {:noreply, push_navigate(socket, to: redirect_path)}
          end

        {:error, changeset} ->
          {:noreply,
           socket
           |> assign(:changeset, changeset)
           |> assign(:form, to_form(changeset))}
      end
    end
  end
end
