import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { useGameStore } from '../../store/gameStore';
import { colors } from '../../theme/colors';
import type { InventoryItem } from '../../types/game';

export function ContainerPage() {
  const container = useGameStore((s) => s.container);
  const closeContainer = useGameStore((s) => s.closeContainer);

  if (!container) {
    return (
      <ParchmentPage>
        <ParchmentText variant="body" color={colors.secondary}>
          No container open.
        </ParchmentText>
      </ParchmentPage>
    );
  }

  function handleTake(item: InventoryItem) {
    console.log('[ContainerPage] take item:', item.id, item.name);
  }

  function handlePut(item: InventoryItem) {
    console.log('[ContainerPage] put item:', item.id, item.name);
  }

  return (
    <ParchmentPage>
      {/* Container name */}
      <ParchmentText variant="title" style={styles.title}>
        {container.name}
      </ParchmentText>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Item list */}
      {container.items.length === 0 ? (
        <ParchmentText variant="italic" color={colors.secondary} style={styles.emptyText}>
          It is empty.
        </ParchmentText>
      ) : (
        <View style={styles.itemList}>
          {container.items.map((item) => (
            <ContainerItemRow
              key={item.id}
              item={item}
              onTake={handleTake}
              onPut={handlePut}
            />
          ))}
        </View>
      )}

      {/* Close button */}
      <TouchableOpacity
        onPress={closeContainer}
        activeOpacity={0.6}
        style={styles.closeButton}
      >
        <ParchmentText variant="small" color={colors.barActive} style={styles.closeButtonText}>
          [Close]
        </ParchmentText>
      </TouchableOpacity>
    </ParchmentPage>
  );
}

interface ContainerItemRowProps {
  item: InventoryItem;
  onTake: (item: InventoryItem) => void;
  onPut: (item: InventoryItem) => void;
}

function ContainerItemRow({ item, onTake, onPut }: ContainerItemRowProps) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <ParchmentText variant="body" style={styles.itemName}>
          {item.name}
        </ParchmentText>
        {item.quantity > 1 && (
          <ParchmentText variant="small" color={colors.secondary} style={styles.itemQty}>
            x{item.quantity}
          </ParchmentText>
        )}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          onPress={() => onTake(item)}
          activeOpacity={0.6}
          style={styles.actionButton}
        >
          <ParchmentText variant="small" color={colors.barActive} style={styles.actionButtonText}>
            [Take]
          </ParchmentText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onPut(item)}
          activeOpacity={0.6}
          style={styles.actionButton}
        >
          <ParchmentText variant="small" color={colors.barActive} style={styles.actionButtonText}>
            [Put]
          </ParchmentText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.separator,
    marginBottom: 16,
  },
  emptyText: {
    marginTop: 8,
    marginBottom: 24,
  },
  itemList: {
    gap: 10,
    marginBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.decorative,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingRight: 12,
  },
  itemName: {
    flex: 1,
  },
  itemQty: {
    lineHeight: 22,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.barActive,
  },
  actionButtonText: {
    letterSpacing: 0.5,
  },
  closeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.barActive,
    marginTop: 8,
  },
  closeButtonText: {
    letterSpacing: 0.5,
  },
});
