# Editor gate controls (bin/editor_gate.exs via toolbox_page.exs), evaluated by
# bin/red_controls.exs, which runs the list this returns: a planted registry, baseline, parity
# table, todo baseline, not-yet list or main's copy of one, each at tmp/red-editor-<name>.*; the files not
# planted are the committed ones.
root = Path.expand("..", __DIR__)
editor_registry = "kernel/ts/play/registry.json"
editor_baseline = "test/loka/editor_generic_baseline.txt"
parity_table = "kernel/ts/play/parity.json"
todo_baseline = "test/loka/builder_todo_baseline.txt"
editor = JSON.decode!(File.read!(Path.join(root, editor_registry)))
base = File.read!(Path.join(root, editor_baseline))
parity = JSON.decode!(File.read!(Path.join(root, parity_table)))
todo = File.read!(Path.join(root, todo_baseline))
notyet_list = "test/loka/builder_generic_notyet.txt"
notyet = File.read!(Path.join(root, notyet_list))
# outline.parts (book create still todo) with its book create set to v (nil drops the key)
book = fn v ->
  b = editor["outline.parts"]["book"]
  b = if v, do: Map.put(b, "create", v), else: Map.delete(b, "create")
  Map.put(editor, "outline.parts", Map.put(editor["outline.parts"], "book", b))
end

panel = &[Map.put(hd(parity), "panel", &1) | tl(parity)]
card = &Map.put(editor, "services.name", Map.put(editor["services.name"], "edit", &1))
# a card unregistered: its rows generic again (as services.name is), not in the shrunk baseline
uncard = fn re ->
  Map.new(editor, &if(elem(&1, 0) =~ re, do: {elem(&1, 0), editor["services.name"]}, else: &1))
end

world = ~r/^(cartridge|resources|attributes|populations|transports|barriers)\./

editor_controls =
  for {name, planted, expect} <- [
        # the walker reaches the ambient fields emote@1 declares (loka-8ghm), under if/then/else
        {"rooms-ambient", %{registry: Map.delete(editor, "rooms.ambient")},
         "rooms.ambient: no create surface"},
        {"npcs-ambient", %{registry: Map.delete(editor, "npcs.ambient")},
         "npcs.ambient: no create surface"},
        {"items-ambient", %{registry: Map.delete(editor, "items.ambient")},
         "items.ambient: no create surface"},
        {"treatment", %{registry: Map.delete(editor, "treatment:reverie")},
         "treatment:reverie: no create surface"},
        {"stale", %{registry: Map.put(editor, "rooms.nosuch", editor["rooms.name"])},
         "rooms.nosuch: no such source-schema path"},
        {"component", %{registry: card.("nope.tsx")}, "services.name: no edit surface"},
        {"unlisted", %{baseline: String.replace(base, "services.name.edit\n", "")},
         "services.name.edit: generic but not in the baseline"},
        {"room-card", %{registry: uncard.(~r/^rooms\./)},
         "rooms.name.edit: generic but not in the baseline"},
        {"npc-card", %{registry: uncard.(~r/^npcs\./)},
         "npcs.name.edit: generic but not in the baseline"},
        {"item-card", %{registry: uncard.(~r/^items\./)},
         "items.name.edit: generic but not in the baseline"},
        {"quest-card", %{registry: uncard.(~r/^quests\./)},
         "quests.name.edit: generic but not in the baseline"},
        {"dialogue-card", %{registry: uncard.(~r/^dialogues\./)},
         "dialogues.name.edit: generic but not in the baseline"},
        {"world-card", %{registry: uncard.(world)},
         "cartridge.title.edit: generic but not in the baseline"},
        {"rules-block",
         %{registry: uncard.(~r/^(actions\.(policy|check)|reactions\.(on|when|steps))$/)},
         "reactions.on.edit: generic but not in the baseline"},
        {"combat-schedule-blocks",
         %{registry: uncard.(~r/^(npcs\.(hp|attack|daily_schedule)|items\.weapon)$/)},
         "npcs.daily_schedule.edit: generic but not in the baseline"},
        {"action-card", %{registry: uncard.(~r/^actions\./)},
         "actions.cooldown.edit: generic but not in the baseline"},
        {"reaction-card", %{registry: uncard.(~r/^reactions\./)},
         "reactions.zone.edit: generic but not in the baseline"},
        {"scene-card", %{registry: uncard.(~r/^(scenes\.treatment|treatment:reverie)$/)},
         "scenes.treatment.edit: generic but not in the baseline"},
        {"escape", %{registry: card.("../App.tsx")}, "services.name: no edit surface"},
        {"bespoke", %{registry: card.("RedCard.tsx"), card: ""},
         "services.name.edit: no longer generic"},
        {"grown", %{main: String.replace(base, "services.name.edit\n", "")},
         "services.name.edit: not in main's baseline"},
        {"book-dropped", %{registry: book.(nil)}, "outline.parts: book create missing"},
        {"none-one-side",
         %{registry: put_in(editor, ["cartridge.id", "delete"], "cards/World.tsx")},
         "cartridge.id: book delete none: refused unless both sides are none"},
        {"none-no-reason",
         %{
           registry:
             editor
             |> put_in(["cartridge.id", "delete"], "none")
             |> put_in(["cartridge.id", "book", "delete"], "none")
         }, "cartridge.id: book delete \"none\": none needs a reason"},
        {"notyet-generic",
         %{registry: put_in(editor, ["outline.parts", "book", "delete"], "generic")},
         "outline.parts.book.delete: no longer not yet generic, delete the line"},
        {"generic-off-panel",
         %{registry: put_in(editor, ["actions.cooldown", "book", "create"], "generic")},
         "actions.cooldown: book create generic: refused"},
        {"notyet-grown",
         %{notyet_main: String.replace(notyet, ~r/^outline\.parts\.book\.delete .*\n/m, "")},
         "outline.parts.book.delete: not in main's baseline"},
        {"book-missing", %{registry: book.("Nope.tsx")},
         "outline.parts: book create Nope.tsx: no such file"},
        {"book-escape", %{registry: book.("../panel.tsx")},
         "outline.parts: book create ../panel.tsx: no such file"},
        {"book-accepted", %{registry: book.("RedSheet.tsx"), sheet: ""},
         "outline.parts.book.create: no longer todo"},
        {"todo-unlisted",
         %{todo: Regex.replace(~r/^outline\.parts\.book\.create\b.*\n/m, todo, "")},
         "outline.parts.book.create: todo but not in the baseline"},
        {"todo-grown",
         %{todo_main: Regex.replace(~r/^outline\.parts\.book\.create\b.*\n/m, todo, "")},
         "outline.parts.book.create: not in main's baseline"},
        {"parity-panel", %{parity: panel.("tools/author-panel/src/nope.tsx")},
         "\"hierarchy\": no panel file"},
        {"parity-escape", %{parity: panel.("../outside.tsx")}, "\"hierarchy\": no panel file"},
        {"parity-generic", %{parity: [Map.put(hd(parity), "book", "generic") | tl(parity)]},
         "\"hierarchy\": book generic: refused"},
        {"parity-duplicate", %{parity: parity ++ [hd(parity)]},
         "\"hierarchy\": ids are unique strings"},
        {"parity-unlisted", %{todo: String.replace(todo, "parity:palette  # 6.5\n", "")},
         "parity:palette: todo but not in the baseline"}
      ] do
    files =
      for {k, v} <- planted,
          into: %{},
          do: {
            case k do
              :card -> "tools/author-panel/src/edit/RedCard.tsx"
              :sheet -> "mobile/app/author/build/RedSheet.tsx"
              _ -> "tmp/red-editor-#{name}.#{k}"
            end,
            if(is_binary(v), do: v, else: JSON.encode!(v))
          }

    at = &if(planted[&1], do: "tmp/red-editor-#{name}.#{&1}", else: &2)

    {"editor gate: #{name}", files,
     ~w(elixir bin/toolbox_page.exs --check docs/features.json docs/MECHANICS-TOOLBOX.md
        docs/toolbox.gen.json) ++
       [
         at.(:registry, editor_registry),
         at.(:baseline, editor_baseline),
         at.(:main, editor_baseline),
         at.(:parity, parity_table),
         at.(:todo, todo_baseline),
         at.(:todo_main, todo_baseline),
         at.(:notyet, notyet_list),
         at.(:notyet_main, notyet_list)
       ], expect}
  end

# main's baseline unreadable (a path main lacks): --check raises instead of skipping shrink-only
unread =
  {"editor gate: main unreadable", %{"tmp/red-editor-unread.baseline" => base},
   ~w(elixir bin/toolbox_page.exs --check docs/features.json docs/MECHANICS-TOOLBOX.md
      docs/toolbox.gen.json #{editor_registry} tmp/red-editor-unread.baseline),
   "cannot read origin/main:tmp/red-editor-unread.baseline"}

editor_controls ++ [unread]
