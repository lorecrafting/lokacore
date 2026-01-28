# Godot JavaScript Bridge Callbacks

## Problem

When creating JavaScript callbacks in Godot 4 web exports using `JavaScriptBridge.create_callback()`, the callbacks stop working after a short time because they get garbage collected.

## Symptoms

- JavaScript correctly calls `window.myCallback(args)`
- Console shows the JS-side log but no GDScript print
- Godot may restart/crash when callback is invoked
- Works initially, then stops working

## Root Cause

`JavaScriptBridge.create_callback()` returns a `JavaScriptObject` that must be kept alive. If stored only in a local variable, Godot's GC may collect it.

## Solution

**Store callbacks in member variables to prevent garbage collection:**

```gdscript
# ❌ WRONG - callback gets garbage collected
func _setup_javascript_callbacks() -> void:
    var callback := JavaScriptBridge.create_callback(_on_js_event)
    var window := JavaScriptBridge.get_interface("window")
    window.myCallback = callback  # callback may be GC'd!

# ✅ CORRECT - store in member variable
var _js_callback: JavaScriptObject  # Member variable

func _setup_javascript_callbacks() -> void:
    _js_callback = JavaScriptBridge.create_callback(_on_js_event)
    var window := JavaScriptBridge.get_interface("window")
    window.myCallback = _js_callback  # stays alive

func _on_js_event(args: Array) -> void:
    print("Called from JS with: ", args)
```

## Full Pattern for Multiple Callbacks

```gdscript
extends Node

# Store ALL callbacks as member variables
var _js_effect_callback: JavaScriptObject
var _js_action_callback: JavaScriptObject

func _ready() -> void:
    _setup_javascript_callbacks()

func _setup_javascript_callbacks() -> void:
    if not OS.has_feature("web"):
        return

    # Create and store callbacks
    _js_effect_callback = JavaScriptBridge.create_callback(_on_js_effect)
    _js_action_callback = JavaScriptBridge.create_callback(_on_js_action)

    # Register on window object
    var window := JavaScriptBridge.get_interface("window")
    window.godotEffect = _js_effect_callback
    window.godotAction = _js_action_callback

    print("JavaScript callbacks registered")

func _on_js_effect(args: Array) -> void:
    if args.size() > 0:
        var effect_name: String = str(args[0])
        print("Effect triggered: ", effect_name)

func _on_js_action(args: Array) -> void:
    print("Action triggered with args: ", args)
```

## HTML Side

```html
<button onclick="triggerEffect('burn')">Burn</button>

<script>
window.triggerEffect = function(name) {
    if (window.godotEffect) {
        window.godotEffect(name);
    } else {
        console.warn('Godot callback not registered');
    }
};
</script>
```

## Debugging Tips

1. Add console.log on JS side to verify call reaches JS
2. Add print in GDScript callback to verify Godot receives it
3. If JS log appears but GDScript doesn't, callback was garbage collected
4. Check for Godot restart in console (indicates crash from invalid callback)

## When This Applies

- Godot 4.x web exports
- Any JavaScript → GDScript communication
- Custom HTML shells with interactive elements
- Debug toolbars, analytics, external integrations

## References

- Godot docs: JavaScriptBridge class
- Project example: `godot-client/scripts/book_page.gd` (debug toolbar callbacks)
