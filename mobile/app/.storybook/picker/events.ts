// Loka picker (Beads loka-x6t.3): names and shapes the preview overlay, the manager panel and the
// dev-server middleware share. Design: docs/briefs/polish/design-input-p1-2026-10-09.md.
export const ADDON_ID = 'loka/picker';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const TOOL_ID = `${ADDON_ID}/tool`;

// Channel events. Manager -> preview: PICK {on}, PINS {keys} (pinned order, so the chip numbers).
// Preview -> manager: READY (the overlay loaded; the manager answers PICK), PIN {element, add},
// SHOT {key, png}.
export const PICK = `${ADDON_ID}/pick`;
export const PINS = `${ADDON_ID}/pins`;
export const PIN = `${ADDON_ID}/pin`;
export const SHOT = `${ADDON_ID}/shot`;
export const READY = `${ADDON_ID}/ready`;

// Served by the middleware (dev server only, loopback only).
export const ROUTE = '/polish';

export type Box = { x: number; y: number; w: number; h: number };
export type Picked = {
  key: string;
  chain: string[]; // React owner chain, root-most first, named components only, at most 4
  box: Box;
  computed: Record<string, string>;
  text: string | null;
  role: string | null;
  name: string | null;
  testId: string | null;
  png?: string | null; // data URL until sent; the middleware stores it and sets `shot`
  shot?: string | null;
};
export type Pick = {
  id: string;
  time: number;
  type?: 'close' | 'keep-going';
  note?: string;
  story?: { id: string; title: string };
  palette?: string;
  viewport?: { name: string; width: string; height: string } | null;
  elements?: Picked[];
};
export type Status =
  | {
      id: string;
      time: number;
      state: 'working' | 'done' | 'moved' | 'stopped';
      model?: string | null;
      summary?: string | null;
      sha?: string | null;
      beads?: string | null;
    }
  | { type: 'suggest-close'; time: number; reason: string }
  | { type: 'log'; time: number; text: string };
export type Feed = { session: string | null; picks: Pick[]; status: Status[] };
