//! Menu page with tabs (Character, Inventory, Quests, Craft, Spark, Social, Settings)

use bevy::prelude::*;

/// Menu tab types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MenuTab {
    #[default]
    Character,
    Inventory,
    Quests,
    Craft,
    Spark,
    Social,
    Settings,
}

impl MenuTab {
    /// Get all tabs in order
    pub fn all() -> [MenuTab; 7] {
        [
            MenuTab::Character,
            MenuTab::Inventory,
            MenuTab::Quests,
            MenuTab::Craft,
            MenuTab::Spark,
            MenuTab::Social,
            MenuTab::Settings,
        ]
    }

    /// Get display name for this tab
    pub fn name(&self) -> &'static str {
        match self {
            MenuTab::Character => "Character",
            MenuTab::Inventory => "Inventory",
            MenuTab::Quests => "Quests",
            MenuTab::Craft => "Craft",
            MenuTab::Spark => "Spark",
            MenuTab::Social => "Social",
            MenuTab::Settings => "Settings",
        }
    }

    /// Get the next tab (wraps around)
    pub fn next(&self) -> MenuTab {
        match self {
            MenuTab::Character => MenuTab::Inventory,
            MenuTab::Inventory => MenuTab::Quests,
            MenuTab::Quests => MenuTab::Craft,
            MenuTab::Craft => MenuTab::Spark,
            MenuTab::Spark => MenuTab::Social,
            MenuTab::Social => MenuTab::Settings,
            MenuTab::Settings => MenuTab::Character,
        }
    }

    /// Get the previous tab (wraps around)
    pub fn prev(&self) -> MenuTab {
        match self {
            MenuTab::Character => MenuTab::Settings,
            MenuTab::Inventory => MenuTab::Character,
            MenuTab::Quests => MenuTab::Inventory,
            MenuTab::Craft => MenuTab::Quests,
            MenuTab::Spark => MenuTab::Craft,
            MenuTab::Social => MenuTab::Spark,
            MenuTab::Settings => MenuTab::Social,
        }
    }
}

/// Resource tracking current menu state
#[derive(Resource, Default)]
pub struct MenuState {
    /// Currently active tab
    pub current_tab: MenuTab,
    /// Whether the menu page needs re-rendering
    pub needs_update: bool,
}

impl MenuState {
    /// Switch to a different tab
    pub fn switch_to(&mut self, tab: MenuTab) {
        if self.current_tab != tab {
            self.current_tab = tab;
            self.needs_update = true;
            info!("Switched to {} tab", tab.name());
        }
    }

    /// Switch to next tab
    pub fn next_tab(&mut self) {
        self.switch_to(self.current_tab.next());
    }

    /// Switch to previous tab
    pub fn prev_tab(&mut self) {
        self.switch_to(self.current_tab.prev());
    }

    /// Format menu content for rendering (to be expanded in future)
    pub fn format_content(&self) -> String {
        let mut content = String::new();

        // Tab bar
        content.push_str(&format!("╔════════════════════════════════════════╗\n"));
        content.push_str("║             ~ MENU ~                  ║\n");
        content.push_str("╠════════════════════════════════════════╣\n");
        content.push_str("║ ");

        // Tab buttons - show active tab with [brackets]
        for tab in MenuTab::all() {
            if tab == self.current_tab {
                content.push_str(&format!("[{}] ", tab.name()));
            } else {
                content.push_str(&format!(" {}  ", tab.name()));
            }
        }

        content.push_str("   ║\n");
        content.push_str("╠════════════════════════════════════════╣\n");
        content.push_str("║                                        ║\n");

        // Tab content area
        content.push_str(&format!("║  {:<36}  ║\n", self.get_tab_content()));

        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║  [×] Close                             ║\n");
        content.push_str("╚════════════════════════════════════════╝\n");

        content
    }

    /// Get content for the current tab
    pub fn get_tab_content(&self) -> String {
        match self.current_tab {
            MenuTab::Character => self.format_character_tab(),
            MenuTab::Inventory => self.format_inventory_tab(),
            MenuTab::Quests => self.format_quest_tab(),
            MenuTab::Craft => self.format_craft_tab(),
            MenuTab::Spark => self.format_spark_tab(),
            MenuTab::Social => self.format_social_tab(),
            MenuTab::Settings => self.format_settings_tab(),
        }
    }

    /// Format Character tab content
    fn format_character_tab(&self) -> String {
        // Placeholder character data (will be from PlayerStats in future)
        let mut content = String::new();
        content.push_str("Name: Wanderer             Level: 5\n");
        content.push_str("\n");
        content.push_str("XP: [██████████░░░░░░░░░░] 500/1000\n");
        content.push_str("\n");
        content.push_str("Health:  100 / 100\n");
        content.push_str("Qi:       50 /  50\n");
        content.push_str("Stamina:  80 /  80\n");
        content.push_str("\n");
        content.push_str("─── Attributes ───\n");
        content.push_str("STR: 12    DEX: 14\n");
        content.push_str("CON: 13    INT: 16\n");
        content.push_str("WIS: 15    CHA: 10\n");
        content.push_str("\n");
        content.push_str("Gold: 150\n");
        content
    }

    /// Format Inventory tab content
    fn format_inventory_tab(&self) -> String {
        // Placeholder inventory data (will be from game state in future)
        // TODO: Integrate scrolling for lists >20 items using TextRenderState system
        // TODO: Add tap detection for items to show context menu (Use, Equip, Drop)
        // TODO: Context menu actions will queue actions for execution via uniffi (Phase 7)
        let mut content = String::new();

        // Weight/capacity indicator
        content.push_str("Capacity: 125 / 200 lbs\n");
        content.push_str("\n");

        // Equipped items section
        content.push_str("─── Equipped ───\n");
        content.push_str("[Weapon] Iron Sword (+5 dmg)\n");
        content.push_str("[Armor]  Leather Vest (+3 def)\n");
        content.push_str("[Ring]   Silver Band (+1 CHA)\n");
        content.push_str("\n");

        // Inventory items
        content.push_str("─── Inventory ───\n");
        content.push_str("Health Potion (x3)\n");
        content.push_str("  Restores 50 HP\n");
        content.push_str("\n");
        content.push_str("Qi Elixir (x2)\n");
        content.push_str("  Restores 30 Qi\n");
        content.push_str("\n");
        content.push_str("Ancient Scroll (x1)\n");
        content.push_str("  Mysterious writings\n");
        content.push_str("\n");
        content.push_str("Copper Coins (x50)\n");
        content.push_str("  Currency for trade\n");
        content.push_str("\n");
        content.push_str("Dried Rations (x5)\n");
        content.push_str("  Food for long journeys\n");

        content
    }

    /// Format Quest tab content
    fn format_quest_tab(&self) -> String {
        // Placeholder quest data (will be from game state in future)
        // TODO: Integrate scrolling for lists >5 quests
        // TODO: Add expand/collapse functionality for quest details
        let mut content = String::new();

        // Active quests
        content.push_str("─── Active Quests ───\n");
        content.push_str("\n");
        content.push_str("▸ The Monastery Trial\n");
        content.push_str("  Prove your worth to join\n");
        content.push_str("  ✓ Speak with Elder Pema\n");
        content.push_str("  ✓ Complete meditation task\n");
        content.push_str("  ○ Pass the combat test\n");
        content.push_str("  Reward: Novice Robes, 100 XP\n");
        content.push_str("\n");
        content.push_str("▸ Gather Herbs\n");
        content.push_str("  Collect healing herbs\n");
        content.push_str("  ○ Moonflower (0/3)\n");
        content.push_str("  ○ Silverleaf (1/5)\n");
        content.push_str("  Reward: 50 gold, Health Potion\n");
        content.push_str("\n");

        // Completed quests section
        content.push_str("─── Completed (2) ───\n");
        content.push_str("• Welcome to Loka\n");
        content.push_str("• Find the Monastery\n");

        content
    }

    /// Format Craft tab content
    fn format_craft_tab(&self) -> String {
        // Placeholder crafting data (will be from game state in future)
        // TODO: Add recipe selection and craft button interaction
        let mut content = String::new();

        content.push_str("─── Available Recipes ───\n");
        content.push_str("\n");
        content.push_str("▸ Health Potion\n");
        content.push_str("  Req: Moonflower (2), Water\n");
        content.push_str("  ✓ Can Craft\n");
        content.push_str("\n");
        content.push_str("▸ Iron Sword\n");
        content.push_str("  Req: Iron Ore (3), Coal (1)\n");
        content.push_str("  ○ Missing: Iron Ore (0/3)\n");
        content.push_str("\n");
        content.push_str("▸ Leather Vest\n");
        content.push_str("  Req: Leather (2), Thread (1)\n");
        content.push_str("  ○ Missing: Thread (0/1)\n");
        content.push_str("\n");
        content.push_str("─── Crafting Tools ───\n");
        content.push_str("• Alchemy Kit\n");
        content.push_str("• Forge Access\n");

        content
    }

    /// Format Spark tab content
    fn format_spark_tab(&self) -> String {
        // Placeholder Spark companion data
        // TODO: Add chat input field and message history
        let mut content = String::new();

        content.push_str("─── Spark Companion ───\n");
        content.push_str("\n");
        content.push_str("Spark: Hello! I'm Spark, your\n");
        content.push_str("       companion. How can I\n");
        content.push_str("       help you today?\n");
        content.push_str("\n");
        content.push_str("You:   Tell me about quests\n");
        content.push_str("\n");
        content.push_str("Spark: You have 2 active quests:\n");
        content.push_str("       'Monastery Trial' and\n");
        content.push_str("       'Gather Herbs'. Would you\n");
        content.push_str("       like details?\n");
        content.push_str("\n");
        content.push_str("─── Ask Spark ───\n");
        content.push_str("[Type your question...]\n");

        content
    }

    /// Format Social tab content
    fn format_social_tab(&self) -> String {
        // Placeholder social/emote data
        // TODO: Add emote and pose button interactions
        let mut content = String::new();

        content.push_str("─── Emotes ───\n");
        content.push_str("😊 Happy    😢 Sad      😠 Angry\n");
        content.push_str("😄 Laugh    🤔 Think    😴 Tired\n");
        content.push_str("👋 Wave     🙏 Bow      💪 Flex\n");
        content.push_str("\n");
        content.push_str("─── Poses ───\n");
        content.push_str("🧍 Standing  🪑 Sitting  🧎 Kneeling\n");
        content.push_str("🏃 Running   🧘 Meditating\n");
        content.push_str("\n");
        content.push_str("Current: Standing, Happy\n");

        content
    }

    /// Format Settings tab content
    fn format_settings_tab(&self) -> String {
        // Placeholder settings data
        // TODO: Add setting controls and logout functionality
        let mut content = String::new();

        content.push_str("─── Game Settings ───\n");
        content.push_str("\n");
        content.push_str("Design Variant:\n");
        content.push_str("  ⦿ Classic Book Style\n");
        content.push_str("  ○ Modern Minimal\n");
        content.push_str("  ○ Ornate Fantasy\n");
        content.push_str("\n");
        content.push_str("Sound Effects:  ON\n");
        content.push_str("Music:          ON\n");
        content.push_str("Notifications:  ON\n");
        content.push_str("\n");
        content.push_str("─── Account ───\n");
        content.push_str("[Logout]\n");
        content.push_str("\n");
        content.push_str("Version: 0.1.0 (Alpha)\n");

        content
    }
}

/// Plugin for menu system
pub struct MenuPlugin;

impl Plugin for MenuPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<MenuState>();
        info!("MenuPlugin initialized");
    }
}
