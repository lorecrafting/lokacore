//! Entity interaction page rendering
//!
//! Displays entity details and available actions (Talk, Trade, Attack, Examine)

use bevy::prelude::*;

/// Type of entity for determining available actions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityType {
    /// Non-player character (can talk, possibly trade)
    Npc,
    /// Merchant (can talk and trade)
    Merchant,
    /// Enemy creature (can examine and attack)
    Enemy,
    /// Interactive object (can examine, possibly use)
    Object,
}

/// Entity data for interaction page
#[derive(Clone)]
pub struct EntityData {
    /// Unique key for this entity
    pub key: String,
    /// Display name
    pub name: String,
    /// Description text
    pub description: String,
    /// Entity type determines available actions
    pub entity_type: EntityType,
    /// Level (if applicable)
    pub level: Option<u32>,
    /// Health percentage (for enemies)
    pub health_percent: Option<f32>,
}

impl EntityData {
    /// Create placeholder entity for testing
    pub fn placeholder(key: &str) -> Self {
        Self {
            key: key.to_string(),
            name: "Elder Ming".to_string(),
            description: "A wise monk sits in meditation, eyes closed in serene contemplation. \
                         His weathered face speaks of many years of practice.".to_string(),
            entity_type: EntityType::Npc,
            level: Some(10),
            health_percent: None,
        }
    }

    /// Get available actions for this entity
    pub fn available_actions(&self) -> Vec<EntityAction> {
        match self.entity_type {
            EntityType::Npc => vec![
                EntityAction::Talk,
                EntityAction::Examine,
            ],
            EntityType::Merchant => vec![
                EntityAction::Talk,
                EntityAction::Trade,
                EntityAction::Examine,
            ],
            EntityType::Enemy => vec![
                EntityAction::Attack,
                EntityAction::Examine,
            ],
            EntityType::Object => vec![
                EntityAction::Examine,
                EntityAction::Use,
            ],
        }
    }

    /// Format entity interaction page content
    pub fn format_page(&self) -> String {
        let mut content = String::new();

        // Header with entity name
        content.push_str("╔════════════════════════════════════════╗\n");
        content.push_str(&format!("║ {:<38} ║\n", self.name));

        // Level indicator if applicable
        if let Some(level) = self.level {
            content.push_str(&format!("║ Level {} {:<30} ║\n", level, ""));
        }

        content.push_str("╠════════════════════════════════════════╣\n");

        // Health bar for enemies
        if let Some(hp_pct) = self.health_percent {
            let bar_width = 20;
            let filled = (bar_width as f32 * hp_pct).round() as usize;
            let empty = bar_width - filled;
            let bar: String = "█".repeat(filled) + &"░".repeat(empty);

            content.push_str(&format!("║ HP: [{:20}] {:3}%     ║\n", bar, (hp_pct * 100.0) as u8));
            content.push_str("╠════════════════════════════════════════╣\n");
        }

        // Description (word-wrapped)
        content.push_str("║                                        ║\n");
        for line in self.wrap_text(&self.description, 36) {
            content.push_str(&format!("║  {:<36}  ║\n", line));
        }
        content.push_str("║                                        ║\n");

        // Available actions
        content.push_str("╠════════════════════════════════════════╣\n");
        content.push_str("║            Actions Available           ║\n");
        content.push_str("╠════════════════════════════════════════╣\n");

        for action in self.available_actions() {
            let (icon, label) = action.display();
            content.push_str(&format!("║  {:<36}  ║\n", format!("{} {}", icon, label)));
        }

        content.push_str("║                                        ║\n");
        content.push_str("║  [←] Back                              ║\n");
        content.push_str("╚════════════════════════════════════════╝\n");

        content
    }

    /// Simple word wrapping for description text
    fn wrap_text(&self, text: &str, max_width: usize) -> Vec<String> {
        let mut lines = Vec::new();
        let words: Vec<&str> = text.split_whitespace().collect();
        let mut current_line = String::new();

        for word in words {
            if current_line.is_empty() {
                current_line = word.to_string();
            } else if current_line.len() + 1 + word.len() <= max_width {
                current_line.push(' ');
                current_line.push_str(word);
            } else {
                lines.push(current_line);
                current_line = word.to_string();
            }
        }

        if !current_line.is_empty() {
            lines.push(current_line);
        }

        lines
    }
}

/// Actions available when interacting with entities
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityAction {
    /// Start conversation with NPC
    Talk,
    /// Open trade window
    Trade,
    /// Initiate combat
    Attack,
    /// View detailed information
    Examine,
    /// Use/activate object
    Use,
}

impl EntityAction {
    /// Get display icon and label for this action
    pub fn display(&self) -> (&'static str, &'static str) {
        match self {
            EntityAction::Talk => ("💬", "Talk"),
            EntityAction::Trade => ("🛒", "Trade"),
            EntityAction::Attack => ("⚔️", "Attack"),
            EntityAction::Examine => ("🔍", "Examine"),
            EntityAction::Use => ("✋", "Use"),
        }
    }

    /// Get the action name as a string (for button IDs)
    pub fn name(&self) -> &'static str {
        match self {
            EntityAction::Talk => "talk",
            EntityAction::Trade => "trade",
            EntityAction::Attack => "attack",
            EntityAction::Examine => "examine",
            EntityAction::Use => "use",
        }
    }
}

/// Resource tracking entity page state
#[derive(Resource, Default)]
pub struct EntityPageState {
    /// Currently viewed entity (if any)
    pub current_entity: Option<EntityData>,
    /// Pending action to execute (Phase 8 integration)
    pub pending_action: Option<(String, EntityAction)>,
}

impl EntityPageState {
    /// Set the current entity being viewed
    pub fn view_entity(&mut self, entity: EntityData) {
        self.current_entity = Some(entity);
    }

    /// Clear the current entity
    pub fn clear(&mut self) {
        self.current_entity = None;
        self.pending_action = None;
    }

    /// Queue an action for execution
    pub fn queue_action(&mut self, entity_key: String, action: EntityAction) {
        info!("Queuing action {:?} for entity {}", action, entity_key);
        self.pending_action = Some((entity_key, action));
    }

    /// Get and consume the pending action
    pub fn take_pending_action(&mut self) -> Option<(String, EntityAction)> {
        self.pending_action.take()
    }
}

/// Plugin for entity page system
pub struct EntityPagePlugin;

impl Plugin for EntityPagePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<EntityPageState>();
        info!("EntityPagePlugin initialized");
    }
}
