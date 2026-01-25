//! Test world data - 5 interconnected rooms for development
//!
//! Layout:
//!                    [Temple]
//!                       |
//!   [Garden] -- [Courtyard] -- [Training Hall]
//!                       |
//!                   [Library]

use super::*;

/// Get the complete test world
pub fn get_test_world() -> std::collections::HashMap<String, Room> {
    let mut world = std::collections::HashMap::new();

    world.insert("courtyard".into(), courtyard());
    world.insert("temple".into(), temple());
    world.insert("garden".into(), garden());
    world.insert("training_hall".into(), training_hall());
    world.insert("library".into(), library());

    world
}

/// Get initial game state starting in the courtyard
pub fn get_initial_game_state() -> GameState {
    GameState {
        room: courtyard(),
        events: initial_events(),
        player: PlayerStats::default(),
    }
}

/// Get a room by key
pub fn get_room(key: &str) -> Option<Room> {
    match key {
        "courtyard" => Some(courtyard()),
        "temple" => Some(temple()),
        "garden" => Some(garden()),
        "training_hall" => Some(training_hall()),
        "library" => Some(library()),
        _ => None,
    }
}

// ============================================================================
// ROOM DEFINITIONS
// ============================================================================

fn courtyard() -> Room {
    Room {
        key: "courtyard".into(),
        name: "Monastery Courtyard".into(),
        description: "Sunlight filters through ancient cherry trees, casting dappled shadows across weathered stone. The courtyard sits at the heart of the monastery, a peaceful crossroads where paths lead in all directions. A gentle breeze carries the scent of incense from the temple to the north.\n\nA stone fountain burbles quietly in the center, its water crystal clear.".into(),
        exits: vec![
            Exit {
                direction: "north".into(),
                destination: "temple".into(),
                label: Some("Temple Entrance".into()),
                locked: false,
            },
            Exit {
                direction: "east".into(),
                destination: "training_hall".into(),
                label: Some("Training Hall".into()),
                locked: false,
            },
            Exit {
                direction: "west".into(),
                destination: "garden".into(),
                label: Some("Meditation Garden".into()),
                locked: false,
            },
            Exit {
                direction: "south".into(),
                destination: "library".into(),
                label: Some("Ancient Library".into()),
                locked: false,
            },
        ],
        npcs: vec![
            Npc {
                key: "elder_ming".into(),
                name: "Elder Ming".into(),
                short_desc: "An elderly monk in saffron robes stands near the fountain, feeding the koi.".into(),
                actions: vec![
                    Action {
                        id: "talk_elder_ming".into(),
                        label: "Speak with Elder Ming".into(),
                        action_type: ActionType::Talk,
                        icon: Some("speech".into()),
                    },
                    Action {
                        id: "look_elder_ming".into(),
                        label: "Observe the Elder".into(),
                        action_type: ActionType::Look,
                        icon: Some("eye".into()),
                    },
                ],
            },
        ],
        items: vec![
            Item {
                key: "fallen_blossom".into(),
                name: "Cherry Blossom".into(),
                short_desc: "A delicate pink blossom has fallen near the fountain's edge.".into(),
                actions: vec![
                    Action {
                        id: "take_blossom".into(),
                        label: "Pick up the blossom".into(),
                        action_type: ActionType::Take,
                        icon: Some("hand".into()),
                    },
                ],
            },
        ],
        ambient: Some("Cherry petals drift lazily on the breeze.".into()),
    }
}

fn temple() -> Room {
    Room {
        key: "temple".into(),
        name: "Temple of Silent Wisdom".into(),
        description: "Towering pillars rise into shadow, supporting a ceiling lost in darkness above. Hundreds of candles flicker on tiered altars, their light dancing across a massive bronze statue of the Awakened One. The air is thick with sandalwood incense.\n\nMonks kneel in silent meditation along the walls, their breathing barely audible.".into(),
        exits: vec![
            Exit {
                direction: "south".into(),
                destination: "courtyard".into(),
                label: Some("Return to Courtyard".into()),
                locked: false,
            },
        ],
        npcs: vec![
            Npc {
                key: "abbot_chen".into(),
                name: "Abbot Chen".into(),
                short_desc: "The Abbot sits before the great statue, deep in meditation. His presence radiates calm authority.".into(),
                actions: vec![
                    Action {
                        id: "talk_abbot".into(),
                        label: "Approach the Abbot".into(),
                        action_type: ActionType::Talk,
                        icon: Some("speech".into()),
                    },
                    Action {
                        id: "meditate_abbot".into(),
                        label: "Meditate nearby".into(),
                        action_type: ActionType::Custom("meditate".into()),
                        icon: Some("lotus".into()),
                    },
                ],
            },
        ],
        items: vec![
            Item {
                key: "prayer_beads".into(),
                name: "Jade Prayer Beads".into(),
                short_desc: "A string of jade beads rests on a meditation cushion, apparently forgotten.".into(),
                actions: vec![
                    Action {
                        id: "take_beads".into(),
                        label: "Take the prayer beads".into(),
                        action_type: ActionType::Take,
                        icon: Some("hand".into()),
                    },
                    Action {
                        id: "examine_beads".into(),
                        label: "Examine the beads".into(),
                        action_type: ActionType::Look,
                        icon: Some("eye".into()),
                    },
                ],
            },
        ],
        ambient: Some("Incense smoke curls upward in lazy spirals.".into()),
    }
}

fn garden() -> Room {
    Room {
        key: "garden".into(),
        name: "Meditation Garden".into(),
        description: "Carefully raked sand surrounds islands of moss-covered stones in this serene garden. A single ancient pine, twisted by centuries of wind, dominates the western corner. The sound of a distant wind chime carries on the breeze.\n\nStone lanterns mark a winding path through beds of carefully tended herbs.".into(),
        exits: vec![
            Exit {
                direction: "east".into(),
                destination: "courtyard".into(),
                label: Some("Return to Courtyard".into()),
                locked: false,
            },
        ],
        npcs: vec![
            Npc {
                key: "novice_lin".into(),
                name: "Novice Lin".into(),
                short_desc: "A young novice tends to the herb garden, humming softly to herself.".into(),
                actions: vec![
                    Action {
                        id: "talk_lin".into(),
                        label: "Talk to Novice Lin".into(),
                        action_type: ActionType::Talk,
                        icon: Some("speech".into()),
                    },
                    Action {
                        id: "help_lin".into(),
                        label: "Offer to help with gardening".into(),
                        action_type: ActionType::Custom("help".into()),
                        icon: Some("hands".into()),
                    },
                ],
            },
        ],
        items: vec![
            Item {
                key: "healing_herbs".into(),
                name: "Healing Herbs".into(),
                short_desc: "A bundle of freshly cut herbs sits in a basket, emanating a pleasant aroma.".into(),
                actions: vec![
                    Action {
                        id: "take_herbs".into(),
                        label: "Take some herbs".into(),
                        action_type: ActionType::Take,
                        icon: Some("hand".into()),
                    },
                ],
            },
            Item {
                key: "stone_lantern".into(),
                name: "Ancient Stone Lantern".into(),
                short_desc: "One of the stone lanterns bears weathered inscriptions on its base.".into(),
                actions: vec![
                    Action {
                        id: "read_lantern".into(),
                        label: "Read the inscriptions".into(),
                        action_type: ActionType::Look,
                        icon: Some("scroll".into()),
                    },
                ],
            },
        ],
        ambient: Some("Wind chimes sing in the distance.".into()),
    }
}

fn training_hall() -> Room {
    Room {
        key: "training_hall".into(),
        name: "Training Hall".into(),
        description: "The wooden floor bears the scuff marks of countless practice sessions. Weapon racks line the walls, holding an array of staffs, wooden swords, and training dummies. Morning light streams through high windows, illuminating dust motes dancing in the air.\n\nThe smell of sweat and wood polish hangs in the air.".into(),
        exits: vec![
            Exit {
                direction: "west".into(),
                destination: "courtyard".into(),
                label: Some("Return to Courtyard".into()),
                locked: false,
            },
        ],
        npcs: vec![
            Npc {
                key: "master_wong".into(),
                name: "Master Wong".into(),
                short_desc: "A muscular woman in training garb practices forms with a wooden staff, her movements fluid and precise.".into(),
                actions: vec![
                    Action {
                        id: "talk_wong".into(),
                        label: "Request training".into(),
                        action_type: ActionType::Talk,
                        icon: Some("speech".into()),
                    },
                    Action {
                        id: "spar_wong".into(),
                        label: "Challenge to a spar".into(),
                        action_type: ActionType::Attack,
                        icon: Some("swords".into()),
                    },
                    Action {
                        id: "watch_wong".into(),
                        label: "Watch her technique".into(),
                        action_type: ActionType::Look,
                        icon: Some("eye".into()),
                    },
                ],
            },
            Npc {
                key: "training_dummy".into(),
                name: "Training Dummy".into(),
                short_desc: "A well-worn training dummy stands ready for practice.".into(),
                actions: vec![
                    Action {
                        id: "attack_dummy".into(),
                        label: "Practice strikes".into(),
                        action_type: ActionType::Attack,
                        icon: Some("fist".into()),
                    },
                ],
            },
        ],
        items: vec![
            Item {
                key: "training_staff".into(),
                name: "Training Staff".into(),
                short_desc: "A balanced wooden staff leans against the weapon rack.".into(),
                actions: vec![
                    Action {
                        id: "take_staff".into(),
                        label: "Take the staff".into(),
                        action_type: ActionType::Take,
                        icon: Some("hand".into()),
                    },
                    Action {
                        id: "examine_staff".into(),
                        label: "Test its balance".into(),
                        action_type: ActionType::Look,
                        icon: Some("eye".into()),
                    },
                ],
            },
        ],
        ambient: Some("The rhythmic thwack of staff against dummy echoes through the hall.".into()),
    }
}

fn library() -> Room {
    Room {
        key: "library".into(),
        name: "Ancient Library".into(),
        description: "Floor-to-ceiling shelves hold thousands of scrolls and leather-bound tomes, their spines faded with age. Ladders on brass rails provide access to the upper reaches. Shafts of dusty light fall from narrow windows onto reading desks covered in open books.\n\nThe musty smell of old paper and binding glue fills the air.".into(),
        exits: vec![
            Exit {
                direction: "north".into(),
                destination: "courtyard".into(),
                label: Some("Return to Courtyard".into()),
                locked: false,
            },
        ],
        npcs: vec![
            Npc {
                key: "scribe_wei".into(),
                name: "Scribe Wei".into(),
                short_desc: "An elderly scribe hunches over a desk, carefully copying text with a fine brush.".into(),
                actions: vec![
                    Action {
                        id: "talk_wei".into(),
                        label: "Ask about the archives".into(),
                        action_type: ActionType::Talk,
                        icon: Some("speech".into()),
                    },
                    Action {
                        id: "help_wei".into(),
                        label: "Offer to help with copying".into(),
                        action_type: ActionType::Custom("help".into()),
                        icon: Some("quill".into()),
                    },
                ],
            },
        ],
        items: vec![
            Item {
                key: "old_map".into(),
                name: "Faded Map".into(),
                short_desc: "A partially unrolled map shows the monastery grounds as they appeared centuries ago.".into(),
                actions: vec![
                    Action {
                        id: "examine_map".into(),
                        label: "Study the old map".into(),
                        action_type: ActionType::Look,
                        icon: Some("map".into()),
                    },
                    Action {
                        id: "take_map".into(),
                        label: "Take the map".into(),
                        action_type: ActionType::Take,
                        icon: Some("hand".into()),
                    },
                ],
            },
            Item {
                key: "technique_scroll".into(),
                name: "Martial Technique Scroll".into(),
                short_desc: "A scroll marked 'Iron Palm Technique' sits atop a stack of documents.".into(),
                actions: vec![
                    Action {
                        id: "read_scroll".into(),
                        label: "Read the technique".into(),
                        action_type: ActionType::Look,
                        icon: Some("scroll".into()),
                    },
                    Action {
                        id: "take_scroll".into(),
                        label: "Take the scroll".into(),
                        action_type: ActionType::Take,
                        icon: Some("hand".into()),
                    },
                ],
            },
        ],
        ambient: Some("Pages rustle as Scribe Wei turns them carefully.".into()),
    }
}

// ============================================================================
// EVENT FEED
// ============================================================================

fn initial_events() -> Vec<GameEvent> {
    vec![
        GameEvent {
            id: 1,
            event_type: EventType::System,
            text: "Welcome back to the monastery.".into(),
            timestamp: 0.0,
        },
        GameEvent {
            id: 2,
            event_type: EventType::Narration,
            text: "The morning bell has rung, calling the monks to meditation.".into(),
            timestamp: 1.0,
        },
        GameEvent {
            id: 3,
            event_type: EventType::Ambient,
            text: "Cherry blossoms drift on the gentle breeze.".into(),
            timestamp: 3.0,
        },
        GameEvent {
            id: 4,
            event_type: EventType::Speech,
            text: "Elder Ming nods in greeting as you enter the courtyard.".into(),
            timestamp: 5.0,
        },
    ]
}

/// Generate a movement event
pub fn movement_event(from: &str, to: &str, timestamp: f32) -> GameEvent {
    GameEvent {
        id: (timestamp * 1000.0) as u64,
        event_type: EventType::Action,
        text: format!("You leave {} and enter {}.", from, to),
        timestamp,
    }
}

/// Generate a look event
pub fn look_event(target: &str, timestamp: f32) -> GameEvent {
    GameEvent {
        id: (timestamp * 1000.0) as u64,
        event_type: EventType::Action,
        text: format!("You examine {}.", target),
        timestamp,
    }
}

/// Generate a speech event
pub fn speech_event(speaker: &str, text: &str, timestamp: f32) -> GameEvent {
    GameEvent {
        id: (timestamp * 1000.0) as u64,
        event_type: EventType::Speech,
        text: format!("{} says: \"{}\"", speaker, text),
        timestamp,
    }
}

/// Generate a take event
pub fn take_event(item: &str, timestamp: f32) -> GameEvent {
    GameEvent {
        id: (timestamp * 1000.0) as u64,
        event_type: EventType::Action,
        text: format!("You pick up the {}.", item),
        timestamp,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_rooms_accessible() {
        let world = get_test_world();
        assert_eq!(world.len(), 5);

        // Verify all rooms have at least one exit
        for (key, room) in &world {
            assert!(!room.exits.is_empty(), "Room {} has no exits", key);
        }
    }

    #[test]
    fn test_exits_are_bidirectional() {
        let world = get_test_world();

        // Check that every exit leads to a valid room
        for (key, room) in &world {
            for exit in &room.exits {
                assert!(
                    world.contains_key(&exit.destination),
                    "Room {} has exit to non-existent room {}",
                    key,
                    exit.destination
                );
            }
        }
    }

    #[test]
    fn test_initial_game_state() {
        let state = get_initial_game_state();
        assert_eq!(state.room.key, "courtyard");
        assert!(!state.events.is_empty());
    }

    #[test]
    fn test_courtyard_connects_to_all() {
        let courtyard = courtyard();
        assert_eq!(courtyard.exits.len(), 4, "Courtyard should connect to all 4 other rooms");
    }
}
