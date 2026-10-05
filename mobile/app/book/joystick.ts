// Which exit a drag on the footer map points at. Units are map units: the minimap is 44 wide at
// rest and the zoomed map draws one unit as ZOOM pixels, so a drag in zoomed pixels / ZOOM is in units.
export const ZOOM = 2.6;
/** Drags shorter than this from the middle point at nothing: dragging back to the middle cancels. */
export const CANCEL = 6;
/** The four compass exits, clockwise degrees from north; a drag in the 90-degree quadrant around one points at it. */
export const ANGLE: Record<string, number> = { north: 0, east: 90, south: 180, west: 270 };
/** Stair nodes beside the map, from its middle; they exist only while that exit does. */
export const STAIR: Record<string, [number, number]> = { up: [31, -9], down: [31, 9] };
const STAIR_R = 5.5;

/** The exit (one of `exits`, by direction) a drag of (dx, dy) map units from the middle points at, else null. */
export function pick(dx: number, dy: number, exits: string[]): string | null {
  for (const [d, [x, y]] of Object.entries(STAIR))
    if (exits.includes(d) && Math.hypot(dx - x, dy - y) < STAIR_R) return d;
  if (Math.hypot(dx, dy) < CANCEL) return null;
  const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const d = Object.keys(ANGLE)[Math.round(degrees / 90) % 4];
  return exits.includes(d) ? d : null;
}

const SIDE = {
  north: 'below',
  south: 'above',
  east: 'left',
  west: 'right',
  up: 'below',
  down: 'above',
} as const;
/** Where the label of the lit exit sits: opposite the drag, so the finger never hides it. A note kept after release (none lit) sits above. */
export const sideOf = (lit: string | null) => SIDE[lit as keyof typeof SIDE] ?? 'above';

const TAP_MS = 500;
/** What the footer's gesture drives: the props now, the walk and the drawing (Footer.tsx). */
export type Ui<P> = {
  now: { current: P };
  walk: (direction: string | null, at: P) => void; // at: the props the drag began on
  openMap: () => void;
  setLit: (d: string | null) => void;
  setNote: (s: string) => void;
  zoom: (to: 0 | 1) => void;
  knob: (x: number, y: number) => void;
};

/**
 * The footer map's drag as PanResponder callbacks. Distances are in map units (drag px / ZOOM); a
 * drag under 2.5 units is still a tap. A release walks on the props the drag began on, so a redraw
 * keeps the captured action/context; the presenter refreshes only an unchanged offered action.
 */
export function gesture<P extends { exits: readonly { direction: string }[] }>(u: Ui<P>) {
  const reset = () => (u.setLit(null), u.knob(0, 0), u.zoom(0));
  let d = { t: 0, moved: false, pick: null as string | null, at: u.now.current };
  return {
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      d = { t: Date.now(), moved: false, pick: null, at: u.now.current };
      u.setNote('');
      u.zoom(1);
    },
    onPanResponderMove: (_: unknown, g: { dx: number; dy: number }) => {
      const [dx, dy] = [g.dx / ZOOM, g.dy / ZOOM];
      d.moved ||= Math.hypot(dx, dy) > 2.5;
      if (!d.moved) return;
      d.pick = pick(
        dx,
        dy,
        d.at.exits.map((e) => e.direction),
      );
      u.setLit(d.pick);
      const stair = d.pick && STAIR[d.pick];
      const k = Math.min(1, 17 / (Math.hypot(dx, dy) || 1)); // the dot stays inside the map
      if (stair) u.knob(stair[0] * ZOOM, stair[1] * ZOOM);
      else u.knob(dx * k * ZOOM, dy * k * ZOOM);
    },
    onPanResponderRelease: () => {
      if (!d.moved && Date.now() - d.t < TAP_MS) u.openMap();
      else u.walk(d.pick, d.at);
      reset();
    },
    onPanResponderTerminate: reset, // a stolen gesture walks nowhere
  };
}
