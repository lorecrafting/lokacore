## Mock world data for testing without server connection.
## Provides test rooms, items, and NPCs for local development.
extends Node

## NPC data structure
class NPC:
	var id: String               # Entity UUID from database (for server lookups)
	var key: String              # Prototype key (e.g., "novice_pema")
	var name: String
	var primary_keyword: String  # Clickable keyword shown underlined in room
	var long_desc: String        # One-liner shown in room (should contain primary_keyword)
	var description: String      # Full description shown on entity details page

	func _init(p_id: String, p_key: String, p_name: String, p_keyword: String, p_long_desc: String = "", p_description: String = "") -> void:
		id = p_id
		key = p_key
		name = p_name
		primary_keyword = p_keyword
		long_desc = p_long_desc
		description = p_description if p_description != "" else p_long_desc


## Item data structure
class Item:
	var id: String               # Entity UUID from database (for server lookups)
	var key: String              # Prototype key
	var name: String
	var primary_keyword: String  # Clickable keyword shown underlined in room
	var long_desc: String        # One-liner shown in room (should contain primary_keyword)
	var description: String      # Full description shown on entity details page

	func _init(p_id: String, p_key: String, p_name: String, p_keyword: String, p_long_desc: String = "", p_description: String = "") -> void:
		id = p_id
		key = p_key
		name = p_name
		primary_keyword = p_keyword
		long_desc = p_long_desc
		description = p_description if p_description != "" else p_long_desc


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
		[NPC.new("gate_guard", "gate_guard", "Silent Guardian", "monk", "A weathered monk stands watch, his eyes reflecting years of vigilance.", "The Silent Guardian has spent decades at this gate, watching the seasons change and pilgrims come and go. His eyes hold a quiet wisdom, and though he rarely speaks, his presence alone offers both welcome and warning.")],
		[Item.new("prayer_flags", "prayer_flags", "Faded Prayer Flags", "flags", "Colorful prayer flags flutter in the breeze.", "These prayer flags have weathered countless storms, their colors faded but their purpose undiminished. Each flutter sends blessings into the mountain wind.")]
	)

	# Courtyard - Central hub
	rooms["courtyard"] = Room.new(
		"courtyard",
		"Monastery Courtyard",
		"A serene open space surrounded by aged wooden buildings with curved eaves. A small fountain bubbles at the center, its water crystal clear. Monks in saffron robes pass quietly, some carrying scrolls, others deep in meditation.",
		{"south": "monastery_gate", "north": "temple_entrance", "east": "meditation_hall", "west": "dormitory"},
		[
			NPC.new("elder_monk", "elder_monk", "Elder Thubten", "elder", "An ancient elder with kind eyes sits on a stone bench.", "Elder Thubten is one of the oldest monks in the monastery. His wrinkled face tells stories of a lifetime spent in contemplation and service. Despite his age, his eyes sparkle with gentle humor and profound wisdom."),
			NPC.new("young_novice", "young_novice", "Novice Pema", "novice", "A young novice sweeps the courtyard with careful attention.", "Novice Pema arrived at the monastery just three seasons ago. Though young, there is a seriousness about her that belies her years. She attends to her duties with unwavering focus.")
		],
		[Item.new("stone_fountain", "stone_fountain", "Stone Fountain", "fountain", "A stone fountain bubbles gently at the center.", "This ancient fountain has stood at the heart of the courtyard for centuries. Its crystal-clear water is said to have healing properties, though the monks attribute this to the serenity it inspires.")]
	)

	# Temple Entrance
	rooms["temple_entrance"] = Room.new(
		"temple_entrance",
		"Temple Entrance",
		"Massive bronze doors stand open, revealing flickering candlelight within. Incense smoke curls through the air, carrying the scent of sandalwood. Stone guardians flank the entrance, their weathered faces watching all who pass.",
		{"south": "courtyard", "north": "inner_sanctum"},
		[NPC.new("incense_keeper", "incense_keeper", "Incense Keeper", "keeper", "A serene keeper tends the burning incense with quiet devotion.", "The Incense Keeper moves with practiced grace, selecting each stick of incense with care. His robes carry the fragrance of sandalwood and cedar, a scent that has become part of him over years of service.")],
		[Item.new("bronze_doors", "bronze_doors", "Bronze Temple Doors", "doors", "Ancient bronze doors are covered in sacred inscriptions.", "These massive bronze doors have stood for over five hundred years. Their surface is covered in intricate inscriptions—prayers and mantras worn smooth by countless reverent touches.")]
	)

	# Inner Sanctum
	rooms["inner_sanctum"] = Room.new(
		"inner_sanctum",
		"Inner Sanctum",
		"Golden light filters through high windows, illuminating a massive bronze statue of the Awakened One. Offerings of flowers and fruit rest at its base. The air feels thick with accumulated prayers and centuries of devotion.",
		{"south": "temple_entrance"},
		[NPC.new("head_abbot", "head_abbot", "Abbot Dorje", "abbot", "The abbot meditates before the great statue, unmoved by your presence.", "Abbot Dorje has led this monastery for thirty years. His stillness is legendary—it is said he once sat in meditation for seven days without moving. His guidance is sought by monks and travelers alike.")],
		[
			Item.new("bronze_statue", "bronze_statue", "Bronze Statue", "statue", "A towering bronze statue of the Awakened One dominates the room.", "This magnificent bronze statue depicts the Awakened One in deep meditation. It stands three times the height of a person, its serene expression unchanged for centuries."),
			Item.new("offering_bowl", "offering_bowl", "Offering Bowl", "bowl", "An offering bowl filled with fruit and flowers rests at the base.", "Fresh offerings fill this ornate bowl—ripe fruits and fragrant flowers brought by devotees. The bowl itself is ancient silver, polished by generations of hands.")
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
			Item.new("meditation_cushion", "meditation_cushion", "Meditation Cushion", "cushion", "A well-worn cushion sits ready for meditation.", "This cushion has supported countless hours of meditation. Its fabric is worn soft, molded by years of use into a perfect seat for contemplation."),
			Item.new("calligraphy_scroll", "calligraphy_scroll", "Calligraphy Scroll", "scroll", "A calligraphy scroll hangs on the wall, depicting a mountain.", "A single mountain rises from mist in bold brushstrokes. Below it, three characters spell out a teaching: 'Be like the mountain—still, patient, enduring.'")
		]
	)

	# Library
	rooms["library"] = Room.new(
		"library",
		"Monastery Library",
		"Towering shelves hold countless scrolls and bound texts, their spines cracked with age. Dust motes dance in shafts of light from narrow windows. A elderly monk sits at a low desk, carefully copying an ancient manuscript.",
		{"south": "meditation_hall"},
		[NPC.new("scribe_monk", "scribe_monk", "Scribe Lobsang", "scribe", "An elderly scribe peers at you through thick spectacles.", "Scribe Lobsang has copied more texts than anyone can count. His fingers are permanently stained with ink, and his eyesight grows dim, but his dedication never wavers. He is a living connection to generations of knowledge.")],
		[
			Item.new("ancient_scroll", "ancient_scroll", "Ancient Scroll", "scroll", "A yellowed scroll with faded text lies on a shelf.", "This scroll dates back centuries, its edges crumbling despite careful preservation. The text speaks of meditation techniques long forgotten by most practitioners."),
			Item.new("writing_desk", "writing_desk", "Writing Desk", "desk", "A writing desk is covered in brushes, ink, and parchment.", "An orderly chaos covers this desk—brushes of various sizes, ink stones worn smooth, and stacks of parchment awaiting the scribe's careful hand.")
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
