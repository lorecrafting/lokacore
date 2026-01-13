/**
 * Room View Component
 * Displays the current room with description, entities, items, and other players
 * Uses book-style layout: centered container with left-aligned text
 * Integrates with EnvironmentContext for dynamic theming based on time/weather
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
  Animated,
} from 'react-native';
import { EbookTitle, EbookProse } from './EbookText';
import { useEnvironment } from './EnvironmentContext';
import { fonts, spacing } from '../theme';
import type { Room, Player, GameEvent, Entity, Item } from '../types/game';

/**
 * Strip HTML tags from text and return clean content
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

interface RoomViewProps {
  room: Room;
  otherPlayers: Player[];
  events: GameEvent[];
  onEntityPress: (id: string, type: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders text with an underlined keyword that's clickable (inline version for use inside Text)
 * Only the keyword is underlined, matching the web client's LegendMUD style
 */
function HighlightedTextInline({
  text,
  keyword,
  onPress,
  textColor,
}: {
  text: string;
  keyword?: string;
  onPress?: () => void;
  textColor: string;
}) {
  // Base prose style for all entity text - matches EbookProse
  const baseStyle = useMemo(
    () => ({
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 28,
      color: textColor,
    }),
    [textColor]
  );

  const keywordStyle = useMemo(
    () => [baseStyle, styles.entityKeyword],
    [baseStyle]
  );

  if (!keyword || !text) {
    return (
      <Text style={keywordStyle} onPress={onPress}>
        {text}
      </Text>
    );
  }

  // Find the keyword in the text (case insensitive)
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordIndex = lowerText.indexOf(lowerKeyword);

  if (keywordIndex === -1) {
    // Keyword not found, just underline the first word as fallback
    const words = text.split(' ');
    const firstWord = words[0];
    const rest = words.slice(1).join(' ');
    return (
      <Text style={baseStyle}>
        <Text style={keywordStyle} onPress={onPress}>
          {firstWord}
        </Text>
        {rest ? ` ${rest}` : ''}
      </Text>
    );
  }

  // Split into before, keyword, and after
  const before = text.slice(0, keywordIndex);
  const actualKeyword = text.slice(keywordIndex, keywordIndex + keyword.length);
  const after = text.slice(keywordIndex + keyword.length);

  return (
    <Text style={baseStyle}>
      {before}
      <Text style={keywordStyle} onPress={onPress}>
        {actualKeyword}
      </Text>
      {after}
    </Text>
  );
}

// Maximum entities to show before collapsing
const MAX_VISIBLE_ENTITIES = 5;

export function RoomView({
  room,
  otherPlayers,
  events,
  onEntityPress,
  style,
}: RoomViewProps) {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [entitiesExpanded, setEntitiesExpanded] = useState(false);

  // Get environment context for dynamic theming
  const { colors, animatedColors, textVisibility, candleFlicker, hasFlicker } = useEnvironment();

  // Combine text opacity with candle flicker effect
  const flickeringOpacity = useMemo(() => {
    if (hasFlicker) {
      return Animated.multiply(textVisibility.textOpacity, candleFlicker);
    }
    return textVisibility.textOpacity;
  }, [hasFlicker, textVisibility.textOpacity, candleFlicker]);

  // Event log opacity - always slightly visible but better with light
  // Minimum 0.35 so events are readable in darkness, scales up with light
  const eventOpacity = useMemo(() => {
    const baseOpacity = Math.max(textVisibility.textOpacity, 0.35);
    if (hasFlicker) {
      return Animated.multiply(baseOpacity, candleFlicker);
    }
    return baseOpacity;
  }, [hasFlicker, textVisibility.textOpacity, candleFlicker]);

  // Auto-scroll to bottom when events change
  React.useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [events]);

  // Reset expansion when room changes
  React.useEffect(() => {
    setEntitiesExpanded(false);
  }, [room.id]);

  // Get display text for an entity (long_desc or fallback)
  const getEntityText = (entity: Entity) => {
    return entity.long_desc || `${entity.name} is here.`;
  };

  // Get display text for an item (long_desc or fallback)
  // Ensures proper sentence formatting: capital first letter, period at end
  const getItemText = (item: Item) => {
    let text = item.long_desc || `${item.name} lies here.`;
    // Capitalize first letter
    text = text.charAt(0).toUpperCase() + text.slice(1);
    // Ensure period at end
    if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
      text += '.';
    }
    return text;
  };

  // Combine NPCs and players into one list, NPCs first for priority
  const allCharacters = [
    ...room.entities.map((e) => ({ ...e, entityType: 'npc' as const })),
    ...otherPlayers.map((p) => ({
      ...p,
      entityType: 'player' as const,
      long_desc: `${p.name} stands here.`,
      primary_keyword: p.name,
    })),
  ];

  // Determine which characters to show
  const shouldCollapse =
    allCharacters.length > MAX_VISIBLE_ENTITIES && !entitiesExpanded;
  const visibleCharacters = shouldCollapse
    ? allCharacters.slice(0, MAX_VISIBLE_ENTITIES)
    : allCharacters;
  const hiddenCount = allCharacters.length - MAX_VISIBLE_ENTITIES;

  const handleExpandEntities = useCallback(() => {
    setEntitiesExpanded(true);
  }, []);

  // Create dynamic styles based on environment
  const dynamicStyles = useMemo(
    () => ({
      container: {
        flex: 1,
        // Background is handled by DynamicBackground in PageContainer
      },
      entityText: {
        fontFamily: fonts.serif,
        fontSize: 17,
        lineHeight: 28,
        color: colors.text,
        opacity: textVisibility.textOpacity,
      },
      event: {
        marginBottom: spacing.sm,
        fontSize: 16,
        fontStyle: 'italic' as const,
        color: colors.textMuted,
        opacity: textVisibility.textOpacity,
      },
      eventsContainer: {
        marginTop: spacing.sm,
        width: '100%' as const,
      },
    }),
    [colors, textVisibility]
  );

  return (
    <ScrollView
      testID="room-view"
      ref={scrollViewRef}
      style={[styles.container, dynamicStyles.container, style]}
      contentContainerStyle={styles.content}
    >
      {/* Room Title - uses animated text color */}
      <Animated.View style={{ opacity: flickeringOpacity }}>
        <EbookTitle
          testID="room-title"
          style={{ color: animatedColors.text }}
        >
          {room.title}
        </EbookTitle>
      </Animated.View>

      {/* Room Description */}
      <Animated.View style={{ opacity: flickeringOpacity }}>
        <EbookProse
          testID="room-description"
          style={{ ...styles.description, color: animatedColors.text }}
        >
          {room.description}
        </EbookProse>
      </Animated.View>

      {/* NPCs and Players together - single paragraph with inline tappable text */}
      {allCharacters.length > 0 && (
        <Animated.View testID="entity-text" style={[styles.paragraph, { opacity: flickeringOpacity }]}>
          <Text style={[styles.proseBase, { color: colors.text }]}>
            {visibleCharacters.map((char, index) => {
              const handlePress = () => onEntityPress(char.id, char.entityType);
              const entityText = char.entityType === 'player'
                ? `${char.name} stands here.`
                : getEntityText(char);
              return (
                <React.Fragment key={char.id}>
                  {index > 0 && ' '}
                  <HighlightedTextInline
                    text={entityText}
                    keyword={char.primary_keyword}
                    onPress={handlePress}
                    textColor={colors.text}
                  />
                </React.Fragment>
              );
            })}
            {/* Show expandable link if collapsed */}
            {shouldCollapse && hiddenCount > 0 && (
              <Text
                style={styles.expandLinkText}
                onPress={handleExpandEntities}
                accessibilityLabel={`Show ${hiddenCount} more`}
                accessibilityRole="button"
              >
                {' '}and {hiddenCount} others...
              </Text>
            )}
          </Text>
        </Animated.View>
      )}

      {/* Items - single paragraph with inline tappable text */}
      {room.items.length > 0 && (
        <Animated.View testID="room-items" style={[styles.paragraph, { opacity: flickeringOpacity }]}>
          <Text style={[styles.proseBase, { color: colors.text }]}>
            {room.items.map((item, index) => {
              const handlePress = () => onEntityPress(item.id, 'item');
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && ' '}
                  <HighlightedTextInline
                    text={getItemText(item)}
                    keyword={item.primary_keyword}
                    onPress={handlePress}
                    textColor={colors.text}
                  />
                </React.Fragment>
              );
            })}
          </Text>
        </Animated.View>
      )}

      {/* Events - with dynamic border color */}
      {events.length > 0 && (
        <Animated.View testID="room-events" style={[dynamicStyles.eventsContainer, { opacity: eventOpacity }]}>
          {events.map((event, index) => (
            <EbookProse
              key={index}
              style={{ ...dynamicStyles.event, color: animatedColors.textMuted }}
            >
              {stripHtml(event.text)}
            </EbookProse>
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  description: {
    marginBottom: -18,  // Pull NPCs closer to match paragraph spacing
  },
  paragraph: {
    marginTop: spacing.sm,
    width: '100%',
  },
  // Base prose style - matches EbookProse for unified typography
  proseBase: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 28,
  },
  entityKeyword: {
    textDecorationLine: 'underline',
  },
  expandLinkText: {
    textDecorationLine: 'underline',
    fontStyle: 'italic',
  },
});
