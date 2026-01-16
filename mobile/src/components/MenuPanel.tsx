/**
 * Menu Panel Component
 * Full-screen tabbed panel with ebook aesthetic
 * Tabs: Character, Inventory, Quest, Craft, Socials, Settings
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PageContainer } from './PageContainer';
import { useEnvironment } from './EnvironmentContext';
import { useDesignVariants, BOTTOMBAR_VARIANT_LABELS } from '../contexts/DesignVariantsContext';
import { colors, fonts, spacing } from '../theme';
import { gameHaptics } from '../utils/haptics';
import type {
  Stats,
  Resources,
  InventoryItem,
  EquippedItem,
  Quest,
  CraftingRecipe,
} from '../types/game';

type TabKey = 'character' | 'inventory' | 'quest' | 'craft' | 'socials' | 'settings';

interface MenuPanelProps {
  visible: boolean;
  onClose: () => void;
  playerName: string;
  stats: Stats;
  health: { current: number; max: number };
  resources: Resources;
  inventory: InventoryItem[];
  equipped: Record<string, EquippedItem>;
  gold?: number;
  onDropItem: (itemId: string) => void;
  onEquipItem: (itemId: string) => void;
  onUnequipItem: (slot: string) => void;
  onUseItem: (itemId: string) => void;
  activeQuests: Quest[];
  completedQuests?: Quest[];
  recipes: CraftingRecipe[];
  onCraft: (recipeKey: string) => void;
  currentMood?: string;
  currentPose?: string;
  onSetMood: (mood: string) => void;
  onSetPose: (pose: string) => void;
  onLogout: () => void;
}

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: 'character', label: 'Character', short: 'Char' },
  { key: 'inventory', label: 'Inventory', short: 'Inv' },
  { key: 'quest', label: 'Quests', short: 'Quest' },
  { key: 'craft', label: 'Crafting', short: 'Craft' },
  { key: 'socials', label: 'Socials', short: 'Social' },
  { key: 'settings', label: 'Settings', short: '⚙' },
];

// === Tab Content Components ===

function CharacterTab({
  playerName,
  stats,
  health,
  resources,
}: {
  playerName: string;
  stats: Stats;
  health: { current: number; max: number };
  resources: Resources;
}) {
  const xpProgress = stats.xp_to_next
    ? Math.floor(((stats.xp || 0) / stats.xp_to_next) * 100)
    : 0;

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionHeader}>{playerName}</Text>

      <Text style={styles.label}>Level {stats.level || 1}</Text>
      <Text style={styles.value}>
        Experience: {stats.xp || 0} / {stats.xp_to_next || 100} ({xpProgress}%)
      </Text>

      <Text style={styles.divider}>· · ·</Text>

      <Text style={styles.label}>Vitals</Text>
      <Text style={styles.value}>Health: {health.current}/{health.max}</Text>
      {Object.entries(resources).map(([key, res]) => (
        <Text key={key} style={styles.value}>
          {key.charAt(0).toUpperCase() + key.slice(1)}: {res.current}/{res.max}
        </Text>
      ))}

      <Text style={styles.divider}>· · ·</Text>

      <Text style={styles.label}>Attributes</Text>
      <View style={styles.attributeRow}>
        {stats.strength !== undefined && <Text style={styles.attribute}>STR {stats.strength}</Text>}
        {stats.dexterity !== undefined && <Text style={styles.attribute}>DEX {stats.dexterity}</Text>}
        {stats.constitution !== undefined && <Text style={styles.attribute}>CON {stats.constitution}</Text>}
      </View>
      <View style={styles.attributeRow}>
        {stats.intelligence !== undefined && <Text style={styles.attribute}>INT {stats.intelligence}</Text>}
        {stats.wisdom !== undefined && <Text style={styles.attribute}>WIS {stats.wisdom}</Text>}
        {stats.charisma !== undefined && <Text style={styles.attribute}>CHA {stats.charisma}</Text>}
      </View>

      <Text style={styles.divider}>· · ·</Text>

      <Text style={styles.value}>Gold: {stats.gold || 0}</Text>
    </ScrollView>
  );
}

const EQUIPMENT_SLOTS = ['head', 'body', 'hands', 'feet', 'weapon', 'shield', 'light', 'accessory'];

function InventoryTab({
  inventory,
  equipped,
  gold = 0,
  onDropItem,
  onEquipItem,
  onUnequipItem,
  onUseItem,
}: {
  inventory: InventoryItem[];
  equipped: Record<string, EquippedItem>;
  gold?: number;
  onDropItem: (itemId: string) => void;
  onEquipItem: (itemId: string) => void;
  onUnequipItem: (slot: string) => void;
  onUseItem: (itemId: string) => void;
}) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Helper to check if item has a component (handles both array and object formats)
  const hasComponent = (item: InventoryItem, componentName: string) => {
    const components = item.components;
    if (!components) return false;
    if (Array.isArray(components)) {
      return components.includes(componentName);
    }
    return componentName in components;
  };

  const isEquippable = (item: InventoryItem) => {
    // Check both spellings: 'equipable' (YAML) and 'equippable' (legacy)
    return hasComponent(item, 'equipable') || hasComponent(item, 'equippable') || hasComponent(item, 'wearable') || hasComponent(item, 'weapon');
  };

  const isConsumable = (item: InventoryItem) => {
    return hasComponent(item, 'consumable') || hasComponent(item, 'usable');
  };

  const handleAction = (action: string) => {
    if (!selectedItem) return;
    switch (action) {
      case 'equip':
        onEquipItem(selectedItem.id);
        break;
      case 'use':
        onUseItem(selectedItem.id);
        break;
      case 'drop':
        onDropItem(selectedItem.id);
        break;
    }
    setSelectedItem(null);
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.value}>Gold: {gold}</Text>

      <Text style={styles.divider}>· · ·</Text>

      <Text style={styles.label}>Equipment</Text>
      {EQUIPMENT_SLOTS.map((slot) => {
        const equippedItem = equipped[slot];
        return (
          <TouchableOpacity
            key={slot}
            onPress={() => equippedItem && onUnequipItem(slot)}
          >
            <Text style={styles.value}>
              {slot}: {equippedItem ? (
                <Text style={styles.link}>{equippedItem.name}</Text>
              ) : (
                <Text style={styles.muted}>empty</Text>
              )}
            </Text>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.divider}>· · ·</Text>

      <Text style={styles.label}>Items ({inventory.length})</Text>
      {inventory.length === 0 ? (
        <Text style={styles.muted}>Your inventory is empty.</Text>
      ) : (
        inventory.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
          >
            <Text style={[styles.value, selectedItem?.id === item.id && styles.selected]}>
              {item.name}{item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}
            </Text>
            {selectedItem?.id === item.id && (
              <View style={styles.actions}>
                {isEquippable(item) && (
                  <TouchableOpacity onPress={() => handleAction('equip')}>
                    <Text style={styles.link}>equip</Text>
                  </TouchableOpacity>
                )}
                {isConsumable(item) && (
                  <TouchableOpacity onPress={() => handleAction('use')}>
                    <Text style={styles.link}>use</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleAction('drop')}>
                  <Text style={styles.link}>drop</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function QuestTab({
  activeQuests,
  completedQuests = [],
}: {
  activeQuests: Quest[];
  completedQuests?: Quest[];
}) {
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const quests = showCompleted ? completedQuests : activeQuests;

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => setShowCompleted(false)}>
          <Text style={[styles.link, !showCompleted && styles.selected]}>
            Active ({activeQuests.length})
          </Text>
        </TouchableOpacity>
        <Text style={styles.muted}> | </Text>
        <TouchableOpacity onPress={() => setShowCompleted(true)}>
          <Text style={[styles.link, showCompleted && styles.selected]}>
            Completed ({completedQuests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.divider}>· · ·</Text>

      {quests.length === 0 ? (
        <Text style={styles.muted}>
          {showCompleted ? 'No completed quests yet.' : 'No active quests. Talk to NPCs to find quests.'}
        </Text>
      ) : (
        quests.map((quest) => (
          <View key={quest.id}>
            <TouchableOpacity
              onPress={() => setSelectedQuest(selectedQuest?.id === quest.id ? null : quest)}
            >
              <Text style={[styles.value, selectedQuest?.id === quest.id && styles.selected]}>
                {quest.title}
              </Text>
            </TouchableOpacity>
            {selectedQuest?.id === quest.id && (
              <View style={styles.questDetails}>
                <Text style={styles.muted}>{quest.description}</Text>
                {quest.objectives && quest.objectives.length > 0 && (
                  <>
                    <Text style={styles.label}>Objectives:</Text>
                    {quest.objectives.map((obj, idx) => (
                      <Text key={idx} style={obj.completed ? styles.muted : styles.value}>
                        {obj.completed ? '[x]' : '[ ]'} {obj.description}
                        {obj.target && ` (${obj.progress || 0}/${obj.target})`}
                      </Text>
                    ))}
                  </>
                )}
                {quest.rewards && (
                  <Text style={styles.muted}>
                    Rewards: {quest.rewards.xp && `${quest.rewards.xp} XP`}
                    {quest.rewards.xp && quest.rewards.gold && ', '}
                    {quest.rewards.gold && `${quest.rewards.gold} Gold`}
                  </Text>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function CraftTab({
  recipes,
  inventory,
  onCraft,
}: {
  recipes: CraftingRecipe[];
  inventory: InventoryItem[];
  onCraft: (recipeKey: string) => void;
}) {
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);

  const checkCanCraft = (recipe: CraftingRecipe): boolean => {
    return recipe.ingredients.every((ing) => {
      const inventoryItem = inventory.find((item) => item.key === ing.key);
      const have = inventoryItem?.quantity || 0;
      return have >= ing.quantity;
    });
  };

  if (selectedRecipe) {
    const canCraft = checkCanCraft(selectedRecipe);
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
          <Text style={styles.link}>&lt; back</Text>
        </TouchableOpacity>

        <Text style={styles.divider}>· · ·</Text>

        <Text style={styles.sectionHeader}>{selectedRecipe.name}</Text>
        {selectedRecipe.description && (
          <Text style={styles.muted}>{selectedRecipe.description}</Text>
        )}

        <Text style={styles.divider}>· · ·</Text>

        <Text style={styles.label}>Ingredients:</Text>
        {selectedRecipe.ingredients.map((ing, index) => {
          const inventoryItem = inventory.find((item) => item.key === ing.key);
          const have = inventoryItem?.quantity || 0;
          const hasEnough = have >= ing.quantity;
          return (
            <Text key={index} style={hasEnough ? styles.value : styles.error}>
              {ing.name}: {have}/{ing.quantity}
            </Text>
          );
        })}

        <Text style={styles.divider}>· · ·</Text>

        <TouchableOpacity
          onPress={() => {
            onCraft(selectedRecipe.key);
            setSelectedRecipe(null);
          }}
          disabled={!canCraft}
        >
          <Text style={canCraft ? styles.link : styles.muted}>
            {canCraft ? 'craft' : 'missing ingredients'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {recipes.length === 0 ? (
        <>
          <Text style={styles.muted}>You don't know any crafting recipes yet.</Text>
          <Text style={styles.muted}>
            Learn recipes by reading books, talking to craftsmen, or discovering them through exploration.
          </Text>
        </>
      ) : (
        recipes.map((recipe) => {
          const canCraft = checkCanCraft(recipe);
          return (
            <TouchableOpacity key={recipe.key} onPress={() => setSelectedRecipe(recipe)}>
              <Text style={styles.value}>
                {recipe.name} <Text style={canCraft ? styles.muted : styles.error}>
                  [{canCraft ? 'ready' : 'missing'}]
                </Text>
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const MOODS = [
  { key: 'neutral', name: 'Neutral' },
  { key: 'cheerful', name: 'Cheerful' },
  { key: 'melancholy', name: 'Melancholy' },
  { key: 'fierce', name: 'Fierce' },
  { key: 'distracted', name: 'Distracted' },
  { key: 'formal', name: 'Formal' },
  { key: 'playful', name: 'Playful' },
  { key: 'weary', name: 'Weary' },
];

const POSES = [
  { key: 'standing', name: 'Standing' },
  { key: 'sitting', name: 'Sitting' },
  { key: 'kneeling', name: 'Kneeling' },
  { key: 'meditating', name: 'Meditating' },
  { key: 'resting', name: 'Resting' },
  { key: 'alert', name: 'Alert' },
];

function SocialsTab({
  currentMood = 'neutral',
  currentPose = 'standing',
  onSetMood,
  onSetPose,
}: {
  currentMood?: string;
  currentPose?: string;
  onSetMood: (mood: string) => void;
  onSetPose: (pose: string) => void;
}) {
  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.label}>Mood</Text>
      <View style={styles.optionList}>
        {MOODS.map((mood) => (
          <TouchableOpacity key={mood.key} onPress={() => onSetMood(mood.key)}>
            <Text style={currentMood === mood.key ? styles.selected : styles.link}>
              {mood.name}{currentMood === mood.key ? ' *' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.divider}>· · ·</Text>

      <Text style={styles.label}>Pose</Text>
      <View style={styles.optionList}>
        {POSES.map((pose) => (
          <TouchableOpacity key={pose.key} onPress={() => onSetPose(pose.key)}>
            <Text style={currentPose === pose.key ? styles.selected : styles.link}>
              {pose.name}{currentPose === pose.key ? ' *' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function SettingsTab({ onLogout, onCloseMenu }: { onLogout: () => void; onCloseMenu: () => void }) {
  const { bottomBarVariant, showPicker } = useDesignVariants();

  const handleOpenLayoutPicker = useCallback(() => {
    gameHaptics.menuSelect();
    // Close the menu first, then show picker after a brief delay
    // This avoids React Native's modal stacking issues
    onCloseMenu();
    setTimeout(() => showPicker(), 100);
  }, [showPicker, onCloseMenu]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Layout Settings */}
      <Text style={styles.sectionTitle}>Appearance</Text>
      <TouchableOpacity onPress={handleOpenLayoutPicker}>
        <View style={styles.settingRow}>
          <Text style={styles.link}>Bottom Bar Layout</Text>
          <Text style={styles.settingValue}>{BOTTOMBAR_VARIANT_LABELS[bottomBarVariant]}</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.divider}>· · ·</Text>

      {/* Account */}
      <Text style={styles.sectionTitle}>Account</Text>
      <TouchableOpacity onPress={onLogout}>
        <Text style={styles.link}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.divider}>· · ·</Text>

      <Text style={styles.muted}>Loka - A Living Ebook Adventure</Text>
      <Text style={styles.muted}>Version 1.0.0</Text>
    </ScrollView>
  );
}

// === Main Component ===

export function MenuPanel({
  visible,
  onClose,
  playerName,
  stats,
  health,
  resources,
  inventory,
  equipped,
  gold,
  onDropItem,
  onEquipItem,
  onUnequipItem,
  onUseItem,
  activeQuests,
  completedQuests,
  recipes,
  onCraft,
  currentMood,
  currentPose,
  onSetMood,
  onSetPose,
  onLogout,
}: MenuPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('character');

  // Get environment context for dynamic theming
  const { colors: envColors } = useEnvironment();

  // Create dynamic styles based on environment
  const dynamicStyles = useMemo(() => ({
    safeArea: { backgroundColor: envColors.background },
    headerTitle: { color: envColors.text },
    border: { borderColor: envColors.border },
    tabDot: { color: envColors.textFaint },
    tabText: { color: envColors.textMuted },
    tabActive: { color: envColors.text },
  }), [envColors]);

  const handleTabPress = useCallback((key: TabKey) => {
    gameHaptics.menuSelect();
    setActiveTab(key);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'character':
        return (
          <CharacterTab
            playerName={playerName}
            stats={stats}
            health={health}
            resources={resources}
          />
        );
      case 'inventory':
        return (
          <InventoryTab
            inventory={inventory}
            equipped={equipped}
            gold={gold}
            onDropItem={onDropItem}
            onEquipItem={onEquipItem}
            onUnequipItem={onUnequipItem}
            onUseItem={onUseItem}
          />
        );
      case 'quest':
        return <QuestTab activeQuests={activeQuests} completedQuests={completedQuests} />;
      case 'craft':
        return <CraftTab recipes={recipes} inventory={inventory} onCraft={onCraft} />;
      case 'socials':
        return (
          <SocialsTab
            currentMood={currentMood}
            currentPose={currentPose}
            onSetMood={onSetMood}
            onSetPose={onSetPose}
          />
        );
      case 'settings':
        return <SettingsTab onLogout={onLogout} onCloseMenu={onClose} />;
      default:
        return null;
    }
  };

  const currentTab = TABS.find(t => t.key === activeTab);

  return (
    <Modal testID="menu-panel" visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Constrained content area */}
          <PageContainer style={styles.pageContainer}>
            {/* Header - title centered, Leave link on right */}
            <View style={[styles.header, { borderBottomColor: envColors.border }]}>
              <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>{currentTab?.label}</Text>
            </View>

            {/* Leave link - positioned below header, right-aligned */}
            <TouchableOpacity testID="close-menu" onPress={onClose} style={styles.leaveButton}>
              <Text style={[styles.leaveText, { color: envColors.text }]}>Leave</Text>
            </TouchableOpacity>

            {/* Content Area - takes most of the screen */}
            <View testID={`${activeTab}-panel`} style={styles.contentArea}>
              {renderTabContent()}
            </View>
          </PageContainer>

          {/* Bottom Tab Bar - full width */}
          <View testID="menu-tabs" style={[styles.bottomTabBar, { borderTopColor: envColors.border }]}>
            {TABS.map((tab, index) => (
              <React.Fragment key={tab.key}>
                {index > 0 && <Text style={[styles.tabDot, dynamicStyles.tabDot]}>·</Text>}
                <TouchableOpacity
                  testID={`menu-tab-${tab.key}`}
                  onPress={() => handleTabPress(tab.key)}
                  style={styles.tabButton}
                >
                  <Text style={[styles.tabText, dynamicStyles.tabText, activeTab === tab.key && dynamicStyles.tabActive]}>
                    {tab.short}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  pageContainer: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 1,
  },
  leaveButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  leaveText: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  contentArea: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  tabDot: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textFaint,
    marginHorizontal: spacing.xs,
  },
  tabText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
  },
  tabActive: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
  tabContent: {
    flex: 1,
    paddingTop: spacing.md,
  },
  sectionHeader: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  value: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  muted: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  link: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    textDecorationLine: 'underline',
    lineHeight: 24,
  },
  selected: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    lineHeight: 24,
  },
  error: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.error,
    lineHeight: 24,
  },
  divider: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textFaint,
    textAlign: 'center',
    marginVertical: spacing.md,
    letterSpacing: 4,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  settingValue: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  attributeRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  attribute: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xs,
    paddingLeft: spacing.md,
  },
  questDetails: {
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  optionList: {
    gap: spacing.xs,
  },
});
