defmodule LokaWeb.AdminLive.WorldBuilder.QuestEditor do
  @moduledoc """
  Pure LiveView quest editor component.

  Renders a stacked form for creating/editing quests with:
  - Quest identity (key, name, type, giver, description)
  - Objectives list (add/remove/edit)
  - Rewards (XP, gold, items)
  - Prerequisites (add/remove/edit)
  - Level range
  - Real-time validation
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :quest_data, :map, required: true
  attr :npcs, :list, default: []

  def quest_editor(assigns) do
    validation = validate(assigns.quest_data)
    assigns = assign(assigns, :validation, validation)

    ~H"""
    <div class="quest-editor-lv">
      <%!-- Validation banner --%>
      <div class={[
        "quest-validation-banner",
        @validation.errors == [] && "valid"
      ]}>
        <%= if @validation.errors == [] do %>
          <.icon name="hero-check-circle" class="size-4" />
          <span>Valid quest</span>
        <% else %>
          <.icon name="hero-exclamation-triangle" class="size-4" />
          <span>{length(@validation.errors)} error(s)</span>
        <% end %>
      </div>

      <div class="quest-editor-scroll">
        <%!-- Quest Identity Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-flag" class="size-4" />
            <span>Quest Identity</span>
          </div>
          <div class="quest-form-grid">
            <div class="quest-form-row">
              <label>Key</label>
              <input
                type="text"
                value={@quest_data.key}
                phx-blur="quest_update_field"
                phx-value-field="key"
                name="value"
                placeholder="quest_key"
                class="quest-input"
                phx-debounce="300"
              />
            </div>
            <div class="quest-form-row">
              <label>Name</label>
              <input
                type="text"
                value={@quest_data.name}
                phx-blur="quest_update_field"
                phx-value-field="name"
                name="value"
                placeholder="Quest name"
                class="quest-input"
                phx-debounce="300"
              />
            </div>
            <div class="quest-form-row-pair">
              <div class="quest-form-row">
                <label>Type</label>
                <select
                  phx-change="quest_update_field"
                  phx-value-field="quest_type"
                  name="value"
                  class="quest-input"
                >
                  <option value="main" selected={@quest_data.quest_type == "main"}>Main</option>
                  <option value="side" selected={@quest_data.quest_type == "side"}>Side</option>
                  <option value="daily" selected={@quest_data.quest_type == "daily"}>Daily</option>
                  <option value="repeatable" selected={@quest_data.quest_type == "repeatable"}>
                    Repeatable
                  </option>
                </select>
              </div>
              <div class="quest-form-row">
                <label>Giver NPC</label>
                <select
                  phx-change="quest_update_field"
                  phx-value-field="giver_key"
                  name="value"
                  class="quest-input"
                >
                  <option value="">None</option>
                  <%= for npc <- @npcs do %>
                    <option value={npc.key} selected={@quest_data.giver_key == npc.key}>
                      {npc[:name] || npc[:short_desc] || npc.key}
                    </option>
                  <% end %>
                </select>
              </div>
            </div>
            <div class="quest-form-row">
              <label>Description</label>
              <textarea
                phx-blur="quest_update_field"
                phx-value-field="description"
                name="value"
                placeholder="What the player sees..."
                class="quest-input"
                rows="2"
                phx-debounce="300"
              >{@quest_data.description}</textarea>
            </div>
            <div class="quest-form-row-pair">
              <div class="quest-form-row">
                <label>Level Min</label>
                <input
                  type="number"
                  value={@quest_data.level_min}
                  phx-blur="quest_update_field"
                  phx-value-field="level_min"
                  name="value"
                  min="1"
                  class="quest-input"
                  phx-debounce="300"
                />
              </div>
              <div class="quest-form-row">
                <label>Level Max</label>
                <input
                  type="number"
                  value={@quest_data.level_max}
                  phx-blur="quest_update_field"
                  phx-value-field="level_max"
                  name="value"
                  min="1"
                  class="quest-input"
                  phx-debounce="300"
                />
              </div>
            </div>
          </div>
        </div>

        <%!-- Objectives Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-clipboard-document-check" class="size-4" />
            <span>Objectives</span>
            <div style="flex: 1;"></div>
            <button class="quest-add-btn" phx-click="quest_add_objective" title="Add objective">
              <.icon name="hero-plus" class="size-3" /> Add
            </button>
          </div>
          <%= if @quest_data.objectives == [] do %>
            <div class="quest-empty">No objectives yet. Add one to get started.</div>
          <% else %>
            <%= for {obj, idx} <- Enum.with_index(@quest_data.objectives) do %>
              <div class="quest-list-item">
                <div class="quest-list-item-header">
                  <span class="quest-list-item-num">{idx + 1}</span>
                  <select
                    phx-change="quest_update_objective"
                    phx-value-idx={idx}
                    phx-value-field="type"
                    name="value"
                    class="quest-input-sm"
                  >
                    <option value="kill" selected={obj.type == "kill"}>Kill</option>
                    <option value="collect" selected={obj.type == "collect"}>Collect</option>
                    <option value="talk_to" selected={obj.type == "talk_to"}>Talk to</option>
                    <option value="reach_room" selected={obj.type == "reach_room"}>
                      Reach Location
                    </option>
                    <option value="use_item" selected={obj.type == "use_item"}>Use Item</option>
                    <option value="explore" selected={obj.type == "explore"}>Explore</option>
                  </select>
                  <div style="flex: 1;"></div>
                  <button
                    class="quest-remove-btn"
                    phx-click="quest_remove_objective"
                    phx-value-idx={idx}
                    title="Remove"
                  >
                    <.icon name="hero-x-mark" class="size-3" />
                  </button>
                </div>
                <div class="quest-list-item-body">
                  <div class="quest-form-row-inline">
                    <label>Target</label>
                    <input
                      type="text"
                      value={obj.target}
                      phx-blur="quest_update_objective"
                      phx-value-idx={idx}
                      phx-value-field="target"
                      name="value"
                      placeholder="entity_key"
                      class="quest-input-sm"
                      phx-debounce="300"
                    />
                  </div>
                  <%= if obj.type in ["kill", "collect"] do %>
                    <div class="quest-form-row-inline">
                      <label>Count</label>
                      <input
                        type="number"
                        value={obj.count}
                        phx-blur="quest_update_objective"
                        phx-value-idx={idx}
                        phx-value-field="count"
                        name="value"
                        min="1"
                        class="quest-input-sm"
                        style="width: 60px;"
                        phx-debounce="300"
                      />
                    </div>
                  <% end %>
                  <div class="quest-form-row-inline">
                    <label>Desc</label>
                    <input
                      type="text"
                      value={obj.description}
                      phx-blur="quest_update_objective"
                      phx-value-idx={idx}
                      phx-value-field="description"
                      name="value"
                      placeholder="Player-facing description"
                      class="quest-input-sm"
                      phx-debounce="300"
                    />
                  </div>
                </div>
              </div>
            <% end %>
          <% end %>
        </div>

        <%!-- Rewards Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-gift" class="size-4" />
            <span>Rewards</span>
          </div>
          <div class="quest-form-grid">
            <div class="quest-form-row-triple">
              <div class="quest-form-row">
                <label>XP</label>
                <input
                  type="number"
                  value={@quest_data.xp}
                  phx-blur="quest_update_field"
                  phx-value-field="xp"
                  name="value"
                  min="0"
                  class="quest-input"
                  phx-debounce="300"
                />
              </div>
              <div class="quest-form-row">
                <label>Gold</label>
                <input
                  type="number"
                  value={@quest_data.gold}
                  phx-blur="quest_update_field"
                  phx-value-field="gold"
                  name="value"
                  min="0"
                  class="quest-input"
                  phx-debounce="300"
                />
              </div>
            </div>
            <div class="quest-form-row">
              <label>Items (comma-separated keys)</label>
              <input
                type="text"
                value={@quest_data.reward_items}
                phx-blur="quest_update_field"
                phx-value-field="reward_items"
                name="value"
                placeholder="item_key1, item_key2"
                class="quest-input"
                phx-debounce="300"
              />
            </div>
          </div>
        </div>

        <%!-- Prerequisites Section --%>
        <div class="quest-section">
          <div class="quest-section-header">
            <.icon name="hero-lock-closed" class="size-4" />
            <span>Prerequisites</span>
            <div style="flex: 1;"></div>
            <button
              class="quest-add-btn"
              phx-click="quest_add_prerequisite"
              title="Add prerequisite"
            >
              <.icon name="hero-plus" class="size-3" /> Add
            </button>
          </div>
          <%= if @quest_data.prerequisites == [] do %>
            <div class="quest-empty">No prerequisites. Quest available to all players.</div>
          <% else %>
            <%= for {prereq, idx} <- Enum.with_index(@quest_data.prerequisites) do %>
              <div class="quest-list-item-compact">
                <select
                  phx-change="quest_update_prerequisite"
                  phx-value-idx={idx}
                  phx-value-field="type"
                  name="value"
                  class="quest-input-sm"
                >
                  <option value="quest" selected={prereq.type == "quest"}>Complete Quest</option>
                  <option value="level" selected={prereq.type == "level"}>Min Level</option>
                  <option value="item" selected={prereq.type == "item"}>Has Item</option>
                  <option value="flag" selected={prereq.type == "flag"}>Has Flag</option>
                </select>
                <input
                  type={if prereq.type == "level", do: "number", else: "text"}
                  value={prereq.value}
                  phx-blur="quest_update_prerequisite"
                  phx-value-idx={idx}
                  phx-value-field="value"
                  name="value"
                  placeholder={if prereq.type == "level", do: "1", else: "key"}
                  class="quest-input-sm"
                  style="flex: 1;"
                  phx-debounce="300"
                />
                <button
                  class="quest-remove-btn"
                  phx-click="quest_remove_prerequisite"
                  phx-value-idx={idx}
                  title="Remove"
                >
                  <.icon name="hero-x-mark" class="size-3" />
                </button>
              </div>
            <% end %>
          <% end %>
        </div>

        <%!-- Validation Details --%>
        <%= if @validation.errors != [] or @validation.warnings != [] do %>
          <div class="quest-section">
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
        <% end %>
      </div>

      <%!-- Footer with save/cancel --%>
      <div class="quest-editor-footer">
        <button class="btn btn-sm btn-secondary" phx-click="close_quest_editor">Cancel</button>
        <button
          class="btn btn-sm btn-primary"
          phx-click="quest_save"
          disabled={@validation.errors != []}
        >
          Save Quest
        </button>
      </div>
    </div>
    """
  end

  defp validate(data) do
    errors = []
    warnings = []

    errors =
      if data.key == "" do
        ["Quest key is required" | errors]
      else
        if Regex.match?(~r/^[a-z][a-z0-9_]*$/, data.key) do
          errors
        else
          ["Quest key must be snake_case" | errors]
        end
      end

    errors = if data.name == "", do: ["Quest name is required" | errors], else: errors

    errors =
      if data.objectives == [],
        do: ["At least one objective is required" | errors],
        else: errors

    errors =
      Enum.reduce(Enum.with_index(data.objectives), errors, fn {obj, idx}, acc ->
        if obj.target == "" do
          ["Objective #{idx + 1}: target is required" | acc]
        else
          acc
        end
      end)

    warnings = if data.giver_key == "", do: ["No giver NPC specified" | warnings], else: warnings

    warnings =
      Enum.reduce(Enum.with_index(data.objectives), warnings, fn {obj, idx}, acc ->
        if obj.description == "" do
          ["Objective #{idx + 1}: description recommended" | acc]
        else
          acc
        end
      end)

    %{errors: Enum.reverse(errors), warnings: Enum.reverse(warnings)}
  end
end
