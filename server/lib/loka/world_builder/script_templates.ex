defmodule Loka.WorldBuilder.ScriptTemplates do
  @moduledoc """
  Pre-built script templates for common game patterns.

  Provides 15 configurable templates that builders can use to create
  scripts without writing code. Each template has:
  - A unique ID (TPL-01 through TPL-15)
  - A descriptive name
  - Configuration parameters
  - A function to generate the actual script code

  ## Usage

      # List all templates
      ScriptTemplates.list_templates()

      # Get a specific template
      ScriptTemplates.get_template("TPL-03")

      # Generate code from template with config
      ScriptTemplates.generate_code("TPL-03", %{
        direction: "north",
        message: "The door is locked!",
        required_item: "rusty_key"
      })
  """

  @templates %{
    "TPL-01" => %{
      id: "TPL-01",
      name: "Message on Enter",
      description: "Display a message when a player enters the room.",
      hook: :on_enter,
      category: :messages,
      config_schema: [
        %{name: :message, type: :text, label: "Message to display", required: true},
        %{name: :delay, type: :integer, label: "Delay (ms)", default: 0}
      ],
      generator: :message_on_enter
    },
    "TPL-02" => %{
      id: "TPL-02",
      name: "Message on Enter (Once)",
      description: "Display a message only the first time a player enters the room.",
      hook: :on_enter,
      category: :messages,
      config_schema: [
        %{name: :message, type: :text, label: "Message to display", required: true},
        %{name: :flag_key, type: :string, label: "Flag name", default: "visited_{room_key}"}
      ],
      generator: :message_on_enter_once
    },
    "TPL-03" => %{
      id: "TPL-03",
      name: "Block Exit",
      description: "Block an exit until a condition is met (item, flag, or quest).",
      hook: :on_exit,
      category: :navigation,
      config_schema: [
        %{name: :direction, type: :direction, label: "Exit direction", required: true},
        %{name: :block_message, type: :text, label: "Blocked message", required: true},
        %{
          name: :condition_type,
          type: :select,
          label: "Condition type",
          options: ["item", "flag", "quest"],
          default: "flag"
        },
        %{name: :condition_value, type: :string, label: "Item/flag/quest key", required: true}
      ],
      generator: :block_exit
    },
    "TPL-04" => %{
      id: "TPL-04",
      name: "Spawn on Enter",
      description: "Spawn an NPC or item when player enters (with respawn control).",
      hook: :on_enter,
      category: :spawning,
      config_schema: [
        %{
          name: :entity_type,
          type: :select,
          label: "Entity type",
          options: ["npc", "item"],
          required: true
        },
        %{name: :prototype_key, type: :string, label: "Prototype key", required: true},
        %{name: :spawn_once, type: :boolean, label: "Spawn only once", default: true},
        %{name: :spawn_delay, type: :integer, label: "Respawn delay (seconds)", default: 0}
      ],
      generator: :spawn_on_enter
    },
    "TPL-05" => %{
      id: "TPL-05",
      name: "Give Item (Once)",
      description: "Give the player an item the first time they enter.",
      hook: :on_enter,
      category: :rewards,
      config_schema: [
        %{name: :item_key, type: :string, label: "Item prototype key", required: true},
        %{name: :message, type: :text, label: "Discovery message", required: true},
        %{name: :flag_key, type: :string, label: "Flag name", default: "found_{item_key}"}
      ],
      generator: :give_item_once
    },
    "TPL-06" => %{
      id: "TPL-06",
      name: "Trigger Dialogue",
      description: "Automatically start a dialogue when player enters.",
      hook: :on_enter,
      category: :dialogue,
      config_schema: [
        %{name: :npc_key, type: :string, label: "NPC key", required: true},
        %{name: :dialogue_key, type: :string, label: "Dialogue key", required: true},
        %{name: :once_only, type: :boolean, label: "Trigger once only", default: true}
      ],
      generator: :trigger_dialogue
    },
    "TPL-07" => %{
      id: "TPL-07",
      name: "Damage Trap",
      description: "Deal damage to player when they enter.",
      hook: :on_enter,
      category: :traps,
      config_schema: [
        %{name: :damage, type: :integer, label: "Damage amount", required: true, default: 10},
        %{
          name: :damage_type,
          type: :select,
          label: "Damage type",
          options: ["physical", "fire", "ice", "poison", "dark"],
          default: "physical"
        },
        %{name: :message, type: :text, label: "Trap message", required: true},
        %{name: :save_stat, type: :string, label: "Save stat (optional, e.g., 'dexterity')"}
      ],
      generator: :damage_trap
    },
    "TPL-08" => %{
      id: "TPL-08",
      name: "Conditional Trap",
      description: "Trap that only triggers if player lacks specific item/flag.",
      hook: :on_enter,
      category: :traps,
      config_schema: [
        %{name: :damage, type: :integer, label: "Damage amount", required: true, default: 10},
        %{name: :trap_message, type: :text, label: "Trap triggered message", required: true},
        %{name: :safe_message, type: :text, label: "Safe passage message", required: true},
        %{
          name: :safety_type,
          type: :select,
          label: "Safety condition",
          options: ["item", "flag"],
          default: "item"
        },
        %{name: :safety_key, type: :string, label: "Item/flag that prevents trap", required: true}
      ],
      generator: :conditional_trap
    },
    "TPL-09" => %{
      id: "TPL-09",
      name: "Ambient Messages",
      description: "Display random atmospheric messages periodically.",
      hook: :ambient,
      category: :atmosphere,
      config_schema: [
        %{name: :messages, type: :text_list, label: "Ambient messages", required: true},
        %{name: :interval_min, type: :integer, label: "Min interval (seconds)", default: 30},
        %{name: :interval_max, type: :integer, label: "Max interval (seconds)", default: 60},
        %{name: :chance, type: :float, label: "Trigger chance (0.0-1.0)", default: 0.5}
      ],
      generator: :ambient_messages
    },
    "TPL-10" => %{
      id: "TPL-10",
      name: "Lock/Unlock Exit",
      description: "Lock or unlock an exit based on an action or item.",
      hook: :on_action,
      category: :navigation,
      config_schema: [
        %{name: :direction, type: :direction, label: "Exit direction", required: true},
        %{
          name: :action,
          type: :select,
          label: "Trigger action",
          options: ["use_item", "pull_lever", "speak_word"],
          default: "use_item"
        },
        %{name: :action_target, type: :string, label: "Item/lever/word", required: true},
        %{name: :unlock_message, type: :text, label: "Unlock message", required: true},
        %{
          name: :already_unlocked_msg,
          type: :text,
          label: "Already unlocked message",
          default: "It's already open."
        }
      ],
      generator: :lock_unlock_exit
    },
    "TPL-11" => %{
      id: "TPL-11",
      name: "Start Quest",
      description: "Offer or start a quest when player enters or talks to NPC.",
      hook: :on_enter,
      category: :quests,
      config_schema: [
        %{name: :quest_key, type: :string, label: "Quest key", required: true},
        %{name: :auto_accept, type: :boolean, label: "Auto-accept quest", default: false},
        %{name: :offer_message, type: :text, label: "Quest offer message", required: true},
        %{
          name: :already_active_msg,
          type: :text,
          label: "Already on quest message",
          default: "You're already working on this."
        }
      ],
      generator: :start_quest
    },
    "TPL-12" => %{
      id: "TPL-12",
      name: "Time-based Message",
      description: "Show different messages based on in-game time of day.",
      hook: :on_enter,
      category: :atmosphere,
      config_schema: [
        %{name: :dawn_message, type: :text, label: "Dawn message (6am-9am)"},
        %{name: :day_message, type: :text, label: "Day message (9am-5pm)"},
        %{name: :dusk_message, type: :text, label: "Dusk message (5pm-8pm)"},
        %{name: :night_message, type: :text, label: "Night message (8pm-6am)"}
      ],
      generator: :time_based_message
    },
    "TPL-13" => %{
      id: "TPL-13",
      name: "Weather Effect",
      description: "Apply effects or messages based on current weather.",
      hook: :on_enter,
      category: :atmosphere,
      config_schema: [
        %{
          name: :weather_type,
          type: :select,
          label: "Weather condition",
          options: ["rain", "snow", "storm", "fog", "clear"],
          required: true
        },
        %{name: :message, type: :text, label: "Weather message", required: true},
        %{name: :apply_effect, type: :boolean, label: "Apply stat effect", default: false},
        %{name: :effect_stat, type: :string, label: "Affected stat"},
        %{name: :effect_modifier, type: :integer, label: "Stat modifier"}
      ],
      generator: :weather_effect
    },
    "TPL-14" => %{
      id: "TPL-14",
      name: "NPC Reaction",
      description: "NPC reacts when player enters based on reputation/flags.",
      hook: :on_enter,
      category: :npcs,
      config_schema: [
        %{name: :npc_key, type: :string, label: "NPC key", required: true},
        %{
          name: :hostile_flag,
          type: :string,
          label: "Hostile flag (triggers attack)",
          default: "hostile_to_{npc_key}"
        },
        %{name: :friendly_message, type: :text, label: "Friendly greeting", required: true},
        %{name: :hostile_message, type: :text, label: "Hostile reaction message"},
        %{name: :attack_on_hostile, type: :boolean, label: "Attack if hostile", default: false}
      ],
      generator: :npc_reaction
    },
    "TPL-15" => %{
      id: "TPL-15",
      name: "Death Respawn",
      description: "Configure respawn location when player dies in this room.",
      hook: :on_death,
      category: :death,
      config_schema: [
        %{name: :respawn_room, type: :string, label: "Respawn room key", required: true},
        %{name: :death_message, type: :text, label: "Death message", required: true},
        %{name: :respawn_message, type: :text, label: "Respawn message", required: true},
        %{name: :lose_items, type: :boolean, label: "Drop items on death", default: false},
        %{name: :gold_loss_percent, type: :integer, label: "Gold loss percent", default: 0}
      ],
      generator: :death_respawn
    }
  }

  @doc """
  List all available templates.
  """
  def list_templates do
    @templates
    |> Map.values()
    |> Enum.sort_by(& &1.id)
  end

  @doc """
  Get a specific template by ID.
  """
  def get_template(id) when is_binary(id) do
    case Map.get(@templates, id) do
      nil -> {:error, :not_found}
      template -> {:ok, template}
    end
  end

  @doc """
  Get templates by category.
  """
  def list_by_category(category) when is_atom(category) do
    @templates
    |> Map.values()
    |> Enum.filter(&(&1.category == category))
    |> Enum.sort_by(& &1.id)
  end

  @doc """
  Get all categories.
  """
  def categories do
    @templates
    |> Map.values()
    |> Enum.map(& &1.category)
    |> Enum.uniq()
    |> Enum.sort()
  end

  @doc """
  Generate script code from a template and configuration.

  ## Examples

      {:ok, code} = ScriptTemplates.generate_code("TPL-03", %{
        direction: "north",
        block_message: "The door is locked!",
        condition_type: "item",
        condition_value: "rusty_key"
      })
  """
  def generate_code(template_id, config) when is_binary(template_id) and is_map(config) do
    case get_template(template_id) do
      {:ok, template} ->
        case validate_config(template, config) do
          :ok ->
            code = apply(__MODULE__, template.generator, [config])
            {:ok, code}

          {:error, errors} ->
            {:error, {:validation_failed, errors}}
        end

      {:error, _} = error ->
        error
    end
  end

  @doc """
  Validate configuration against template schema.
  """
  def validate_config(template, config) do
    errors =
      template.config_schema
      |> Enum.reduce([], fn schema_field, errors ->
        field_name = schema_field.name
        value = Map.get(config, field_name) || Map.get(config, to_string(field_name))
        required = Map.get(schema_field, :required, false)

        cond do
          required && is_nil(value) ->
            ["#{field_name} is required" | errors]

          !is_nil(value) && schema_field.type == :integer && !is_integer(value) ->
            ["#{field_name} must be an integer" | errors]

          !is_nil(value) && schema_field.type == :boolean && !is_boolean(value) ->
            ["#{field_name} must be a boolean" | errors]

          !is_nil(value) && schema_field.type == :float && !is_float(value) && !is_integer(value) ->
            ["#{field_name} must be a number" | errors]

          true ->
            errors
        end
      end)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  # =============================================================================
  # Code Generators
  # =============================================================================

  def message_on_enter(config) do
    message = config[:message] || config["message"]
    delay = config[:delay] || config["delay"] || 0

    if delay > 0 do
      """
      # Message on Enter (with delay)
      schedule_after(#{delay}, fn ->
        message(player, "#{escape_string(message)}")
      end)
      """
    else
      """
      # Message on Enter
      message(player, "#{escape_string(message)}")
      """
    end
  end

  def message_on_enter_once(config) do
    message = config[:message] || config["message"]
    flag_key = config[:flag_key] || config["flag_key"] || "visited_room"

    """
    # Message on Enter (Once)
    unless has_flag?(player, "#{flag_key}") do
      message(player, "#{escape_string(message)}")
      set_flag(player, "#{flag_key}", true)
    end
    """
  end

  def block_exit(config) do
    direction = config[:direction] || config["direction"]
    block_message = config[:block_message] || config["block_message"]
    condition_type = config[:condition_type] || config["condition_type"] || "flag"
    condition_value = config[:condition_value] || config["condition_value"]

    condition_check =
      case condition_type do
        "item" -> "has_item?(player, \"#{condition_value}\")"
        "flag" -> "has_flag?(player, \"#{condition_value}\")"
        "quest" -> "quest_complete?(player, \"#{condition_value}\")"
        _ -> "has_flag?(player, \"#{condition_value}\")"
      end

    """
    # Block Exit until condition met
    if direction == "#{direction}" do
      if #{condition_check} do
        :allow
      else
        message(player, "#{escape_string(block_message)}")
        :block
      end
    else
      :allow
    end
    """
  end

  def spawn_on_enter(config) do
    entity_type = config[:entity_type] || config["entity_type"]
    prototype_key = config[:prototype_key] || config["prototype_key"]
    spawn_once = config[:spawn_once] || config["spawn_once"] || true
    flag_key = "spawned_#{prototype_key}"

    spawn_fn = if entity_type == "npc", do: "spawn_npc", else: "spawn_item"

    if spawn_once do
      """
      # Spawn on Enter (Once)
      unless has_flag?(room, "#{flag_key}") do
        #{spawn_fn}("#{prototype_key}")
        set_flag(room, "#{flag_key}", true)
      end
      """
    else
      """
      # Spawn on Enter
      #{spawn_fn}("#{prototype_key}")
      """
    end
  end

  def give_item_once(config) do
    item_key = config[:item_key] || config["item_key"]
    message = config[:message] || config["message"]
    flag_key = config[:flag_key] || config["flag_key"] || "found_#{item_key}"

    """
    # Give Item (Once)
    unless has_flag?(player, "#{flag_key}") do
      message(player, "#{escape_string(message)}")
      give_item(player, "#{item_key}")
      set_flag(player, "#{flag_key}", true)
    end
    """
  end

  def trigger_dialogue(config) do
    npc_key = config[:npc_key] || config["npc_key"]
    dialogue_key = config[:dialogue_key] || config["dialogue_key"]
    once_only = config[:once_only] || config["once_only"] || true
    flag_key = "dialogue_#{dialogue_key}_shown"

    if once_only do
      """
      # Trigger Dialogue (Once)
      unless has_flag?(player, "#{flag_key}") do
        start_dialogue("#{npc_key}", "#{dialogue_key}")
        set_flag(player, "#{flag_key}", true)
      end
      """
    else
      """
      # Trigger Dialogue
      start_dialogue("#{npc_key}", "#{dialogue_key}")
      """
    end
  end

  def damage_trap(config) do
    damage = config[:damage] || config["damage"] || 10
    damage_type = config[:damage_type] || config["damage_type"] || "physical"
    message = config[:message] || config["message"]
    save_stat = config[:save_stat] || config["save_stat"]

    if save_stat && save_stat != "" do
      """
      # Damage Trap (with save)
      message(player, "#{escape_string(message)}")
      if !save_check(player, "#{save_stat}") do
        damage(player, #{damage}, "#{damage_type}")
      else
        message(player, "You avoid the trap!")
      end
      """
    else
      """
      # Damage Trap
      message(player, "#{escape_string(message)}")
      damage(player, #{damage}, "#{damage_type}")
      """
    end
  end

  def conditional_trap(config) do
    damage = config[:damage] || config["damage"] || 10
    trap_message = config[:trap_message] || config["trap_message"]
    safe_message = config[:safe_message] || config["safe_message"]
    safety_type = config[:safety_type] || config["safety_type"] || "item"
    safety_key = config[:safety_key] || config["safety_key"]

    condition_check =
      case safety_type do
        "item" -> "has_item?(player, \"#{safety_key}\")"
        "flag" -> "has_flag?(player, \"#{safety_key}\")"
        _ -> "has_flag?(player, \"#{safety_key}\")"
      end

    """
    # Conditional Trap
    if #{condition_check} do
      message(player, "#{escape_string(safe_message)}")
    else
      message(player, "#{escape_string(trap_message)}")
      damage(player, #{damage})
    end
    """
  end

  def ambient_messages(config) do
    messages = config[:messages] || config["messages"] || []
    interval_min = config[:interval_min] || config["interval_min"] || 30
    interval_max = config[:interval_max] || config["interval_max"] || 60
    chance = config[:chance] || config["chance"] || 0.5

    messages_list =
      messages
      |> Enum.map(&"\"#{escape_string(&1)}\"")
      |> Enum.join(",\n    ")

    """
    # Ambient Messages
    %{
      messages: [
        #{messages_list}
      ],
      interval_min: #{interval_min},
      interval_max: #{interval_max},
      chance: #{chance}
    }
    """
  end

  def lock_unlock_exit(config) do
    direction = config[:direction] || config["direction"]
    action = config[:action] || config["action"] || "use_item"
    action_target = config[:action_target] || config["action_target"]
    unlock_message = config[:unlock_message] || config["unlock_message"]

    already_unlocked_msg =
      config[:already_unlocked_msg] || config["already_unlocked_msg"] || "It's already open."

    flag_key = "exit_#{direction}_unlocked"

    action_check =
      case action do
        "use_item" -> "action == :use && target == \"#{action_target}\""
        "pull_lever" -> "action == :pull && target == \"lever\" || target == \"#{action_target}\""
        "speak_word" -> "action == :say && String.downcase(message) =~ \"#{action_target}\""
        _ -> "action == :use && target == \"#{action_target}\""
      end

    """
    # Lock/Unlock Exit
    if #{action_check} do
      if has_flag?(room, "#{flag_key}") do
        message(player, "#{escape_string(already_unlocked_msg)}")
      else
        unlock_exit("#{direction}")
        set_flag(room, "#{flag_key}", true)
        message(player, "#{escape_string(unlock_message)}")
      end
    end
    """
  end

  def start_quest(config) do
    quest_key = config[:quest_key] || config["quest_key"]
    auto_accept = config[:auto_accept] || config["auto_accept"] || false
    offer_message = config[:offer_message] || config["offer_message"]

    already_active_msg =
      config[:already_active_msg] || config["already_active_msg"] ||
        "You're already working on this."

    if auto_accept do
      """
      # Start Quest (Auto-accept)
      if quest_active?(player, "#{quest_key}") do
        message(player, "#{escape_string(already_active_msg)}")
      else
        message(player, "#{escape_string(offer_message)}")
        start_quest(player, "#{quest_key}")
      end
      """
    else
      """
      # Start Quest (Offer)
      if quest_active?(player, "#{quest_key}") do
        message(player, "#{escape_string(already_active_msg)}")
      else
        message(player, "#{escape_string(offer_message)}")
        offer_quest(player, "#{quest_key}")
      end
      """
    end
  end

  def time_based_message(config) do
    dawn_message = config[:dawn_message] || config["dawn_message"]
    day_message = config[:day_message] || config["day_message"]
    dusk_message = config[:dusk_message] || config["dusk_message"]
    night_message = config[:night_message] || config["night_message"]

    clauses = []

    clauses =
      if dawn_message,
        do: clauses ++ ["  :dawn -> message(player, \"#{escape_string(dawn_message)}\")"],
        else: clauses

    clauses =
      if day_message,
        do: clauses ++ ["  :day -> message(player, \"#{escape_string(day_message)}\")"],
        else: clauses

    clauses =
      if dusk_message,
        do: clauses ++ ["  :dusk -> message(player, \"#{escape_string(dusk_message)}\")"],
        else: clauses

    clauses =
      if night_message,
        do: clauses ++ ["  :night -> message(player, \"#{escape_string(night_message)}\")"],
        else: clauses

    if Enum.empty?(clauses) do
      "# Time-based Message (no messages configured)"
    else
      """
      # Time-based Message
      case time_of_day() do
      #{Enum.join(clauses, "\n")}
        _ -> :ok
      end
      """
    end
  end

  def weather_effect(config) do
    weather_type = config[:weather_type] || config["weather_type"]
    message = config[:message] || config["message"]
    apply_effect = config[:apply_effect] || config["apply_effect"] || false
    effect_stat = config[:effect_stat] || config["effect_stat"]
    effect_modifier = config[:effect_modifier] || config["effect_modifier"] || 0

    effect_code =
      if apply_effect && effect_stat do
        "\n  modify_stat(player, \"#{effect_stat}\", #{effect_modifier})"
      else
        ""
      end

    """
    # Weather Effect
    if weather() == :#{weather_type} do
      message(player, "#{escape_string(message)}")#{effect_code}
    end
    """
  end

  def npc_reaction(config) do
    npc_key = config[:npc_key] || config["npc_key"]
    hostile_flag = config[:hostile_flag] || config["hostile_flag"] || "hostile_to_#{npc_key}"
    friendly_message = config[:friendly_message] || config["friendly_message"]
    hostile_message = config[:hostile_message] || config["hostile_message"]
    attack_on_hostile = config[:attack_on_hostile] || config["attack_on_hostile"] || false

    hostile_action =
      if attack_on_hostile do
        """
          say("#{npc_key}", "#{escape_string(hostile_message || "You dare show your face here!")}")
          start_combat("#{npc_key}", player)
        """
      else
        """
          say("#{npc_key}", "#{escape_string(hostile_message || "I have nothing to say to you.")}")
        """
      end

    """
    # NPC Reaction
    if has_flag?(player, "#{hostile_flag}") do
    #{hostile_action}
    else
      say("#{npc_key}", "#{escape_string(friendly_message)}")
    end
    """
  end

  def death_respawn(config) do
    respawn_room = config[:respawn_room] || config["respawn_room"]
    death_message = config[:death_message] || config["death_message"]
    respawn_message = config[:respawn_message] || config["respawn_message"]
    lose_items = config[:lose_items] || config["lose_items"] || false
    gold_loss_percent = config[:gold_loss_percent] || config["gold_loss_percent"] || 0

    item_loss_code = if lose_items, do: "\ndrop_all_items(player)", else: ""

    gold_loss_code =
      if gold_loss_percent > 0, do: "\nlose_gold_percent(player, #{gold_loss_percent})", else: ""

    """
    # Death Respawn
    message(player, "#{escape_string(death_message)}")#{item_loss_code}#{gold_loss_code}
    schedule_after(3000, fn ->
      teleport(player, "#{respawn_room}")
      message(player, "#{escape_string(respawn_message)}")
      revive(player)
    end)
    """
  end

  # Helper to escape strings for code generation
  defp escape_string(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp escape_string(_), do: ""
end
