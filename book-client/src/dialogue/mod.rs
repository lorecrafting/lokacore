//! Dialogue system for NPC conversations
//!
//! Supports branching dialogue trees with choices and history

use bevy::prelude::*;

/// A single line of dialogue
#[derive(Debug, Clone)]
pub struct DialogueLine {
    /// Who is speaking (NPC name or "You")
    pub speaker: String,
    /// What they're saying
    pub text: String,
}

/// A dialogue choice presented to the player
#[derive(Debug, Clone)]
pub struct DialogueChoice {
    /// Unique ID for this choice
    pub id: String,
    /// Text displayed on the button
    pub text: String,
    /// Node ID this choice leads to
    pub next_node: Option<String>,
}

/// A node in the dialogue tree
#[derive(Debug, Clone)]
pub struct DialogueNode {
    /// Unique node ID
    pub id: String,
    /// NPC dialogue line(s) for this node
    pub npc_text: Vec<String>,
    /// Available player choices
    pub choices: Vec<DialogueChoice>,
    /// Whether this ends the conversation
    pub is_end: bool,
}

impl DialogueNode {
    /// Create a placeholder dialogue for testing
    pub fn placeholder_greeting() -> Self {
        Self {
            id: "greeting".to_string(),
            npc_text: vec![
                "Greetings, traveler. I sense you seek wisdom.".to_string(),
                "What brings you to our monastery?".to_string(),
            ],
            choices: vec![
                DialogueChoice {
                    id: "quest".to_string(),
                    text: "I'm here about the trial.".to_string(),
                    next_node: Some("trial_info".to_string()),
                },
                DialogueChoice {
                    id: "curious".to_string(),
                    text: "Just curious about this place.".to_string(),
                    next_node: Some("monastery_info".to_string()),
                },
                DialogueChoice {
                    id: "leave".to_string(),
                    text: "Nevermind, goodbye.".to_string(),
                    next_node: None,
                },
            ],
            is_end: false,
        }
    }

    /// Create a placeholder response node
    pub fn placeholder_response() -> Self {
        Self {
            id: "trial_info".to_string(),
            npc_text: vec![
                "Ah yes, the trial. You must prove your dedication.".to_string(),
                "Speak with the training master when you're ready.".to_string(),
            ],
            choices: vec![
                DialogueChoice {
                    id: "thanks".to_string(),
                    text: "Thank you for the guidance.".to_string(),
                    next_node: None,
                },
            ],
            is_end: true,
        }
    }
}

/// State of an active dialogue conversation
#[derive(Resource, Default)]
pub struct DialogueState {
    /// Entity key we're talking to
    pub entity_key: Option<String>,
    /// Current node in the dialogue tree
    pub current_node: Option<DialogueNode>,
    /// History of conversation (for scrollback)
    pub history: Vec<DialogueLine>,
    /// Whether dialogue is active
    pub active: bool,
}

impl DialogueState {
    /// Start a dialogue with an entity
    pub fn start_dialogue(&mut self, entity_key: String, starting_node: DialogueNode) {
        info!("Starting dialogue with {}", entity_key);
        self.entity_key = Some(entity_key);

        // Add NPC lines to history
        if let Some(entity_key) = &self.entity_key {
            for text in &starting_node.npc_text {
                self.history.push(DialogueLine {
                    speaker: entity_key.clone(),
                    text: text.clone(),
                });
            }
        }

        self.current_node = Some(starting_node);
        self.active = true;
    }

    /// Select a dialogue choice and advance to next node
    pub fn select_choice(&mut self, choice_id: &str, next_node: Option<DialogueNode>) {
        // Find the choice text to add to history
        if let Some(node) = &self.current_node {
            if let Some(choice) = node.choices.iter().find(|c| c.id == choice_id) {
                self.history.push(DialogueLine {
                    speaker: "You".to_string(),
                    text: choice.text.clone(),
                });
            }
        }

        // Move to next node or end dialogue
        if let Some(next) = next_node {
            // Add NPC response to history
            if let Some(entity_key) = &self.entity_key {
                for text in &next.npc_text {
                    self.history.push(DialogueLine {
                        speaker: entity_key.clone(),
                        text: text.clone(),
                    });
                }
            }
            self.current_node = Some(next);
        } else {
            self.end_dialogue();
        }
    }

    /// End the current dialogue
    pub fn end_dialogue(&mut self) {
        info!("Ending dialogue");
        self.active = false;
        self.current_node = None;
        // Keep history for review
    }

    /// Clear all dialogue state
    pub fn clear(&mut self) {
        self.entity_key = None;
        self.current_node = None;
        self.history.clear();
        self.active = false;
    }

    /// Format dialogue UI for rendering
    pub fn format_dialogue_ui(&self, npc_name: &str) -> String {
        let mut content = String::new();

        if !self.active || self.current_node.is_none() {
            return content;
        }

        content.push_str("╔════════════════════════════════════════╗\n");
        content.push_str(&format!("║ Conversation with {:<20} ║\n", npc_name));
        content.push_str("╠════════════════════════════════════════╣\n");

        // Show recent dialogue history (last 5 exchanges)
        let recent_history: Vec<&DialogueLine> = self.history.iter()
            .rev()
            .take(5)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();

        for line in recent_history {
            let speaker_prefix = if line.speaker == "You" { "You: " } else { &format!("{}: ", line.speaker) };
            content.push_str(&format!("║  {:<36}  ║\n", speaker_prefix));

            // Wrap text (simple version)
            for text_line in self.wrap_text(&line.text, 36) {
                content.push_str(&format!("║  {:<36}  ║\n", text_line));
            }
            content.push_str("║                                        ║\n");
        }

        content.push_str("╠════════════════════════════════════════╣\n");

        // Show current choices
        if let Some(node) = &self.current_node {
            content.push_str("║           Your Responses:              ║\n");
            content.push_str("╠════════════════════════════════════════╣\n");

            for (i, choice) in node.choices.iter().enumerate() {
                content.push_str(&format!("║  {}. {:<34} ║\n", i + 1, choice.text));
            }
        }

        content.push_str("║                                        ║\n");
        content.push_str("║  [End Conversation]                    ║\n");
        content.push_str("╚════════════════════════════════════════╝");

        content
    }

    /// Wrap text to fit within width
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

/// Plugin for dialogue system
pub struct DialoguePlugin;

impl Plugin for DialoguePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<DialogueState>();
        info!("DialoguePlugin initialized");
    }
}
