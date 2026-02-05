defmodule LokaWeb.AdminLive.WorldBuilder.CutsceneEditor do
  @moduledoc """
  Pure LiveView cutscene editor component.

  Renders a stacked form for creating/editing cutscenes with:
  - Cutscene identity (id, name)
  - Trigger configuration (type, location, condition)
  - Sequence steps (add/remove/reorder)
  - Effects (add/remove/edit)
  - Real-time validation
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  @trigger_types [
    {"enter_room", "Enter Room"},
    {"talk_to", "Talk To"},
    {"meditate", "Meditate"},
    {"use_item", "Use Item"},
    {"quest_complete", "Quest Complete"},
    {"kill", "Kill Enemy"},
    {"enemy_defeated", "Enemy Defeated"}
  ]

  @step_types [
    {"dialogue", "Dialogue", "#4a9eff"},
    {"narration", "Narration", "#ff9a4a"},
    {"fade_out", "Fade Out", "#9a4aff"},
    {"fade_in", "Fade In", "#9a4aff"},
    {"pause", "Pause", "#6b7280"},
    {"choice", "Choice", "#ffd24a"},
    {"sound", "Sound", "#4aff9a"},
    {"music", "Music", "#4aff9a"},
    {"animation", "Animation", "#ff4a9a"},
    {"spawn_enemy", "Spawn Enemy", "#ff4a4a"},
    {"apply_status", "Apply Status", "#9aff4a"},
    {"trigger_ending", "Trigger Ending", "#ffff4a"}
  ]

  @effect_types [
    {"set_flag", "Set Flag"},
    {"clear_flag", "Clear Flag"},
    {"add_insight", "Add Insight"},
    {"give_item", "Give Item"},
    {"take_item", "Take Item"},
    {"give_xp", "Give XP"},
    {"give_gold", "Give Gold"},
    {"teleport", "Teleport"},
    {"start_quest", "Start Quest"},
    {"complete_quest", "Complete Quest"},
    {"heal", "Heal"},
    {"damage", "Damage"},
    {"add_status", "Add Status"},
    {"start_combat", "Start Combat"}
  ]

  attr :cutscene_data, :map, required: true

  def cutscene_editor(assigns) do
    validation = validate(assigns.cutscene_data)

    assigns =
      assigns
      |> assign(:validation, validation)
      |> assign(:trigger_types, @trigger_types)
      |> assign(:step_types, @step_types)
      |> assign(:effect_types, @effect_types)

    ~H"""
    <div class="cutscene-editor-lv">
      <%!-- Validation banner --%>
      <div class={[
        "quest-validation-banner",
        @validation.errors == [] && "valid"
      ]}>
        <span :if={@validation.errors == []} class="contents">
          <.icon name="hero-check-circle" class="size-4" />
          <span>Valid cutscene</span>
        </span>
        <span :if={@validation.errors != []} class="contents">
          <.icon name="hero-exclamation-triangle" class="size-4" />
          <span>{length(@validation.errors)} error(s)</span>
        </span>
      </div>

      <div class="quest-editor-scroll">
        <%!-- Cutscene Identity Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-film" class="size-4" />
            <span>Cutscene Identity</span>
          </div>
          <div class="quest-form-grid">
            <div class="quest-form-row-pair">
              <div class="quest-form-row">
                <label>ID</label>
                <input
                  type="text"
                  value={@cutscene_data.id}
                  phx-blur="cutscene_update_field"
                  phx-value-field="id"
                  name="value"
                  placeholder="cutscene_id"
                  class="quest-input"
                  phx-debounce="300"
                />
              </div>
              <div class="quest-form-row">
                <label>Name</label>
                <input
                  type="text"
                  value={@cutscene_data.name}
                  phx-blur="cutscene_update_field"
                  phx-value-field="name"
                  name="value"
                  placeholder="Display Name"
                  class="quest-input"
                  phx-debounce="300"
                />
              </div>
            </div>
          </div>
        </div>

        <%!-- Trigger Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-bolt" class="size-4" />
            <span>Trigger</span>
          </div>
          <div class="quest-form-grid">
            <div class="quest-form-row">
              <label>Type</label>
              <select
                phx-change="cutscene_update_trigger"
                phx-value-field="type"
                name="value"
                class="quest-input"
              >
                <%= for {val, label} <- @trigger_types do %>
                  <option value={val} selected={@cutscene_data.trigger.type == val}>
                    {label}
                  </option>
                <% end %>
              </select>
            </div>
            <div class="quest-form-row">
              <label>Location / Target</label>
              <input
                type="text"
                value={@cutscene_data.trigger.location}
                phx-blur="cutscene_update_trigger"
                phx-value-field="location"
                name="value"
                placeholder="room_key or npc_key"
                class="quest-input"
                phx-debounce="300"
              />
            </div>
            <div class="quest-form-row">
              <label>Condition</label>
              <input
                type="text"
                value={@cutscene_data.trigger.condition}
                phx-blur="cutscene_update_trigger"
                phx-value-field="condition"
                name="value"
                placeholder="!player.has_flag('seen_cutscene')"
                class="quest-input"
                phx-debounce="300"
              />
            </div>
          </div>
        </div>

        <%!-- Sequence Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-queue-list" class="size-4" />
            <span>Sequence</span>
            <div class="flex-1"></div>
            <select
              id="cutscene-step-type-select"
              phx-change="cutscene_add_step"
              name="step_type"
              class="quest-input-sm w-auto"
            >
              <option value="">+ Add Step</option>
              <%= for {val, label, color} <- @step_types do %>
                <option value={val} style={"border-left: 3px solid #{color}"}>
                  {label}
                </option>
              <% end %>
            </select>
          </div>
          <div :if={@cutscene_data.sequence == []} class="quest-empty">
            No steps yet. Add one to build your cutscene.
          </div>
          <%= for {step, idx} <- Enum.with_index(@cutscene_data.sequence) do %>
            <% step_color = step_color(step.type, @step_types) %>
            <div class="quest-list-item" style={"border-left: 3px solid #{step_color}"}>
              <div class="quest-list-item-header">
                <span class="quest-list-item-num">{idx + 1}</span>
                <select
                  phx-change="cutscene_update_step"
                  phx-value-idx={idx}
                  phx-value-field="type"
                  name="value"
                  class="quest-input-sm"
                >
                  <%= for {val, label, _color} <- @step_types do %>
                    <option value={val} selected={step.type == val}>{label}</option>
                  <% end %>
                </select>
                <div class="flex-1"></div>
                <button
                  class="quest-remove-btn"
                  phx-click="cutscene_move_step_up"
                  phx-value-idx={idx}
                  title="Move up"
                  disabled={idx == 0}
                >
                  <.icon name="hero-chevron-up" class="size-3" />
                </button>
                <button
                  class="quest-remove-btn"
                  phx-click="cutscene_move_step_down"
                  phx-value-idx={idx}
                  title="Move down"
                  disabled={idx == length(@cutscene_data.sequence) - 1}
                >
                  <.icon name="hero-chevron-down" class="size-3" />
                </button>
                <button
                  class="quest-remove-btn"
                  phx-click="cutscene_remove_step"
                  phx-value-idx={idx}
                  title="Remove"
                >
                  <.icon name="hero-x-mark" class="size-3" />
                </button>
              </div>
              <div class="quest-list-item-body">
                <div :if={step.type == "dialogue"} class="quest-form-row-inline">
                  <label>Speaker</label>
                  <input
                    type="text"
                    value={step[:speaker] || ""}
                    phx-blur="cutscene_update_step"
                    phx-value-idx={idx}
                    phx-value-field="speaker"
                    name="value"
                    placeholder="npc_key or narrator"
                    class="quest-input-sm"
                    phx-debounce="300"
                  />
                </div>
                <div :if={step.type in ["dialogue", "narration"]} class="quest-form-row-inline">
                  <label>Text</label>
                  <textarea
                    phx-blur="cutscene_update_step"
                    phx-value-idx={idx}
                    phx-value-field="text"
                    name="value"
                    placeholder="Enter text..."
                    class="quest-input-sm"
                    rows="2"
                    phx-debounce="300"
                  >{step[:text] || ""}</textarea>
                </div>

                <div :if={step.type in ["fade_out", "fade_in", "pause"]} class="quest-form-row-inline">
                  <label>Duration (s)</label>
                  <input
                    type="number"
                    value={step[:duration] || 1}
                    phx-blur="cutscene_update_step"
                    phx-value-idx={idx}
                    phx-value-field="duration"
                    name="value"
                    min="0.1"
                    step="0.1"
                    class="quest-input-sm w-[80px]"
                    phx-debounce="300"
                  />
                </div>

                <div :if={step.type in ["sound", "music"]} class="quest-form-row-inline">
                  <label>{if step.type == "music", do: "Track", else: "Audio"}</label>
                  <input
                    type="text"
                    value={step[:audio] || step[:track] || ""}
                    phx-blur="cutscene_update_step"
                    phx-value-idx={idx}
                    phx-value-field={if step.type == "music", do: "track", else: "audio"}
                    name="value"
                    placeholder="audio_file_key"
                    class="quest-input-sm"
                    phx-debounce="300"
                  />
                </div>

                <div :if={step.type == "choice"} class="quest-form-row-inline">
                  <label>Prompt</label>
                  <input
                    type="text"
                    value={step[:prompt] || ""}
                    phx-blur="cutscene_update_step"
                    phx-value-idx={idx}
                    phx-value-field="prompt"
                    name="value"
                    placeholder="What will you do?"
                    class="quest-input-sm"
                    phx-debounce="300"
                  />
                </div>

                <div :if={step.type == "spawn_enemy"} class="quest-form-row-inline">
                  <label>Enemy Key</label>
                  <input
                    type="text"
                    value={step[:enemy] || ""}
                    phx-blur="cutscene_update_step"
                    phx-value-idx={idx}
                    phx-value-field="enemy"
                    name="value"
                    placeholder="enemy_npc_key"
                    class="quest-input-sm"
                    phx-debounce="300"
                  />
                </div>

                <div :if={step.type == "apply_status"} class="contents">
                  <div class="quest-form-row-inline">
                    <label>Status</label>
                    <input
                      type="text"
                      value={step[:status] || ""}
                      phx-blur="cutscene_update_step"
                      phx-value-idx={idx}
                      phx-value-field="status"
                      name="value"
                      placeholder="status_key"
                      class="quest-input-sm"
                      phx-debounce="300"
                    />
                  </div>
                  <div class="quest-form-row-inline">
                    <label>Duration (s)</label>
                    <input
                      type="number"
                      value={step[:duration] || 10}
                      phx-blur="cutscene_update_step"
                      phx-value-idx={idx}
                      phx-value-field="duration"
                      name="value"
                      min="1"
                      class="quest-input-sm w-[80px]"
                      phx-debounce="300"
                    />
                  </div>
                </div>

                <div :if={step.type == "trigger_ending"} class="quest-form-row-inline">
                  <label>Ending ID</label>
                  <input
                    type="text"
                    value={step[:ending] || ""}
                    phx-blur="cutscene_update_step"
                    phx-value-idx={idx}
                    phx-value-field="ending"
                    name="value"
                    placeholder="ending_id"
                    class="quest-input-sm"
                    phx-debounce="300"
                  />
                </div>
              </div>
            </div>
          <% end %>
        </div>

        <%!-- Effects Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-sparkles" class="size-4" />
            <span>Effects (Applied on Complete)</span>
            <div class="flex-1"></div>
            <button class="quest-add-btn" phx-click="cutscene_add_effect" title="Add effect">
              <.icon name="hero-plus" class="size-3" /> Add
            </button>
          </div>
          <div :if={@cutscene_data.effects == []} class="quest-empty">
            No effects. Cutscene won't change game state.
          </div>
          <%= for {effect, idx} <- Enum.with_index(@cutscene_data.effects) do %>
            <div class="quest-list-item-compact">
              <select
                phx-change="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="type"
                name="value"
                class="quest-input-sm"
              >
                <%= for {val, label} <- @effect_types do %>
                  <option value={val} selected={effect.type == val}>{label}</option>
                <% end %>
              </select>

              <input
                :if={effect.type in ["set_flag", "clear_flag"]}
                type="text"
                value={effect[:flag] || ""}
                phx-blur="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="flag"
                name="value"
                placeholder="flag_name"
                class="quest-input-sm flex-1"
                phx-debounce="300"
              />

              <input
                :if={effect.type in ["give_item", "take_item"]}
                type="text"
                value={effect[:item] || ""}
                phx-blur="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="item"
                name="value"
                placeholder="item_key"
                class="quest-input-sm flex-1"
                phx-debounce="300"
              />

              <input
                :if={effect.type in ["add_insight", "give_xp", "give_gold", "heal", "damage"]}
                type="number"
                value={effect[:amount] || 1}
                phx-blur="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="amount"
                name="value"
                placeholder="amount"
                class="quest-input-sm w-[80px]"
                phx-debounce="300"
              />

              <input
                :if={effect.type == "teleport"}
                type="text"
                value={effect[:location] || ""}
                phx-blur="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="location"
                name="value"
                placeholder="room_key"
                class="quest-input-sm flex-1"
                phx-debounce="300"
              />

              <input
                :if={effect.type in ["start_quest", "complete_quest"]}
                type="text"
                value={effect[:quest_key] || ""}
                phx-blur="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="quest_key"
                name="value"
                placeholder="quest_key"
                class="quest-input-sm flex-1"
                phx-debounce="300"
              />

              <input
                :if={effect.type == "add_status"}
                type="text"
                value={effect[:status] || ""}
                phx-blur="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="status"
                name="value"
                placeholder="status_key"
                class="quest-input-sm flex-1"
                phx-debounce="300"
              />

              <input
                :if={effect.type == "start_combat"}
                type="text"
                value={effect[:enemy] || ""}
                phx-blur="cutscene_update_effect"
                phx-value-idx={idx}
                phx-value-field="enemy"
                name="value"
                placeholder="enemy_key"
                class="quest-input-sm flex-1"
                phx-debounce="300"
              />

              <button
                class="quest-remove-btn"
                phx-click="cutscene_remove_effect"
                phx-value-idx={idx}
                title="Remove"
              >
                <.icon name="hero-x-mark" class="size-3" />
              </button>
            </div>
          <% end %>
        </div>

        <%!-- Validation Details --%>
        <div :if={@validation.errors != [] or @validation.warnings != []} class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-shield-check" class="size-4" />
            <span>Validation</span>
          </div>
          <%= for err <- @validation.errors do %>
            <div class="quest-validation-error">
              <.icon name="hero-x-circle" class="size-3" /> {err}
            </div>
          <% end %>
          <%= for warn <- @validation.warnings do %>
            <div class="quest-validation-warning">
              <.icon name="hero-exclamation-triangle" class="size-3" /> {warn}
            </div>
          <% end %>
        </div>
      </div>

      <%!-- Footer with save/cancel --%>
      <div class="quest-editor-footer">
        <button
          class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
          phx-click="close_cutscene_editor"
        >
          Cancel
        </button>
        <button
          class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-accent text-white hover:bg-wb-accent-hover"
          phx-click="cutscene_save"
          disabled={@validation.errors != []}
        >
          Save Cutscene
        </button>
      </div>
    </div>
    """
  end

  defp step_color(type, step_types) do
    case Enum.find(step_types, fn {val, _, _} -> val == type end) do
      {_, _, color} -> color
      _ -> "#888"
    end
  end

  defp validate(data) do
    errors = []
    warnings = []

    errors =
      if data.id == "" do
        ["Cutscene ID is required" | errors]
      else
        if Regex.match?(~r/^[a-z][a-z0-9_-]*$/, data.id) do
          errors
        else
          ["Cutscene ID must be snake_case" | errors]
        end
      end

    errors =
      if data.trigger.type == "enter_room" && (data.trigger.location || "") == "" do
        ["Location is required for enter_room trigger" | errors]
      else
        errors
      end

    warnings =
      if data.sequence == [] do
        ["Cutscene has no sequence steps" | warnings]
      else
        warnings
      end

    errors =
      Enum.reduce(Enum.with_index(data.sequence), errors, fn {step, idx}, acc ->
        cond do
          step.type in ["dialogue", "narration"] && (step[:text] || "") == "" ->
            ["Step #{idx + 1}: #{step.type} requires text" | acc]

          true ->
            acc
        end
      end)

    warnings =
      Enum.reduce(Enum.with_index(data.sequence), warnings, fn {step, idx}, acc ->
        if step.type == "dialogue" && (step[:speaker] || "") == "" do
          ["Step #{idx + 1}: dialogue has no speaker" | acc]
        else
          acc
        end
      end)

    %{errors: Enum.reverse(errors), warnings: Enum.reverse(warnings)}
  end
end
