//! Health and resource bar system

use bevy::prelude::*;

/// Player stats for health/resource display
#[derive(Resource, Clone)]
pub struct PlayerStats {
    /// Current health
    pub hp: i32,
    /// Maximum health
    pub max_hp: i32,
    /// Current qi (magical energy)
    pub qi: i32,
    /// Maximum qi
    pub max_qi: i32,
    /// Current stamina
    pub stamina: i32,
    /// Maximum stamina
    pub max_stamina: i32,
}

impl Default for PlayerStats {
    fn default() -> Self {
        Self {
            hp: 100,
            max_hp: 100,
            qi: 50,
            max_qi: 50,
            stamina: 80,
            max_stamina: 80,
        }
    }
}

impl PlayerStats {
    /// Get HP percentage (0.0 to 1.0)
    pub fn hp_percent(&self) -> f32 {
        if self.max_hp == 0 {
            0.0
        } else {
            (self.hp as f32 / self.max_hp as f32).clamp(0.0, 1.0)
        }
    }

    /// Get Qi percentage
    pub fn qi_percent(&self) -> f32 {
        if self.max_qi == 0 {
            0.0
        } else {
            (self.qi as f32 / self.max_qi as f32).clamp(0.0, 1.0)
        }
    }

    /// Get Stamina percentage
    pub fn stamina_percent(&self) -> f32 {
        if self.max_stamina == 0 {
            0.0
        } else {
            (self.stamina as f32 / self.max_stamina as f32).clamp(0.0, 1.0)
        }
    }

    /// Format as text bars (for rendering on page)
    pub fn format_bars(&self) -> String {
        let mut lines = Vec::new();

        lines.push("┌─ Status ─────────────────────────────────┐".to_string());

        // HP bar
        let hp_bar = self.create_bar("HP", self.hp, self.max_hp, self.hp_percent(), '█', '░');
        lines.push(format!("│ {}│", hp_bar));

        // Qi bar
        let qi_bar = self.create_bar("Qi", self.qi, self.max_qi, self.qi_percent(), '▓', '░');
        lines.push(format!("│ {}│", qi_bar));

        // Stamina bar
        let sta_bar = self.create_bar("St", self.stamina, self.max_stamina, self.stamina_percent(), '▒', '░');
        lines.push(format!("│ {}│", sta_bar));

        lines.push("└──────────────────────────────────────────┘".to_string());

        lines.join("\n")
    }

    /// Create a single bar with label
    fn create_bar(
        &self,
        label: &str,
        current: i32,
        max: i32,
        percent: f32,
        fill_char: char,
        empty_char: char,
    ) -> String {
        const BAR_WIDTH: usize = 20;

        let filled = (BAR_WIDTH as f32 * percent).round() as usize;
        let empty = BAR_WIDTH - filled;

        let bar: String = fill_char.to_string().repeat(filled)
            + &empty_char.to_string().repeat(empty);

        format!("{:2}: [{:20}] {:3}/{:<3}", label, bar, current, max)
    }

    /// Update HP (with animation tracking in future)
    pub fn set_hp(&mut self, new_hp: i32) {
        self.hp = new_hp.clamp(0, self.max_hp);
    }

    /// Damage the player
    pub fn take_damage(&mut self, amount: i32) {
        self.hp = (self.hp - amount).clamp(0, self.max_hp);
    }

    /// Heal the player
    pub fn heal(&mut self, amount: i32) {
        self.hp = (self.hp + amount).clamp(0, self.max_hp);
    }
}

/// Plugin for health bar system
pub struct HealthBarPlugin;

impl Plugin for HealthBarPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PlayerStats>();
        info!("HealthBarPlugin initialized");
    }
}
