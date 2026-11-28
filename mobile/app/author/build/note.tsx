// A field's schema description in the builder (loka-hcnlh.84; BOOK-UI-COMPONENTS generic sheet): the
// dim note beneath a name, and the same words as the button's hint.
import { Text } from 'react-native';
import { type } from '../../book/tokens.ts';
import { ink } from './build.ts';

/** A field's description: a dim sentence under its name, wrapped whole. */
export const note = (about?: string) =>
  about ? (
    <Text key="a" style={{ ...type.small, color: ink('dim') }}>
      {about}
    </Text>
  ) : null;

/** A described button's accessible `name` and its hint, the description, read once. The web drops
 * accessibilityHint (react-native-web), so aria-description is set by hand, as Unavailable's wait is. */
export const hint = (name: string, about?: string) =>
  about
    ? {
        accessibilityLabel: name,
        accessibilityHint: about,
        ref: (n: unknown) => (n as Element | null)?.setAttribute?.('aria-description', about),
      }
    : {};
