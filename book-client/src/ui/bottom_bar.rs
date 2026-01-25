//! Bottom bar UI with navigation buttons, health bars, and menu access

use bevy::prelude::*;

/// Available exits in the current room
#[derive(Resource, Clone, Default)]
pub struct AvailableExits {
    pub north: bool,
    pub south: bool,
    pub east: bool,
    pub west: bool,
    pub up: bool,
    pub down: bool,
}

impl AvailableExits {
    /// Create with all exits available
    pub fn all() -> Self {
        Self {
            north: true,
            south: true,
            east: true,
            west: true,
            up: true,
            down: true,
        }
    }

    /// Create with no exits
    pub fn none() -> Self {
        Self::default()
    }

    /// Set exits from a list of direction names
    pub fn from_directions(dirs: &[&str]) -> Self {
        let mut exits = Self::none();
        for dir in dirs {
            match *dir {
                "north" | "n" => exits.north = true,
                "south" | "s" => exits.south = true,
                "east" | "e" => exits.east = true,
                "west" | "w" => exits.west = true,
                "up" | "u" => exits.up = true,
                "down" | "d" => exits.down = true,
                _ => {}
            }
        }
        exits
    }

    /// Format exit buttons for display
    pub fn format_buttons(&self) -> String {
        let mut buttons = Vec::new();

        // Navigation arrows (only show available exits)
        if self.north { buttons.push("↑N"); }
        if self.south { buttons.push("↓S"); }
        if self.east { buttons.push("→E"); }
        if self.west { buttons.push("←W"); }
        if self.up { buttons.push("⬆U"); }
        if self.down { buttons.push("⬇D"); }

        if buttons.is_empty() {
            "No exits".to_string()
        } else {
            buttons.join(" ")
        }
    }
}

/// Game time display
#[derive(Resource, Clone)]
pub struct GameTime {
    /// Hour (0-23)
    pub hour: u8,
    /// Minute (0-59)
    pub minute: u8,
    /// Day name
    pub day: String,
}

impl Default for GameTime {
    fn default() -> Self {
        Self {
            hour: 12,
            minute: 0,
            day: "Moonday".to_string(),
        }
    }
}

impl GameTime {
    /// Format time as string
    pub fn format(&self) -> String {
        format!("{}, {:02}:{:02}", self.day, self.hour, self.minute)
    }

    /// Get time of day period
    pub fn period(&self) -> &str {
        match self.hour {
            0..=5 => "Night",
            6..=11 => "Morning",
            12..=17 => "Afternoon",
            18..=20 => "Evening",
            _ => "Night",
        }
    }
}

/// Bottom bar UI state
#[derive(Resource, Default)]
pub struct BottomBarState {
    /// Whether the bottom bar needs re-rendering
    pub needs_update: bool,
}

impl BottomBarState {
    /// Format the complete bottom bar UI
    pub fn format_bottom_bar(
        exits: &AvailableExits,
        time: &GameTime,
    ) -> String {
        // TODO: Integrate with health bars from PlayerStats
        // TODO: Add tap detection regions for buttons
        let mut content = String::new();

        content.push_str("┌────────────────────────────────────────┐\n");

        // Top row: Time and exits
        content.push_str(&format!(
            "│ {} │ Exits: {:<15} │\n",
            time.format(),
            exits.format_buttons()
        ));

        // Middle row: Action buttons
        content.push_str("│ 💬 Chat    📖 Menu    ⚔️ Combat      │\n");

        content.push_str("└────────────────────────────────────────┘");

        content
    }
}

/// Click region for button tap detection
#[derive(Debug, Clone)]
pub struct ButtonRegion {
    /// Button identifier
    pub id: String,
    /// Top-left X coordinate (UV space)
    pub x: f32,
    /// Top-left Y coordinate (UV space)
    pub y: f32,
    /// Width
    pub width: f32,
    /// Height
    pub height: f32,
}

impl ButtonRegion {
    /// Check if a point (in UV space) is within this button
    pub fn contains(&self, x: f32, y: f32) -> bool {
        x >= self.x
            && x <= self.x + self.width
            && y >= self.y
            && y <= self.y + self.height
    }
}

/// Collection of all button tap regions
#[derive(Resource, Default)]
pub struct ButtonRegions {
    pub regions: Vec<ButtonRegion>,
}

impl ButtonRegions {
    /// Find which button (if any) was tapped at the given coordinates
    pub fn find_button(&self, x: f32, y: f32) -> Option<String> {
        self.regions
            .iter()
            .find(|region| region.contains(x, y))
            .map(|region| region.id.clone())
    }

    /// Set up button regions for the bottom bar
    /// TODO: Calculate actual UV coordinates based on rendered layout
    pub fn setup_bottom_bar_regions(&mut self) {
        self.regions.clear();

        // Example regions (would be calculated from actual layout)
        // Bottom bar typically occupies bottom 15% of page
        let bottom_bar_y = 0.85;
        let bottom_bar_height = 0.15;

        // Exit buttons (left side)
        self.regions.push(ButtonRegion {
            id: "exit_north".to_string(),
            x: 0.1,
            y: bottom_bar_y,
            width: 0.08,
            height: bottom_bar_height / 2.0,
        });

        // Menu button (right side)
        self.regions.push(ButtonRegion {
            id: "menu".to_string(),
            x: 0.7,
            y: bottom_bar_y,
            width: 0.15,
            height: bottom_bar_height / 2.0,
        });

        // Chat button (middle)
        self.regions.push(ButtonRegion {
            id: "chat".to_string(),
            x: 0.4,
            y: bottom_bar_y,
            width: 0.15,
            height: bottom_bar_height / 2.0,
        });
    }
}

/// Plugin for bottom bar system
pub struct BottomBarPlugin;

impl Plugin for BottomBarPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<AvailableExits>()
            .init_resource::<GameTime>()
            .init_resource::<BottomBarState>()
            .init_resource::<ButtonRegions>();

        info!("BottomBarPlugin initialized");
    }
}
