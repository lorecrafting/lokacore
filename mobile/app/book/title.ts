import { createContext, useContext } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

// A page's title takes focus as its page arrives by a turn (BOOK-UI-COMPONENTS.md#page-turn):
// keyboard focus on web (tabIndex -1: focusable, not a tab stop), the screen reader's on a device.
// The first page (launch, a story) takes none, so no ring shows before keyboard use. One ref per
// Book, read as each title mounts, so the page a turn leaves behind is not focused again.
type Title = (Text & { focus?: () => void }) | null;
export function titleFocus() {
  const box = {
    turned: false,
    ref: (title: Title) => {
      if (!title || !box.turned) return;
      title.focus?.();
      AccessibilityInfo.sendAccessibilityEvent?.(title, 'focus');
    },
  };
  return box;
}
export const titleContext = createContext(titleFocus());
export const useTitleFocus = () => ({
  ref: useContext(titleContext).ref,
  ...({ tabIndex: -1 } as object),
});
