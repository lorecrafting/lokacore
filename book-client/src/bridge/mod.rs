//! Uniffi bridge module for React Native ↔ Rust communication
//!
//! This module implements the interface defined in loka_book.udl

use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

/// Data types that match the .udl interface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TapResult {
    pub action_type: String,
    pub target: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStatsData {
    pub hp: u32,
    pub max_hp: u32,
    pub qi: u32,
    pub max_qi: u32,
    pub stamina: u32,
    pub max_stamina: u32,
    pub level: u32,
    pub xp: u32,
    pub xp_to_next_level: u32,
    pub gold: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogueStateData {
    pub entity_id: String,
    pub node_id: String,
    pub current_text: String,
    pub choices: Vec<DialogueChoiceData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogueChoiceData {
    pub id: String,
    pub text: String,
}

// Include uniffi scaffolding
uniffi::include_scaffolding!("loka_book");

/// Main bridge implementation
pub struct LokaBookBridge {
    // Internal state (will connect to Bevy systems in future)
    state: Arc<Mutex<BridgeState>>,
}

struct BridgeState {
    current_page_content: String,
    player_stats: PlayerStatsData,
    available_exits: Vec<String>,
    current_menu_tab: Option<String>,
    dialogue_state: Option<DialogueStateData>,
}

impl Default for BridgeState {
    fn default() -> Self {
        Self {
            current_page_content: "Welcome to Loka".to_string(),
            player_stats: PlayerStatsData {
                hp: 100,
                max_hp: 100,
                qi: 50,
                max_qi: 50,
                stamina: 80,
                max_stamina: 80,
                level: 1,
                xp: 0,
                xp_to_next_level: 100,
                gold: 0,
            },
            available_exits: vec!["north".to_string(), "south".to_string()],
            current_menu_tab: None,
            dialogue_state: None,
        }
    }
}

impl LokaBookBridge {
    fn new() -> Self {
        log::info!("Creating LokaBookBridge");
        Self {
            state: Arc::new(Mutex::new(BridgeState::default())),
        }
    }

    // === Game State Updates ===

    pub fn update_game_state(&self, json_payload: String) {
        log::info!("update_game_state: {}", json_payload);
        // TODO: Parse JSON and update internal state
        // This will eventually update Bevy resources
    }

    pub fn update_room(&self, json_payload: String) {
        log::info!("update_room: {}", json_payload);
        // TODO: Parse room data and update page content
    }

    pub fn add_event(&self, text: String, event_type: Option<String>) {
        log::info!("add_event: {} (type: {:?})", text, event_type);
        // TODO: Add to event log/history
    }

    // === Dialogue System ===

    pub fn start_dialogue(
        &self,
        entity_id: String,
        node_id: String,
        text: String,
        choices_json: String,
    ) {
        log::info!("start_dialogue with {}: {}", entity_id, text);

        // Parse choices JSON
        let choices: Vec<DialogueChoiceData> = serde_json::from_str(&choices_json)
            .unwrap_or_else(|e| {
                log::warn!("Failed to parse dialogue choices: {}", e);
                vec![]
            });

        let mut state = self.state.lock().unwrap();
        state.dialogue_state = Some(DialogueStateData {
            entity_id,
            node_id,
            current_text: text,
            choices,
        });
    }

    pub fn update_dialogue(&self, node_id: String, text: String, choices_json: String) {
        log::info!("update_dialogue: node={}", node_id);

        let choices: Vec<DialogueChoiceData> = serde_json::from_str(&choices_json)
            .unwrap_or_default();

        let mut state = self.state.lock().unwrap();
        if let Some(dialogue) = &mut state.dialogue_state {
            dialogue.node_id = node_id;
            dialogue.current_text = text;
            dialogue.choices = choices;
        }
    }

    pub fn end_dialogue(&self) {
        log::info!("end_dialogue");
        let mut state = self.state.lock().unwrap();
        state.dialogue_state = None;
    }

    // === Combat System ===

    pub fn start_combat(&self, enemy_id: String, enemy_name: String, enemy_hp: u32, enemy_max_hp: u32) {
        log::info!("start_combat: {} (HP: {}/{})", enemy_name, enemy_hp, enemy_max_hp);
        // TODO: Switch to combat page, initialize combat state
    }

    pub fn update_combat(&self, enemy_hp: Option<u32>, player_hp: Option<u32>, can_flee: Option<bool>) {
        log::info!("update_combat: enemy_hp={:?}, player_hp={:?}, can_flee={:?}",
                   enemy_hp, player_hp, can_flee);
        // TODO: Update combat state, health bars
    }

    pub fn end_combat(&self, result: String, rewards_json: Option<String>) {
        log::info!("end_combat: result={}, rewards={:?}", result, rewards_json);
        // TODO: Show result, return to game page
    }

    // === Container System ===

    pub fn open_container(&self, entity_id: String, entity_name: String, items_json: String) {
        log::info!("open_container: {} ({})", entity_name, entity_id);
        // TODO: Parse items, switch to container page
    }

    pub fn close_container(&self) {
        log::info!("close_container");
        // TODO: Return to previous page
    }

    // === Navigation & UI ===

    pub fn turn_to_menu(&self) {
        log::info!("turn_to_menu");
        let mut state = self.state.lock().unwrap();
        state.current_menu_tab = Some("Character".to_string());
        // TODO: Trigger page turn animation
    }

    pub fn turn_to_entity_page(&self, entity_key: String) {
        log::info!("turn_to_entity_page: {}", entity_key);
        // TODO: Load entity data, switch to entity page
    }

    pub fn go_back(&self) {
        log::info!("go_back");
        // TODO: Return to previous page
    }

    // === User Input ===

    pub fn handle_tap(&self, x: f32, y: f32) -> TapResult {
        log::info!("handle_tap: ({}, {})", x, y);

        // TODO: Implement proper hit testing
        // For now, return a placeholder
        TapResult {
            action_type: "none".to_string(),
            target: None,
            details: None,
        }
    }

    // === Content Retrieval ===

    pub fn get_current_page_content(&self) -> String {
        let state = self.state.lock().unwrap();
        state.current_page_content.clone()
    }

    pub fn get_player_stats(&self) -> PlayerStatsData {
        let state = self.state.lock().unwrap();
        state.player_stats.clone()
    }

    pub fn get_available_exits(&self) -> Vec<String> {
        let state = self.state.lock().unwrap();
        state.available_exits.clone()
    }

    pub fn get_current_menu_tab(&self) -> Option<String> {
        let state = self.state.lock().unwrap();
        state.current_menu_tab.clone()
    }

    pub fn get_dialogue_state(&self) -> Option<DialogueStateData> {
        let state = self.state.lock().unwrap();
        state.dialogue_state.clone()
    }
}

/// Create a new bridge instance (called from RN)
pub fn create_bridge() -> Arc<LokaBookBridge> {
    Arc::new(LokaBookBridge::new())
}
