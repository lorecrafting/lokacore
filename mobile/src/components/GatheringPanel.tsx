/**
 * Gathering Panel Component
 * Slide-up panel for gathering resources from nodes in the room
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
import type { Entity } from '../types/game';

interface GatheringPanelProps {
  visible: boolean;
  gatheringNodes: Entity[];
  onGather: (nodeType: string) => void;
  onClose: () => void;
}

// Map entity keys to display names and descriptions
const NODE_INFO: Record<string, { name: string; description: string; icon: string }> = {
  herb_patch: { name: 'Herb Patch', description: 'Gather medicinal herbs and plants.', icon: 'Herbs' },
  mineral_vein: { name: 'Mineral Vein', description: 'Mine ore and precious stones.', icon: 'Ore' },
  wood_pile: { name: 'Wood Pile', description: 'Collect wood and timber.', icon: 'Wood' },
  water_source: { name: 'Water Source', description: 'Collect fresh water.', icon: 'Water' },
  fishing_spot: { name: 'Fishing Spot', description: 'Catch fish and aquatic creatures.', icon: 'Fish' },
  foraging_spot: { name: 'Foraging Spot', description: 'Find berries, mushrooms, and wild foods.', icon: 'Food' },
};

export function GatheringPanel({
  visible,
  gatheringNodes,
  onGather,
  onClose,
}: GatheringPanelProps) {
  const getNodeInfo = (entity: Entity) => {
    const key = entity.key || entity.id;
    return NODE_INFO[key] || {
      name: entity.name,
      description: entity.long_desc || entity.description || 'A resource node.',
      icon: 'Node',
    };
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
            <Text style={styles.title}>Gather Resources</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {gatheringNodes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  There are no resource nodes here to gather from.
                </Text>
                <Text style={styles.emptyHint}>
                  Explore the world to find herbs, minerals, and other resources.
                </Text>
              </View>
            ) : (
              <View style={styles.nodeList}>
                {gatheringNodes.map((node) => {
                  const info = getNodeInfo(node);
                  return (
                    <View key={node.id} style={styles.nodeRow}>
                      <View style={styles.nodeIcon}>
                        <Text style={styles.nodeIconText}>{info.icon}</Text>
                      </View>
                      <View style={styles.nodeInfo}>
                        <Text style={styles.nodeName}>{info.name}</Text>
                        <Text style={styles.nodeDesc} numberOfLines={2}>
                          {info.description}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.gatherButton}
                        onPress={() => onGather(node.key || node.id)}
                      >
                        <Text style={styles.gatherButtonText}>Gather</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
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
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  nodeList: {
    gap: spacing.md,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  nodeIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  nodeIconText: {
    fontFamily: fonts.serif,
    fontSize: 10,
    color: colors.text,
    fontWeight: '600',
  },
  nodeInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  nodeName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  nodeDesc: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  gatherButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  gatherButtonText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
  },
});
