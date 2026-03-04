import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes } from '../../theme/colors';
import type { EntitySummary } from '../../types/game';

interface ClickableEntityProps {
  entity: EntitySummary;
  onPress: (entity: EntitySummary) => void;
}

export function ClickableEntity({ entity, onPress }: ClickableEntityProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(entity)}
      activeOpacity={0.6}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Text style={styles.name}>{entity.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  name: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    color: colors.entityBody,
    textDecorationLine: 'underline',
    textDecorationColor: colors.entityBody,
  },
});
