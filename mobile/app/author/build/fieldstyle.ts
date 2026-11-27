// The in-place field's styles and button words (field.tsx), apart so field.tsx keeps its size.
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';

export const BLANK = { borderBottomWidth: size.rule, borderColor: ink('line') };
export const MARKED = {
  textDecorationLine: 'underline',
  textDecorationStyle: 'wavy' as 'dashed', // web draws wavy; RN's types stop at dashed
  textDecorationColor: ink('warning'),
} as const;
export const NOTE = { ...type.label, color: ink('warning') };
export const CAPTION = { ...type.label, color: ink('dim') };
export const FIELD = {
  width: '100%',
  borderBottomWidth: size.rule,
  borderColor: ink('action'),
} as const;
export const WORDS = { save: 'Save', cancel: 'Cancel' }; // placeholders: the owner writes these
export const CHOICE = {
  ...type.control,
  color: ink('action'),
  lineHeight: size.touch,
  paddingHorizontal: space.md,
};
