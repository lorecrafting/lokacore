# Godot SubViewport Meta Click Detection

## Problem

When rendering UI text in a SubViewport that's displayed as a texture on a 3D mesh (common for book/scroll/screen effects), click detection based on pixel positions is unreliable because:
- Text layout varies with font size, wrapping, and content length
- Position-based calculations break when content changes
- Different screen sizes/DPIs affect coordinates

## Solution

Use RichTextLabel's `[url]` BBCode meta tags combined with SubViewport input forwarding for 100% accurate click detection.

### How It Works

1. **Godot's RichTextLabel** supports `[url=value]clickable text[/url]` BBCode
2. When clicked, it emits `meta_clicked(value)` signal with the meta value
3. For SubViewport-on-3D-mesh, forward clicks to the SubViewport using `push_input()`

## Implementation Pattern

### Step 1: Render clickable text with meta tags

```gdscript
## For dialogue choices:
for i in range(choices.size()):
    var choice_text: String = choices[i].get("text", "")
    text += "[url=%d][u]%s[/u][/url]\n" % [i, choice_text]

## For entity actions (with prefixed type):
for action in actions:
    var action_key: String = action.get("key", "")
    var action_label: String = action.get("label", action_key.capitalize())
    text += "[url=action:%s][u]%s[/u][/url]\n" % [action_key, action_label]

## For clickable NPCs/items in room descriptions:
var keyword: String = npc.get("primary_keyword", "")
var npc_key: String = npc.get("key", "")
if keyword != "" and npc_key != "":
    text = text.replace(keyword, "[url=npc:%s][u]%s[/u][/url]" % [npc_key, keyword])
```

### Step 2: Connect the meta_clicked signal

```gdscript
func _setup_viewports() -> void:
    # ... create label ...
    label = RichTextLabel.new()
    label.bbcode_enabled = true
    label.meta_clicked.connect(_on_label_meta_clicked)
```

### Step 3: Forward 3D clicks to SubViewport

```gdscript
## When click detected on 3D mesh, convert to viewport coordinates and forward
func _handle_page_click(screen_pos: Vector2) -> void:
    # ... raycast to get UV coordinates ...
    # ... convert UV to viewport pixel coordinates (vp_x, vp_y) ...

    # Forward to SubViewport for meta detection
    _forward_click_to_text_viewport(vp_x, vp_y)

func _forward_click_to_text_viewport(vp_x: float, vp_y: float) -> void:
    # Create synthetic mouse button press event
    var press_event := InputEventMouseButton.new()
    press_event.button_index = MOUSE_BUTTON_LEFT
    press_event.pressed = true
    press_event.position = Vector2(vp_x, vp_y)
    press_event.global_position = Vector2(vp_x, vp_y)

    # Push to SubViewport - triggers meta_clicked on RichTextLabel
    text_viewport.push_input(press_event)

    # Also send release event
    var release_event := InputEventMouseButton.new()
    release_event.button_index = MOUSE_BUTTON_LEFT
    release_event.pressed = false
    release_event.position = Vector2(vp_x, vp_y)
    release_event.global_position = Vector2(vp_x, vp_y)
    text_viewport.push_input(release_event)
```

### Step 4: Handle meta clicks by type

```gdscript
func _on_label_meta_clicked(meta: Variant) -> void:
    var meta_str: String = str(meta)

    match current_page:
        PageType.DIALOGUE:
            # Meta is choice index (integer)
            var choice_index: int = int(meta)
            _select_dialogue_choice(choice_index)

        PageType.ENTITY:
            # Meta format: "action:action_key"
            if meta_str.begins_with("action:"):
                var action_key: String = meta_str.substr(7)
                _execute_entity_action(action_key)

        PageType.ROOM:
            # Meta format: "npc:key" or "item:key"
            if meta_str.begins_with("npc:"):
                _select_npc_by_key(meta_str.substr(4))
            elif meta_str.begins_with("item:"):
                _select_item_by_key(meta_str.substr(5))
```

## Meta Value Conventions

Use prefixed strings to distinguish click types:
- `0`, `1`, `2` - Dialogue choice indices (integers)
- `action:talk`, `action:leave` - Entity actions
- `npc:novice_pema` - Clickable NPC by key
- `item:rusty_sword` - Clickable item by key
- `-1` - Special "Continue" action (end dialogue)

## Benefits

1. **100% accurate** - Godot calculates hit areas based on actual text geometry
2. **Works with any font/size** - No hardcoded pixel positions
3. **Handles text wrapping** - Click detection follows wrapped text
4. **Self-documenting** - Meta values describe what they do
5. **Easy debugging** - Print meta value to see what was clicked

## When to Use

- Any SubViewport text displayed on a 3D mesh
- Dialogue systems with clickable choices
- Interactive book/scroll/terminal UIs
- Any scenario where position-based click detection is unreliable

## Files Using This Pattern

- `godot-client/scripts/book_page.gd` - Dialogue, entity actions, room content
