import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, fonts, fontSizes } from "../../theme/colors";
import type { Direction } from "../../types/game";

interface CompassRoseProps {
  exits: Direction[];
  onNavigate: (direction: Direction) => void;
}

const BUTTON_WIDTH = 40;
const BUTTON_HEIGHT = 32;

function DirectionButton({
  direction,
  label,
  enabled,
  onPress,
  style,
}: {
  direction: Direction;
  label: string;
  enabled: boolean;
  onPress: (dir: Direction) => void;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.dirButton,
        style,
        !enabled && styles.dirButtonDisabled,
      ]}
      onPress={() => enabled && onPress(direction)}
      activeOpacity={enabled ? 0.6 : 1}
      disabled={!enabled}
    >
      <Text style={[styles.dirLabel, !enabled && styles.dirLabelDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CompassRose({ exits, onNavigate }: CompassRoseProps) {
  const has = (dir: Direction) => exits.includes(dir);

  return (
    <View style={styles.container}>
      {/* Up/Down column on the left */}
      <View style={styles.verticalColumn}>
        <DirectionButton
          direction="up"
          label="U"
          enabled={has("up")}
          onPress={onNavigate}
        />
        <View style={styles.verticalSpacer} />
        <DirectionButton
          direction="down"
          label="D"
          enabled={has("down")}
          onPress={onNavigate}
        />
      </View>

      {/* Main NSEW grid */}
      <View style={styles.grid}>
        {/* Row 1: North */}
        <View style={styles.row}>
          <View style={styles.cornerSpacer} />
          <DirectionButton
            direction="north"
            label="N"
            enabled={has("north")}
            onPress={onNavigate}
          />
          <View style={styles.cornerSpacer} />
        </View>

        {/* Row 2: West · East */}
        <View style={styles.row}>
          <DirectionButton
            direction="west"
            label="W"
            enabled={has("west")}
            onPress={onNavigate}
          />
          <View style={styles.centerDot}>
            <Text style={styles.dot}>·</Text>
          </View>
          <DirectionButton
            direction="east"
            label="E"
            enabled={has("east")}
            onPress={onNavigate}
          />
        </View>

        {/* Row 3: South */}
        <View style={styles.row}>
          <View style={styles.cornerSpacer} />
          <DirectionButton
            direction="south"
            label="S"
            enabled={has("south")}
            onPress={onNavigate}
          />
          <View style={styles.cornerSpacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  verticalColumn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
  },
  verticalSpacer: {
    height: BUTTON_HEIGHT,
  },
  grid: {
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  dirButton: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 3,
    backgroundColor: "transparent",
  },
  dirButtonDisabled: {
    opacity: 0.5,
  },
  dirLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.small,
    color: colors.barActive,
  },
  dirLabelDisabled: {
    color: colors.barDisabled,
  },
  cornerSpacer: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
  },
  centerDot: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    fontFamily: fonts.regular,
    fontSize: 20,
    color: colors.barDisabled,
  },
});
