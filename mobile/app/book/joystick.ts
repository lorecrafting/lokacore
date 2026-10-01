// Which exit a drag on the footer map points at. Units are map units: the minimap is 44 wide at
// rest and the zoomed map draws one unit as ZOOM pixels, so a drag in zoomed pixels / ZOOM is in units.
export const ZOOM = 2.6;
/** Drags shorter than this from the middle point at nothing: dragging back to the middle cancels. */
export const CANCEL = 6;
/** Compass exits, clockwise degrees from north; a drag in the 45-degree sector around one points at it. */
export const ANGLE: Record<string, number> = {
  north: 0,
  northeast: 45,
  east: 90,
  southeast: 135,
  south: 180,
  southwest: 225,
  west: 270,
  northwest: 315,
};
/** Stair nodes beside the map, from its middle; they exist only while that exit does. */
export const STAIR: Record<string, [number, number]> = { up: [31, -9], down: [31, 9] };
const STAIR_R = 5.5;

/** The exit (one of `exits`, by direction) a drag of (dx, dy) map units from the middle points at, else null. */
export function pick(dx: number, dy: number, exits: string[]): string | null {
  for (const [d, [x, y]] of Object.entries(STAIR))
    if (exits.includes(d) && Math.hypot(dx - x, dy - y) < STAIR_R) return d;
  if (Math.hypot(dx, dy) < CANCEL) return null;
  const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const d = Object.keys(ANGLE)[Math.round(degrees / 45) % 8];
  return exits.includes(d) ? d : null;
}
