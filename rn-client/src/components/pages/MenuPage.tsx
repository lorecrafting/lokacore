import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { useGameStore } from '../../store/gameStore';
import { usePresetPreview } from '../BookController';
import { CURL_PRESETS, PRESET_KEYS } from '../PageCurlAnimation';
import { colors, fonts, fontSizes, spacing } from '../../theme/colors';
import type { MenuTab, InventoryItem, Quest } from '../../types/game';

const TABS: MenuTab[] = [
  'INVENTORY',
  'EQUIPMENT',
  'CHARACTER',
  'QUESTS',
  'MAP',
  'SOCIAL',
  'SETTINGS',
  'DEV',
];

const TAB_LABELS: Record<MenuTab, string> = {
  INVENTORY: 'Inv',
  EQUIPMENT: 'Equip',
  CHARACTER: 'Stats',
  QUESTS: 'Quests',
  MAP: 'Map',
  SOCIAL: 'Social',
  SETTINGS: 'Settings',
  DEV: 'Dev',
};

export function MenuPage() {
  const menuTab = useGameStore((s) => s.menuTab);
  const setMenuTab = useGameStore((s) => s.setMenuTab);
  const setPage = useGameStore((s) => s.setPage);
  const previousPage = useGameStore((s) => s.previousPage);

  function handleBack() {
    setPage(previousPage ?? 'ROOM');
  }

  return (
    <View style={styles.outerContainer}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarInner}
        >
          {TABS.map((tab) => {
            const isActive = tab === menuTab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setMenuTab(tab)}
                activeOpacity={0.6}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <ParchmentText
                  variant="small"
                  color={isActive ? colors.tabActive : colors.tab}
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                >
                  {TAB_LABELS[tab]}
                </ParchmentText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content area */}
      <View style={styles.contentArea}>
        <TabContent tab={menuTab} />
      </View>

      {/* Back button */}
      <View style={styles.backRow}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.6}>
          <ParchmentText variant="small" color={colors.secondary}>
            [Close]
          </ParchmentText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Tab content router
function TabContent({ tab }: { tab: MenuTab }) {
  switch (tab) {
    case 'INVENTORY':
      return <InventoryTab />;
    case 'QUESTS':
      return <QuestsTab />;
    case 'DEV':
      return <DevTab />;
    default:
      return <PlaceholderTab tab={tab} />;
  }
}

function InventoryTab() {
  const inventory = useGameStore((s) => s.inventory);

  return (
    <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <ParchmentText variant="bold" style={styles.tabHeading}>
        Inventory
      </ParchmentText>
      <View style={styles.tabSeparator} />
      {inventory.length === 0 ? (
        <ParchmentText variant="italic" color={colors.secondary} style={styles.emptyText}>
          Your pack is empty.
        </ParchmentText>
      ) : (
        <View style={styles.itemList}>
          {inventory.map((item) => (
            <InventoryRow key={item.id} item={item} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  return (
    <View style={styles.inventoryRow}>
      <ParchmentText variant="body" style={styles.inventoryName}>
        {item.name}
      </ParchmentText>
      <View style={styles.inventoryMeta}>
        {item.quantity > 1 && (
          <ParchmentText variant="small" color={colors.secondary} style={styles.inventoryQty}>
            x{item.quantity}
          </ParchmentText>
        )}
        {item.equipped && (
          <ParchmentText variant="small" color={colors.action} style={styles.equippedBadge}>
            [equipped]
          </ParchmentText>
        )}
      </View>
    </View>
  );
}

function QuestsTab() {
  const quests = useGameStore((s) => s.quests);
  const activeQuests = quests.filter((q) => q.status === 'active');
  const completedQuests = quests.filter((q) => q.status === 'completed');

  return (
    <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <ParchmentText variant="bold" style={styles.tabHeading}>
        Quests
      </ParchmentText>
      <View style={styles.tabSeparator} />
      {quests.length === 0 ? (
        <ParchmentText variant="italic" color={colors.secondary} style={styles.emptyText}>
          No active quests.
        </ParchmentText>
      ) : (
        <>
          {activeQuests.length > 0 && (
            <View style={styles.questGroup}>
              <ParchmentText variant="italic" color={colors.secondary} style={styles.questGroupLabel}>
                Active
              </ParchmentText>
              {activeQuests.map((q) => (
                <QuestRow key={q.id} quest={q} />
              ))}
            </View>
          )}
          {completedQuests.length > 0 && (
            <View style={styles.questGroup}>
              <ParchmentText variant="italic" color={colors.secondary} style={styles.questGroupLabel}>
                Completed
              </ParchmentText>
              {completedQuests.map((q) => (
                <QuestRow key={q.id} quest={q} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  const isComplete = quest.status === 'completed';
  return (
    <View style={styles.questRow}>
      <ParchmentText
        variant="bold"
        color={isComplete ? colors.secondary : colors.body}
        style={styles.questName}
      >
        {quest.name}
      </ParchmentText>
      <ParchmentText variant="small" color={colors.secondary} style={styles.questDesc}>
        {quest.description}
      </ParchmentText>
      {quest.objectives.length > 0 && (
        <View style={styles.objectiveList}>
          {quest.objectives.map((obj) => (
            <View key={obj.id} style={styles.objectiveRow}>
              <ParchmentText
                variant="small"
                color={obj.completed ? colors.secondary : colors.body}
                style={[styles.objectiveText, obj.completed && styles.objectiveComplete]}
              >
                {obj.completed ? '[x] ' : '[ ] '}{obj.description}
              </ParchmentText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DevTab() {
  const { previewPreset, currentPreset } = usePresetPreview();
  const setPage = useGameStore((s) => s.setPage);
  const previousPage = useGameStore((s) => s.previousPage);

  function handlePreview(key: string) {
    // Go back to ROOM first so the curl animation plays over page content
    setPage(previousPage ?? 'ROOM');
    // Small delay to let the page swap render, then trigger the preview
    setTimeout(() => previewPreset(key), 100);
  }

  return (
    <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <ParchmentText variant="bold" style={styles.tabHeading}>
        Development
      </ParchmentText>
      <View style={styles.tabSeparator} />

      <ParchmentText variant="italic" color={colors.secondary} style={styles.devSectionLabel}>
        Page Curl Presets
      </ParchmentText>
      <ParchmentText variant="small" color={colors.secondary} style={styles.devHint}>
        Tap to preview. Current: {CURL_PRESETS[currentPreset]?.name ?? currentPreset}
      </ParchmentText>

      <View style={styles.presetList}>
        {PRESET_KEYS.map((key) => {
          const preset = CURL_PRESETS[key];
          const isActive = key === currentPreset;
          const curlModeLabel = ['Straight', 'Top Corner', 'Bottom Corner'][preset.curlMode];
          return (
            <TouchableOpacity
              key={key}
              style={[styles.presetButton, isActive && styles.presetButtonActive]}
              onPress={() => handlePreview(key)}
              activeOpacity={0.7}
            >
              <ParchmentText
                variant="bold"
                color={isActive ? colors.action : colors.body}
                style={styles.presetName}
              >
                {preset.name}
                {isActive ? '  *' : ''}
              </ParchmentText>
              <ParchmentText variant="small" color={colors.secondary}>
                {curlModeLabel} | stiff={preset.stiffness} lift={preset.liftBend}° land={preset.landBend}° lag={preset.curlLag} | {preset.duration}s
              </ParchmentText>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function PlaceholderTab({ tab }: { tab: MenuTab }) {
  const labels: Record<string, string> = {
    EQUIPMENT: 'Equipment slots will appear here.',
    CHARACTER: 'Character stats will appear here.',
    MAP: 'Map will appear here.',
    SOCIAL: 'Social features will appear here.',
    SETTINGS: 'Settings will appear here.',
  };

  return (
    <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <ParchmentText variant="bold" style={styles.tabHeading}>
        {TAB_LABELS[tab]}
      </ParchmentText>
      <View style={styles.tabSeparator} />
      <ParchmentText variant="italic" color={colors.secondary} style={styles.emptyText}>
        {labels[tab] ?? 'Coming soon.'}
      </ParchmentText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    backgroundColor: colors.parchment,
  },
  tabBarInner: {
    paddingHorizontal: spacing.pagePaddingH,
    paddingTop: spacing.pagePaddingTop,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 0,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.tabActive,
  },
  tabLabel: {
    letterSpacing: 0.4,
  },
  tabLabelActive: {
    // bold handled via color contrast; use fontFamily if needed
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: spacing.pagePaddingH,
    paddingTop: 16,
  },
  tabScroll: {
    flex: 1,
  },
  tabHeading: {
    marginBottom: 8,
  },
  tabSeparator: {
    height: 1,
    backgroundColor: colors.separator,
    marginBottom: 14,
  },
  emptyText: {
    marginTop: 8,
  },
  itemList: {
    gap: 8,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.decorative,
  },
  inventoryName: {
    flex: 1,
  },
  inventoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inventoryQty: {
    // secondary color already set
  },
  equippedBadge: {
    // action color already set
  },
  questGroup: {
    marginBottom: 20,
  },
  questGroupLabel: {
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  questRow: {
    marginBottom: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.separator,
  },
  questName: {
    marginBottom: 2,
  },
  questDesc: {
    marginBottom: 8,
  },
  objectiveList: {
    gap: 4,
  },
  objectiveRow: {
    flexDirection: 'row',
  },
  objectiveText: {
    flex: 1,
    lineHeight: 22,
  },
  objectiveComplete: {
    // secondary color already set
    textDecorationLine: 'line-through',
  },
  backRow: {
    paddingHorizontal: spacing.pagePaddingH,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  devSectionLabel: {
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  devHint: {
    marginBottom: 12,
  },
  presetList: {
    gap: 8,
    paddingBottom: 20,
  },
  presetButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 6,
  },
  presetButtonActive: {
    borderColor: colors.action,
    borderWidth: 2,
  },
  presetName: {
    marginBottom: 2,
  },
});
