defmodule LokaWeb.Channels.BuilderCommands.Help do
  @moduledoc """
  Help system: help, help <category>, help <command>.
  """

  def execute(:help, %{topic: topic}, _socket) do
    text = help_for_topic(topic)
    {:ok_text, text}
  end

  def execute(:help, _params, _socket) do
    {:ok_text, full_help()}
  end

  def full_help do
    """
    Available Commands:
      Movement:   north, south, east, west, up, down (or n,s,e,w,u,d)
      Look:       look, look <target>
      Talk:       talk <npc>
      Inventory:  inventory (or i), get <item>, drop <item>, equip, unequip
      Chat:       say <message>
      Combat:     attack <target>, flee
      Other:      who, help, clear

    Builder Commands:
      Navigation: goto <room_key>, rooms, where, find <search>
      Inspect:    info <entity>, list npcs|items|quests
      Spawn:      spawn <npc_key>, purge, give <item_key>
      Flags:      setflag <flag>, clearflag <flag>, flags
      Quests:     startquest <key>, completequest <key>, resetquest <key>, quests
      World:      settime dawn|noon|dusk|midnight, reload, validate
      Mode:       godmode

      Room CRUD:  dig <dir> <key> <name>, @desc <text>, @name <text>
                  create room <key> <name>, link <dir> <key>, unlink <dir>
                  delete room <key>

      Entity:     create npc <key> <name>, create item <key> <name>
                  edit npc|item <key> <field> <value>
                  delete npc|item <key>

      Content:    create quest <key> <name>, edit quest <key> [field] [value]
                  quest info <key>, create dialogue <npc_key>
                  dialogue info <key>, delete dialogue <key>
                  list quests|dialogues [filter]

      Zones:      create zone <key> <name>, edit zone <key> [field] [value]
                  zone info <key>, delete zone <key>, list zones

      Cutscenes:  create cutscene <key> <name>, cutscene info <key>
                  delete cutscene <key>, list cutscenes

      Storylines: create storyline <key> <name>, storyline info <key>
                  delete storyline <key>, list storylines

      Scripts:    script create <key> [hook], script info <key>
                  script list [hook], script delete <key>
                  script validate <key>, script test <key>
                  script templates, script from-template <key> <tpl>
                  script attach <script> <entity>
                  script detach <script> <entity>

      Projects:   project new <key> <name>, project load <key>
                  project list, project delete <key>

      Documents:  doc write <filename> <content>, doc read <filename>
                  doc list, doc delete <filename>
                  guide <topic>

      AI:         /ai <prompt>     - One-shot AI prompt
                  chat             - Enter chat mode (freeform AI)
                  exit             - Leave chat mode
                  /ai clear        - Clear AI history

    Abbreviations: dl=dialogue, sc=script, cs=cutscene, sl=storyline

    Type 'help <category>' for details. Categories: rooms, entities,
    quests, dialogues, zones, cutscenes, storylines, scripts, projects, ai\
    """
  end

  defp help_for_topic("rooms") do
    """
    Room Commands:
      dig <dir> <key> <name>  - Create room + exits, teleport there
      @desc <text>            - Set current room description
      @name <text>            - Set current room name
      create room <key> <name> - Create room (no exits)
      link <dir> <key>        - Create exit from here to <key>
      unlink <dir>            - Remove exit in <dir>
      delete room <key>       - Delete a room

    Examples:
      dig north tavern The Rusty Tavern
      @desc A cozy tavern with a crackling fireplace.
      link east market_square
    """
  end

  defp help_for_topic("entities") do
    """
    Entity Commands:
      create npc <key> <name>            - Create NPC prototype
      create item <key> <name>           - Create item prototype
      edit npc <key> <field> <value>     - Update NPC field
      edit item <key> <field> <value>    - Update item field
      delete npc <key>                   - Delete NPC
      delete item <key>                  - Delete item

    Examples:
      create npc merchant_bob Bob the Merchant
      edit npc merchant_bob description A jolly fellow
      delete item old_sword
    """
  end

  defp help_for_topic("quests") do
    """
    Quest & Dialogue Commands:
      create quest <key> <name>    - Create quest skeleton
      edit quest <key> [field val]  - Edit quest or show details
      quest info <key>             - Show quest details
      create dialogue <npc_key>    - Create NPC dialogue
      dialogue info <key>          - Show dialogue structure

    Examples:
      create quest fetch_herbs Herb Gathering
      quest info fetch_herbs
      dialogue info novice_pema
    """
  end

  defp help_for_topic("projects") do
    """
    Project & Document Commands:
      project new <key> <name>     - Create project
      project load <key>           - Switch to project
      project list                 - List all projects
      project delete <key>         - Delete project
      doc write <file> <content>   - Save document
      doc read <file>              - Read document
      doc list                     - List documents
      doc delete <file>            - Delete document
      guide <topic>                - Read builder guide

    Examples:
      project new demo Demo World
      doc write design.md Initial world concept
      guide rooms
    """
  end

  defp help_for_topic("ai") do
    """
    AI Commands:
      /ai <prompt>    - Send prompt to AI (one-shot)
      chat            - Enter chat mode (freeform conversation)
      exit            - Leave chat mode
      /ai clear       - Clear conversation history

    In chat mode, everything you type goes to the AI.
    Use 'exit' or '/exit' to return to normal mode.

    Examples:
      /ai create a forest zone with 5 rooms
      /ai list all NPCs and suggest improvements
      chat
      > Create a tavern with a mysterious bartender
      > Now add a quest where the bartender asks for help
      exit
    """
  end

  defp help_for_topic("dialogues") do
    """
    Dialogue Commands:
      create dialogue <npc_key>       - Create NPC dialogue
      dialogue info <key>             - Show dialogue structure
      delete dialogue <key>           - Delete dialogue
      list dialogues [filter]         - List all dialogues

    Abbreviation: dl = dialogue (e.g. 'dl info novice_pema')

    Examples:
      create dialogue merchant_bob
      dialogue info novice_pema
      dl info novice_pema
    """
  end

  defp help_for_topic("zones") do
    """
    Zone Commands:
      create zone <key> <name>         - Create empty zone
      edit zone <key>                  - Show zone details
      edit zone <key> <field> <value>  - Update zone field
      zone info <key>                  - Show zone details
      delete zone <key>               - Delete zone
      list zones                      - List all zones

    Examples:
      create zone dark_forest The Dark Forest
      edit zone dark_forest reset_mode manual
      zone info dark_forest
    """
  end

  defp help_for_topic("cutscenes") do
    """
    Cutscene Commands:
      create cutscene <key> <name>   - Create cutscene skeleton
      cutscene info <key>            - Show cutscene details
      delete cutscene <key>          - Delete cutscene
      list cutscenes                 - List all cutscenes

    Abbreviation: cs = cutscene (e.g. 'cs info intro_scene')

    Examples:
      create cutscene intro_vision The Opening Vision
      cutscene info intro_vision
    """
  end

  defp help_for_topic("storylines") do
    """
    Storyline Commands:
      create storyline <key> <name>  - Create storyline
      storyline info <key>           - Show storyline details
      delete storyline <key>         - Delete storyline
      list storylines                - List all storylines

    Abbreviation: sl = storyline (e.g. 'sl info main_arc')

    Examples:
      create storyline main_arc The Main Quest Line
      storyline info main_arc
    """
  end

  defp help_for_topic("scripts") do
    """
    Script Commands:
      script create <key> [hook]           - Create script (default hook: on_enter)
      script info <key>                    - Show script details
      script list [hook]                   - List all scripts (optionally by hook)
      script delete <key>                  - Delete script
      script validate <key>               - Validate script syntax
      script test <key>                    - Dry-run test
      script templates                    - List available templates
      script template <name>             - Show template details
      script from-template <key> <tpl> [config] - Create from template
      script attach <script> <entity>    - Attach script to entity
      script detach <script> <entity>    - Detach script from entity

    Abbreviation: sc = script (e.g. 'sc list', 'sc info patrol_guard')

    Examples:
      script create guard_check at_exit_room
      script from-template forest_patrol patrol route=room1,room2 interval=120
      script attach guard_check north_gate
    """
  end

  defp help_for_topic(_) do
    "Unknown help topic. Try: help rooms, help entities, help quests, help dialogues, " <>
      "help zones, help cutscenes, help storylines, help scripts, help projects, help ai"
  end
end
