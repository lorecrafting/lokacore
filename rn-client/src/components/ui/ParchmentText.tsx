import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes } from '../../theme/colors';

type Variant = 'title' | 'body' | 'bold' | 'italic' | 'small' | 'entityTitle';

interface ParchmentTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  children?: React.ReactNode;
}

const variantStyles: Record<Variant, { fontFamily: string; fontSize: number; color: string }> = {
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.title,
    color: colors.title,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    color: colors.body,
  },
  bold: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.bold,
    color: colors.body,
  },
  italic: {
    fontFamily: fonts.italic,
    fontSize: fontSizes.italic,
    color: colors.secondary,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.secondary,
  },
  entityTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.entityTitle,
    color: colors.entityTitle,
  },
};

export function ParchmentText({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: ParchmentTextProps) {
  const base = variantStyles[variant];

  return (
    <Text
      style={[
        styles.base,
        {
          fontFamily: base.fontFamily,
          fontSize: base.fontSize,
          color: color ?? base.color,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    // Sensible line height for parchment readability
    lineHeight: 28,
  },
});
