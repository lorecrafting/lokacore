/**
 * Inventory Panel Component
 * Slide-up panel for viewing and managing inventory items
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import type { InventoryItem, EquippedItem } from '../types/game';

interface InventoryPanelProps {
  visible: boolean;
  inventory: InventoryItem[];
  equipped: Record<string, EquippedItem>;
  gold?: number;
  onClose: () => void;
  onDropItem: (itemId: string) => void;
  onEquipItem: (itemId: string) => void;
  onUnequipItem: (slot: string) => void;
  onUseItem: (itemId: string) => void;
}

const EQUIPMENT_SLOTS = ['head', 'body', 'hands', 'feet', 'weapon', 'shield', 'light', 'accessory'];

export function InventoryPanel({
  visible,
  inventory,
  equipped,
  gold = 0,
  onClose,
  onDropItem,
  onEquipItem,
  onUnequipItem,
  onUseItem,
}: InventoryPanelProps) {
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);

  const isEquippable = (item: InventoryItem) => {
    const components = item.components || [];
    // Handle both array format (from server) and object format
    if (Array.isArray(components)) {
      return components.some(c => ['equipable', 'equippable', 'wearable', 'weapon'].includes(c));
    }
    return 'equipable' in components || 'equippable' in components || 'wearable' in components || 'weapon' in components;
  };

  const isConsumable = (item: InventoryItem) => {
    const components = item.components || {};
    return 'consumable' in components || 'usable' in components;
  };

  const handleItemPress = (item: InventoryItem) => {
    setSelectedItem(selectedItem?.id === item.id ? null : item);
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Inventory</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Gold Display */}
          <View style={styles.goldBar}>
            <Text style={styles.goldText}>Gold: {gold}</Text>
          </View>

          <ScrollView style={styles.content}>
            {/* Equipment Section */}
            <Text style={styles.sectionTitle}>Equipment</Text>
            <View style={styles.equipmentGrid}>
              {EQUIPMENT_SLOTS.map((slot) => {
                const equippedItem = equipped[slot];
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.equipmentSlot,
                      equippedItem && styles.equipmentSlotFilled,
                    ]}
                    onPress={() => equippedItem && onUnequipItem(slot)}
                  >
                    <Text style={styles.slotLabel}>{slot}</Text>
                    {equippedItem ? (
                      <Text style={styles.equippedItemName} numberOfLines={1}>
                        {equippedItem.name}
                      </Text>
                    ) : (
                      <Text style={styles.emptySlot}>Empty</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Inventory Section */}
            <Text style={styles.sectionTitle}>Items ({inventory.length})</Text>
            {inventory.length === 0 ? (
              <Text style={styles.emptyText}>Your inventory is empty.</Text>
            ) : (
              <View style={styles.itemList}>
                {inventory.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemRow,
                      selectedItem?.id === item.id && styles.itemRowSelected,
                    ]}
                    onPress={() => handleItemPress(item)}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.description && (
                        <Text style={styles.itemDesc} numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {item.quantity && item.quantity > 1 && (
                      <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Item Actions */}
            {selectedItem && (
              <View style={styles.actionsBar}>
                {isEquippable(selectedItem) && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleAction('equip')}
                  >
                    <Text style={styles.actionText}>Equip</Text>
                  </TouchableOpacity>
                )}
                {isConsumable(selectedItem) && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleAction('use')}
                  >
                    <Text style={styles.actionText}>Use</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleAction('drop')}
                >
                  <Text style={styles.actionText}>Drop</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  goldBar: {
    padding: spacing.md,
    backgroundColor: colors.border,
  },
  goldText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  equipmentSlot: {
    width: '30%',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  equipmentSlotFilled: {
    backgroundColor: colors.border,
  },
  slotLabel: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  equippedItemName: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
    marginTop: 2,
  },
  emptySlot: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textFaint,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },
  itemList: {
    gap: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  itemRowSelected: {
    backgroundColor: colors.border,
    borderColor: colors.text,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
  },
  itemDesc: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
  },
  itemQuantity: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 8,
  },
  actionButtonDanger: {
    borderColor: colors.error,
  },
  actionText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
  },
});
