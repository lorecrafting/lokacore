// The Polish panel's styled pieces (design input section 2): storybook/theming roles only.
import { keyframes, styled } from 'storybook/theming';

export type Tone = 'grey' | 'pulse' | 'positive' | 'warning' | 'negative';
const pulse = keyframes({ '50%': { opacity: 0.3 } });
const filled = (c: string) => ({ background: c, borderColor: c });

export const Column = styled.div({ display: 'flex', flexDirection: 'column', height: '100%' });
export const Header = styled.div(({ theme }) => ({
  position: 'sticky',
  top: 0,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '0 10px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  background: theme.background.app,
  fontSize: 12,
  flexShrink: 0,
}));
export const Dot = styled.span<{ tone: Tone }>(({ theme, tone }) => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: 4,
  marginRight: 6,
  border: `1px solid ${theme.textMutedColor}`,
  ...(tone === 'pulse' && { ...filled(theme.color.secondary), animation: `${pulse} 1s infinite` }),
  ...(tone === 'positive' && filled(theme.color.positive)),
  ...(tone === 'warning' && filled(theme.color.warning)),
  ...(tone === 'negative' && filled(theme.color.negative)),
}));
export const List = styled.div({ flex: 1, overflowY: 'auto', padding: '8px 0' });
export const Owner = styled.div(({ theme }) => ({
  borderLeft: `3px solid ${theme.color.secondary}`,
  padding: '8px 10px',
  margin: '0 0 8px',
}));
export const Muted = styled.div(({ theme }) => ({ color: theme.textMutedColor, fontSize: 12 }));
export const Chip = styled.button(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  margin: '0 6px 4px 0',
  padding: '1px 6px',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 3,
  background: 'transparent',
  color: 'inherit',
  fontFamily: theme.typography.fonts.mono,
  fontSize: 12,
  cursor: 'pointer',
}));
export const Badge = styled.span(({ theme }) => ({
  border: `1px solid ${theme.textMutedColor}`,
  borderRadius: 2,
  padding: '0 4px',
  fontSize: 10,
  textTransform: 'uppercase',
}));
export const Mono = styled.span(({ theme }) => ({ fontFamily: theme.typography.fonts.mono }));
export const Card = styled.div<{ warn?: boolean }>(({ theme, warn }) => ({
  margin: '0 10px 8px',
  padding: 8,
  border: `1px solid ${warn ? theme.color.warning : theme.appBorderColor}`,
  borderRadius: 4,
}));
export const Composer = styled.div(({ theme }) => ({
  position: 'sticky',
  bottom: 0,
  padding: 10,
  borderTop: `1px solid ${theme.appBorderColor}`,
  background: theme.background.app,
  flexShrink: 0,
}));
export const Area = styled.textarea(({ theme }) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: 6,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 4,
  background: theme.input.background,
  color: theme.input.color,
  font: 'inherit',
  fontSize: 14,
  resize: 'none',
}));
export const Negative = styled.span(({ theme }) => ({ color: theme.color.negative, fontSize: 11 }));
