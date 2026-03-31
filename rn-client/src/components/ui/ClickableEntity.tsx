import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes } from '../../theme/colors';
import type { EntitySummary } from '../../types/game';

interface ClickableEntityProps {
  entity: EntitySummary;
  onPress: (entity: EntitySummary) => void;
}

function capitalizeSentences(text: string): string {
  return text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (match, prefix, letter) =>
    prefix + letter.toUpperCase()
  );
}

export function ClickableEntity({ entity, onPress }: ClickableEntityProps) {
  const raw = entity.long_desc || `${entity.name} is here.`;
  const prose = capitalizeSentences(raw);
  const keyword = entity.primary_keyword || entity.name;

  // Case-insensitive split around the keyword, preserving original casing
  const lowerProse = prose.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const idx = lowerProse.indexOf(lowerKeyword);

  if (idx === -1) {
    // Keyword not found in prose — fall back to fully tappable name
    return (
      <Text style={styles.prose}>
        <Text style={styles.keyword} onPress={() => onPress(entity)}>
          {prose}
        </Text>
      </Text>
    );
  }

  const before = prose.slice(0, idx);
  const found = prose.slice(idx, idx + keyword.length);
  const after = prose.slice(idx + keyword.length);

  return (
    <Text style={styles.prose}>
      {before}
      <Text style={styles.keyword} onPress={() => onPress(entity)}>
        {found}
      </Text>
      {after}
    </Text>
  );
}

const styles = StyleSheet.create({
  prose: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    color: colors.secondary,
    lineHeight: 24,
  },
  keyword: {
    color: colors.entityBody,
    textDecorationLine: 'underline',
    textDecorationColor: colors.entityBody,
  },
});
