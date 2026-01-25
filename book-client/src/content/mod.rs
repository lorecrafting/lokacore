//! Content module - game data structures and test content
//!
//! Defines the data contract between React Native and the Rust renderer.
//! For development, provides hardcoded test rooms to iterate on rendering.

mod test_world;

pub use test_world::*;

use bevy::prelude::Resource;
use serde::{Deserialize, Serialize};

/// Complete game state for rendering a page
#[derive(Debug, Clone, Serialize, Deserialize, Resource)]
pub struct GameState {
    /// Current room the player is in
    pub room: Room,
    /// Recent game events (scrolling feed)
    pub events: Vec<GameEvent>,
    /// Player stats for header display
    pub player: PlayerStats,
}

/// A room with description, entities, and exits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub key: String,
    pub name: String,
    pub description: String,
    pub exits: Vec<Exit>,
    pub npcs: Vec<Npc>,
    pub items: Vec<Item>,
    /// Ambient text that occasionally appears
    pub ambient: Option<String>,
}

/// An exit to another room
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exit {
    pub direction: String,
    pub destination: String,
    /// Display name if different from direction
    pub label: Option<String>,
    /// True if locked/blocked
    pub locked: bool,
}

/// An NPC in the room
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Npc {
    pub key: String,
    pub name: String,
    pub short_desc: String,
    /// Available interactions
    pub actions: Vec<Action>,
}

/// An item in the room
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub key: String,
    pub name: String,
    pub short_desc: String,
    pub actions: Vec<Action>,
}

/// A clickable action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub id: String,
    pub label: String,
    pub action_type: ActionType,
    /// Icon hint for rendering
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ActionType {
    Move,      // Navigate to another room
    Look,      // Examine something
    Talk,      // Start dialogue
    Take,      // Pick up item
    Use,       // Use item/interact
    Attack,    // Combat
    Custom(String),
}

/// A game event for the scrolling feed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameEvent {
    pub id: u64,
    pub event_type: EventType,
    pub text: String,
    /// Timestamp in seconds since session start
    pub timestamp: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EventType {
    Narration,   // Story/description text
    Speech,      // NPC dialogue
    System,      // System messages
    Combat,      // Combat results
    Action,      // Player action confirmation
    Ambient,     // Ambient world events
}

/// Player stats for the header
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStats {
    pub name: String,
    pub health: u32,
    pub max_health: u32,
    pub mana: u32,
    pub max_mana: u32,
    pub level: u32,
}

impl Default for PlayerStats {
    fn default() -> Self {
        Self {
            name: "Wanderer".into(),
            health: 85,
            max_health: 100,
            mana: 40,
            max_mana: 50,
            level: 3,
        }
    }
}

/// Resource tracking pending navigation (for page turn flow)
#[derive(Debug, Clone, Resource, Default)]
pub struct NavigationState {
    /// The room we're navigating to (shown on NextPage during turn)
    pub pending_room: Option<Room>,
    /// Whether the pending room has been rendered to NextPage
    pub next_page_ready: bool,
}

impl NavigationState {
    /// Start navigation to a new room
    pub fn start_navigation(&mut self, destination: Room) {
        self.pending_room = Some(destination);
        self.next_page_ready = false;
    }

    /// Complete navigation - clears pending state
    pub fn complete_navigation(&mut self) -> Option<Room> {
        self.next_page_ready = false;
        self.pending_room.take()
    }

    /// Check if we have a pending navigation
    pub fn has_pending(&self) -> bool {
        self.pending_room.is_some()
    }
}
