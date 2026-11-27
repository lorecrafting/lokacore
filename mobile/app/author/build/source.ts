// Open source (docs/system/book-ui.md#build-sheets, slice 6.5a; the panel's source footer): the
// owner's editor opens a file or a Book line (POST /open), from a Sheet foot's path, an Alt-click on
// a Book line, and Cmd-E (6.5b). A refusal is said where it was asked; success says nothing.
import type { clicked } from '../prose_rules.ts';
import { api } from './page.ts';

const WORDS = { refused: (why: string) => `Not opened: ${why}` }; // placeholder words, the owner's
type Sent = { file?: string } | ReturnType<typeof clicked>;

/** One /open: '' when the editor opened it, else the refusal line. */
export async function openSource(sent: Sent) {
  try {
    const [status, why] = await api('/open', sent);
    return status === 200 ? '' : WORDS.refused(typeof why === 'string' ? why : `HTTP ${status}`);
  } catch (e) {
    return WORDS.refused((e as Error).message); // the server down
  }
}
/** The strip's refusal line, until the next open from the strip's routes; Build.tsx draws it. */
export const strip = { note: '', redraw: () => {} };
/** Opens `sent` and says a refusal on the strip: Alt-click's route, and Cmd-E's. */
export const openFromStrip = (sent: Sent) =>
  openSource(sent).then((note) => ((strip.note = note), strip.redraw()));
/** An Alt-click (Option-click) on a Book line, with a fine pointer, Build on or off: its source,
 * once, and the line's own press (a field, a link) does not fire. False: not that click. */
export function altClick(e: MouseEvent, line: Sent) {
  const target = e.target as Partial<HTMLElement> | null;
  if (!e.altKey || globalThis.matchMedia?.('(pointer: coarse)').matches) return false;
  if (!target?.closest?.('[data-testid="loka-book"]')) return false; // a strip or sheet control
  e.preventDefault();
  e.stopPropagation();
  void openFromStrip(line);
  return true;
}
