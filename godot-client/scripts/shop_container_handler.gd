## Handles shop and container UI interactions.
## Extracted from book_page.gd for separation of concerns.
class_name ShopContainerHandler
extends RefCounted

# Color scheme
const TITLE_COLOR := "#2a1f14"
const BODY_COLOR := "#362816"
const ITEM_COLOR := "#3a2a1a"
const PRICE_COLOR := "#5a4a3a"
const GOLD_COLOR := "#8a6a2a"
const HINT_COLOR := "#5a4a3a"
const ACTION_COLOR := "#4a3828"


## Callback for adding events to the game log
var add_event_callback: Callable


## Initialize with event callback
func set_event_callback(callback: Callable) -> void:
	add_event_callback = callback


# =============================================================================
# Shop Rendering
# =============================================================================

## Render shop content to BBCode
func render_shop() -> String:
	var data: Dictionary = GameState.shop_data
	if data.is_empty():
		return "[center][i]Shop not available[/i][/center]"

	var npc_name: String = data.get("npc_name", "Merchant")
	var items: Array = data.get("items", [])
	var player_gold: int = GameState.server_state.get("resources", {}).get("gold", 0)

	var text := ""
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [TITLE_COLOR, npc_name]
	text += "[color=%s][i]\"What can I get for you today?\"[/i][/color]\n\n" % BODY_COLOR

	if items.is_empty():
		text += "[color=%s][i]No items for sale.[/i][/color]\n\n" % BODY_COLOR
	else:
		for i in range(items.size()):
			var item: Dictionary = items[i]
			var item_name: String = item.get("name", "Unknown Item")
			var price: int = item.get("price", 0)
			var can_afford: bool = player_gold >= price

			if can_afford:
				text += "[color=%s][url=shop:buy:%d]* %s[/url][/color]" % [ITEM_COLOR, i, item_name]
			else:
				text += "[color=%s]* %s[/color]" % [PRICE_COLOR, item_name]

			text += " [color=%s](%dg)[/color]\n\n" % [PRICE_COLOR, price]

	text += "[color=%s]-------------------[/color]\n" % PRICE_COLOR
	text += "[color=%s]Your Gold: [/color][color=%s]%d[/color]\n\n" % [BODY_COLOR, GOLD_COLOR, player_gold]

	text += "[color=%s][url=shop:close][u]Leave Shop[/u][/url][/color]" % ACTION_COLOR

	return text


# =============================================================================
# Shop Click Handling
# =============================================================================

## Handle shop click action
func handle_shop_click(action: String) -> void:
	if action == "close":
		GameState.close_shop()
		return

	if action.begins_with("buy:"):
		var index: int = int(action.substr(4))
		_buy_shop_item(index)


func _buy_shop_item(index: int) -> void:
	var items: Array = GameState.shop_data.get("items", [])
	if index < 0 or index >= items.size():
		return

	var item: Dictionary = items[index]
	var price: int = item.get("price", 0)
	var player_gold: int = GameState.server_state.get("resources", {}).get("gold", 0)

	if player_gold < price:
		if add_event_callback.is_valid():
			add_event_callback.call("You cannot afford that.")
		return

	if GameState.is_online:
		var phoenix: Node = Engine.get_main_loop().root.get_node_or_null("/root/PhoenixClient")
		if phoenix and phoenix.has_method("shop_action"):
			phoenix.shop_action("buy", index)
	else:
		if add_event_callback.is_valid():
			add_event_callback.call("Shopping requires server connection.")


# =============================================================================
# Container Rendering
# =============================================================================

## Render container content to BBCode
func render_container() -> String:
	var data: Dictionary = GameState.container_data
	if data.is_empty():
		return "[center][i]Container not available[/i][/center]"

	var entity_name: String = data.get("entity_name", "Container")
	var items: Array = data.get("items", [])

	var text := ""
	text += "[center][font_size=28][color=%s][b]%s[/b][/color][/font_size][/center]\n\n" % [TITLE_COLOR, entity_name]

	if items.is_empty():
		text += "[color=%s][i]Empty.[/i][/color]\n\n" % HINT_COLOR
	else:
		for i in range(items.size()):
			var item: Dictionary = items[i]
			var item_name: String = item.get("name", "Unknown Item")
			var qty: int = item.get("quantity", 1)

			if qty > 1:
				text += "[color=%s][url=container:take:%d]* %s (x%d)[/url][/color]\n\n" % [ITEM_COLOR, i, item_name, qty]
			else:
				text += "[color=%s][url=container:take:%d]* %s[/url][/color]\n\n" % [ITEM_COLOR, i, item_name]

	text += "[color=%s]-------------------[/color]\n\n" % HINT_COLOR

	if not items.is_empty():
		text += "[color=%s][url=container:take_all][u]Take All[/u][/url][/color]    " % ACTION_COLOR

	text += "[color=%s][url=container:close][u]Close[/u][/url][/color]" % ACTION_COLOR

	return text


# =============================================================================
# Container Click Handling
# =============================================================================

## Handle container click action
func handle_container_click(action: String) -> void:
	if action == "close":
		GameState.close_container()
		return

	if action == "take_all":
		_take_all_from_container()
		return

	if action.begins_with("take:"):
		var index: int = int(action.substr(5))
		_take_from_container(index)


func _take_from_container(index: int) -> void:
	var items: Array = GameState.container_data.get("items", [])
	if index < 0 or index >= items.size():
		return

	if GameState.is_online:
		var phoenix: Node = Engine.get_main_loop().root.get_node_or_null("/root/PhoenixClient")
		if phoenix and phoenix.has_method("container_action"):
			phoenix.container_action("take", index)
	else:
		if add_event_callback.is_valid():
			add_event_callback.call("Container interaction requires server connection.")


func _take_all_from_container() -> void:
	if GameState.is_online:
		var phoenix: Node = Engine.get_main_loop().root.get_node_or_null("/root/PhoenixClient")
		if phoenix and phoenix.has_method("container_action"):
			phoenix.container_action("take_all")
	else:
		if add_event_callback.is_valid():
			add_event_callback.call("Container interaction requires server connection.")
