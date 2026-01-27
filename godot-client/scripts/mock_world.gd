## Mock world data for testing without server connection.
## Provides test rooms, items, and NPCs for local development.
extends Node

## NPC data structure
class NPC:
	var key: String
	var name: String
	var short_desc: String

	func _init(p_key: String, p_name: String, p_short_desc: String = "") -> void:
		key = p_key
		name = p_name
		short_desc = p_short_desc


## Item data structure
class Item:
	var key: String
	var name: String
	var short_desc: String

	func _init(p_key: String, p_name: String, p_short_desc: String = "") -> void:
		key = p_key
		name = p_name
		short_desc = p_short_desc


## Room data structure
class Room:
	var key: String
	var name: String
	var description: String
	var exits: Dictionary  # direction -> room_key
	var npcs: Array[NPC]
	var items: Array[Item]

	func _init(p_key: String, p_name: String, p_description: String, p_exits: Dictionary = {}, p_npcs: Array[NPC] = [], p_items: Array[Item] = []) -> void:
		key = p_key
		name = p_name
		description = p_description
		exits = p_exits
		npcs = p_npcs
		items = p_items

## All mock rooms indexed by key
var rooms: Dictionary = {}

## Starting room key
var start_room: String = "monastery_gate"

## Mock player data for offline mode
var _mock_player_name: String = "Wanderer"
var _mock_player_stats: Dictionary = {
	"level": 1,
	"hp": 85,
	"max_hp": 100,
	"experience": 150,
	"next_level_xp": 500
}
var _mock_inventory: Array = [
	{"key": "worn_sandals", "name": "Worn Sandals", "quantity": 1},
	{"key": "meditation_beads", "name": "Meditation Beads", "quantity": 1},
	{"key": "healing_herb", "name": "Healing Herb", "quantity": 3},
	{"key": "copper_coins", "name": "Copper Coins", "quantity": 12}
]


func _ready() -> void:
	_setup_monastery_rooms()


func _setup_monastery_rooms() -> void:
	# Monastery Gate - Entry point
	rooms["monastery_gate"] = Room.new(
		"monastery_gate",
		"Monastery Gate [OFFLINE]",
		"[OFFLINE MODE] Ancient stone pillars frame a weathered wooden gate. Prayer flags flutter in the mountain breeze, their faded colors catching the morning light. The path ahead leads into a peaceful courtyard, while misty peaks rise in the distance.",
		{"north": "courtyard", "east": "garden_path"},
		[NPC.new("gate_guard", "Silent Guardian", "A weathered monk stands watch, his eyes reflecting years of vigilance.")],
		[Item.new("prayer_flags", "Faded Prayer Flags", "Colorful fabric flutters in the breeze.")]
	)

	# Courtyard - Central hub
	rooms["courtyard"] = Room.new(
		"courtyard",
		"Monastery Courtyard",
		"A serene open space surrounded by aged wooden buildings with curved eaves. A small fountain bubbles at the center, its water crystal clear. Monks in saffron robes pass quietly, some carrying scrolls, others deep in meditation.",
		{"south": "monastery_gate", "north": "temple_entrance", "east": "meditation_hall", "west": "dormitory"},
		[
			NPC.new("elder_monk", "Elder Thubten", "An ancient monk with kind eyes sits on a stone bench."),
			NPC.new("young_novice", "Novice Pema", "A young novice sweeps the courtyard with careful attention.")
		],
		[Item.new("stone_fountain", "Stone Fountain", "Clear water bubbles gently.")]
	)

	# Temple Entrance
	rooms["temple_entrance"] = Room.new(
		"temple_entrance",
		"Temple Entrance",
		"Massive bronze doors stand open, revealing flickering candlelight within. Incense smoke curls through the air, carrying the scent of sandalwood. Stone guardians flank the entrance, their weathered faces watching all who pass.",
		{"south": "courtyard", "north": "inner_sanctum"},
		[NPC.new("incense_keeper", "Incense Keeper", "A serene monk tends the burning incense with quiet devotion.")],
		[Item.new("bronze_doors", "Bronze Temple Doors", "Ancient doors covered in sacred inscriptions.")]
	)

	# Inner Sanctum
	rooms["inner_sanctum"] = Room.new(
		"inner_sanctum",
		"Inner Sanctum",
		"Golden light filters through high windows, illuminating a massive bronze statue of the Awakened One. Offerings of flowers and fruit rest at its base. The air feels thick with accumulated prayers and centuries of devotion.",
		{"south": "temple_entrance"},
		[NPC.new("head_abbot", "Abbot Dorje", "The head abbot meditates before the great statue, unmoved by your presence.")],
		[
			Item.new("bronze_statue", "Bronze Statue", "A towering figure of the Awakened One."),
			Item.new("offering_bowl", "Offering Bowl", "Filled with fruit and flowers.")
		]
	)

	# Meditation Hall
	rooms["meditation_hall"] = Room.new(
		"meditation_hall",
		"Meditation Hall",
		"Rows of cushions line a polished wooden floor. The walls are bare except for a single calligraphy scroll. Silence hangs heavy here, broken only by the distant chime of a temple bell.",
		{"west": "courtyard", "north": "library"},
		[],
		[
			Item.new("meditation_cushion", "Meditation Cushion", "A well-worn cushion for sitting."),
			Item.new("calligraphy_scroll", "Calligraphy Scroll", "Ancient brushwork depicting a mountain.")
		]
	)

	# Library
	rooms["library"] = Room.new(
		"library",
		"Monastery Library",
		"Towering shelves hold countless scrolls and bound texts, their spines cracked with age. Dust motes dance in shafts of light from narrow windows. A elderly monk sits at a low desk, carefully copying an ancient manuscript.",
		{"south": "meditation_hall"},
		[NPC.new("scribe_monk", "Scribe Lobsang", "The elderly scribe peers at you through thick spectacles.")],
		[
			Item.new("ancient_scroll", "Ancient Scroll", "A yellowed scroll with faded text."),
			Item.new("writing_desk", "Writing Desk", "Covered in brushes, ink, and parchment.")
		]
	)

	# Dormitory
	rooms["dormitory"] = Room.new(
		"dormitory",
		"Monk's Dormitory",
		"Simple wooden beds line the walls, each with a small chest for personal belongings. The air smells of cedar and clean linens. A single candle burns at a small shrine near the entrance.",
		{"east": "courtyard", "north": "kitchen"}
	)

	# Kitchen
	rooms["kitchen"] = Room.new(
		"kitchen",
		"Monastery Kitchen",
		"Copper pots hang from ceiling hooks, and bundles of dried herbs dangle from the rafters. A large clay stove dominates one wall, its fire burning low. The aroma of vegetable stew fills the warm air.",
		{"south": "dormitory"}
	)

	# Garden Path
	rooms["garden_path"] = Room.new(
		"garden_path",
		"Garden Path",
		"A winding stone path meanders through carefully tended gardens. Medicinal herbs grow in neat rows, and a few fruit trees provide dappled shade. Butterflies flit between flowering bushes.",
		{"west": "monastery_gate", "north": "herb_garden"}
	)

	# Herb Garden
	rooms["herb_garden"] = Room.new(
		"herb_garden",
		"Herb Garden",
		"Rows of medicinal plants stretch before you, each marked with wooden signs bearing their names. A weathered monk tends the plants with careful attention, murmuring softly to each one.",
		{"south": "garden_path"}
	)


## Get a room by its key, returns null if not found
func get_room(room_key: String) -> Room:
	return rooms.get(room_key)


## Get all available room keys
func get_all_room_keys() -> Array:
	return rooms.keys()


## Check if a direction is valid from a given room
func can_go(from_room: String, direction: String) -> bool:
	var room := get_room(from_room)
	if room == null:
		return false
	return room.exits.has(direction)


## Get the destination room key for a direction, or empty string if invalid
func get_destination(from_room: String, direction: String) -> String:
	var room := get_room(from_room)
	if room == null or not room.exits.has(direction):
		return ""
	return room.exits[direction]


# =============================================================================
# Mock Player Data (for offline mode)
# =============================================================================

## Get mock player name
func get_player_name() -> String:
	return _mock_player_name


## Set mock player name (called when logging in offline)
func set_player_name(name: String) -> void:
	_mock_player_name = name


## Get mock player stats
func get_player_stats() -> Dictionary:
	return _mock_player_stats


## Get mock player inventory
func get_player_inventory() -> Array:
	return _mock_inventory
