/**
 * Container Modal Component
 * Modal for interacting with containers (chests, bags, etc.)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useEnvironment } from './EnvironmentContext';
import { colors, fonts, spacing } from '../theme';
import type { ContainerState } from '../types/game';

interface ContainerModalProps {
  container: ContainerState;
  onTake: (index: number) => void;
  onClose: () => void;
}

export function ContainerModal({
  container,
  onTake,
  onClose,
}: ContainerModalProps) {
  // Get environment context for dynamic theming
  const { colors: envColors } = useEnvironment();

  // Create dynamic styles based on environment
  const dynamicStyles = useMemo(() => ({
    panel: { backgroundColor: envColors.background },
    border: { borderColor: envColors.border },
    title: { color: envColors.text },
    closeText: { color: envColors.textMuted },
    emptyText: { color: envColors.textMuted },
    itemName: { color: envColors.text },
    itemDesc: { color: envColors.textMuted },
    takeButton: { borderColor: envColors.text },
    takeButtonText: { color: envColors.text },
  }), [envColors]);

  return (
    <Modal
      visible={container.open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.panel, dynamicStyles.panel]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={[styles.header, dynamicStyles.border]}>
            <Text style={[styles.title, dynamicStyles.title]}>{container.entityName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, dynamicStyles.closeText]}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {container.items.length === 0 ? (
              <Text style={[styles.emptyText, dynamicStyles.emptyText]}>The container is empty.</Text>
            ) : (
              <View style={styles.itemList}>
                {container.items.map((item, index) => (
                  <View key={item.id || index} style={[styles.itemRow, dynamicStyles.border]}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, dynamicStyles.itemName]}>{item.name}</Text>
                      {item.description && (
                        <Text style={[styles.itemDesc, dynamicStyles.itemDesc]} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.takeButton, dynamicStyles.takeButton]}
                      onPress={() => onTake(index)}
                    >
                      <Text style={[styles.takeButtonText, dynamicStyles.takeButtonText]}>Take</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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
    maxHeight: '60%',
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
    fontSize: 22,
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
  content: {
    padding: spacing.md,
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
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
  },
  itemDesc: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  takeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 4,
  },
  takeButtonText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
  },
});
